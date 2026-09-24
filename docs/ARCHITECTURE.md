# Architecture

Trois couches, une seule source de verite.

```
┌──────────────────────────────────────────────┐
│  src/renderer  — interface HTML/CSS/JS       │   contexte isole, aucune API Node
│  vues · palette · toasts · modales           │
└───────────────────┬──────────────────────────┘
                    │  window.mailforge  (preload.js)
┌───────────────────▼──────────────────────────┐
│  src/main — processus Electron               │
│  fenetre sans cadre · 57 canaux IPC          │
│  stockage · chiffrement · dialogues natifs   │
└───────────────────┬──────────────────────────┘
                    │  appels de service partages
┌───────────────────▼──────────────────────────┐
│  src/core — logique metier, sans Electron    │
│  smtp · apis · tempmail · ai · tools ·       │
│  headers · recipients · store · crypto       │
└───────────────────▲──────────────────────────┘
                    │  les memes services
┌───────────────────┴──────────────────────────┐
│  src/cli — MailForge.exe --cli               │
└──────────────────────────────────────────────┘
```

## Regle de base

`src/core` **ne doit jamais** importer `electron`. C'est ce qui permet au CLI, a l'apercu navigateur et a l'interface de partager exactement le meme comportement. Le seul ajustement necessaire a ete de resoudre le dossier de donnees dans `src/core/paths.js` plutot que via `app.getPath('userData')` (les deux pointent vers le meme chemin).

## Cycle de vie d'une vue

```js
MF.router.register({
  id: 'exemple',
  title: 'Exemple',
  group: 'Outils',          // Pilotage | E-mail | Boites | Outils | Systeme
  icon: 'wrench',           // cle de MF.icons
  description: '...',       // affichee dans la palette de commandes

  async preload({ params }) { /* donnees lues synchronement par render() */ },
  render({ params }) { return '<div>...</div>'; },
  async mount({ host, params }) { /* ecouteurs, client-socket, timers */ },
  unmount() { /* nettoyage */ }
});
```

Le routeur **attend `preload()` avant d'appeler `render()`**. C'est la raison d'etre de ce hook : sans lui, une vue qui lit un tableau rempli de maniere asynchrone affiche un etat vide au premier rendu. Toute donnee lue dans `render()` doit etre chargee dans `preload()`.

Le routeur est base sur le hash (`#/exemple?id=42`), avec un jeton de sequence qui annule une resolution devenue obsolete si l'utilisateur navigue pendant un `preload()`.

## Stockage

`src/core/store.js` est un conteneur JSON unique :

- ecriture atomique (fichier temporaire puis `rename`) ;
- acces par chemin pointe (`smtp.activeProfileId`) ;
- `log()` et `recordSend()` alimentent des anneaux bornes (800 lignes, 500 envois) ;
- `saveSoon()` regroupe les ecritures rapides.

Emplacement : `%APPDATA%\MailForge\mailforge.json` sous Windows, `Application Support` sur macOS, `XDG_CONFIG_HOME` sur Linux. `MAILFORGE_DATA_DIR` permet de tout rediriger (utilise par les tests).

## Secrets

`src/core/crypto.js` :

- cle aleatoire de 32 octets dans `secrets.key`, permissions 0600 ;
- AES-256-GCM, format `enc:v1:<iv>:<tag>:<ciphertext>` ;
- `decrypt()` renvoie une chaine vide en cas d'echec, jamais une exception qui remonterait jusqu'a l'interface.

Regle d'interface : les objets renvoyes a l'interface passent par `maskProfile()` — les champs `password`, `apiKey` et `dkim.privateKey` sont vides, seuls des booleens `passwordSet` / `apiKeySet` indiquent qu'un secret existe.

## Canaux IPC

`src/main/ipc.js` enregistre 57 canaux via un helper `handle()` qui :

1. ajoute le canal a `context.channels` (utilise par `--smoke`) ;
2. encapsule le resultat en `{ ok: true, data }` ou `{ ok: false, error }` ;
3. journalise l'echec et pousse un evenement `log` vers l'interface.

Le renderer ne voit jamais une exception Electron brute : `preload.js` (`call()`) transforme l'enveloppe en valeur ou en `Error(message)`, et `api.js` (`guard()`) la transforme en notification.

## File d'envoi groupe

`Mailer.sendBulk()` dans `src/core/services/smtp.js` :

- dedoublonnage implicite et filtrage par liste d'exclusion ;
- **sequentiel** : un message a la fois, jamais de parallelisme (une rafale est le premier signal de spam) ;
- delai `max(1000, throttleMs)` plus une gigue aleatoire ;
- remplacement des variables par destinataire ;
- ajout de la ligne de desinscription ;
- `AbortController` pour l'arret propre ;
- evenements `bulk:start` / `bulk:progress` / `bulk:wait` / `bulk:done` transmis a l'interface par `app:event`.

## Ajouter une brique

**Fournisseur de boite temporaire** — une entree dans `PROVIDERS` (`tempmail.js`) avec `create`, `poll`, `read`, `destroy`. Le selecteur de la vue et les parametres se mettent a jour seuls.

**Transport d'envoi API** — une entree dans `PROTOCOLS` (`apis.js`) : `label`, `endpoint`, `docs`, `send(profile, message)`. Le formulaire de profil propose le protocole automatiquement.

**Outil** — trois points de contact : une entree dans `CATALOG` (`tools.js`), une branche dans `runTool` (`run-tool.js`), un panneau dans `PANELS` (`views/tools.js`). L'outil devient disponible dans l'interface **et** dans `mailforge tools <id>`.

**Fournisseur IA** — une entree dans `CATALOG` (`ai.js`) : `baseUrl`, `model`, `keyUrl`, `free`, `local`. Tout passe par `/chat/completions`, donc tout ce qui est compatible OpenAI fonctionne sans code supplementaire.

## Verification

| Commande | Ce qu'elle couvre |
|---|---|
| `npm run smoke` | 12 controles : chargement de l'interface, DOM monte, stockage, chiffrement, outils, analyse d'en-tetes, enregistrement IPC |
| `npm run preview` | parcours visuel de toutes les vues avec un pont simule |
| `node src/cli/index.js headers --file message.eml` | analyse d'en-tetes de bout en bout |
| `node --check <fichier>` | syntaxe de chaque fichier JS |

Le mode `--smoke` ouvre la fenetre en `show: false`, attend le premier rendu (avec sondage), puis quitte avec un code de sortie non nul si un controle echoue — utilisable tel quel en integration continue.
