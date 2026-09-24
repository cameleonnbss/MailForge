<div align="center">

# MailForge

**Poste de travail e-mail de bureau — compositeur SMTP/API, envoi groupe a liste consentie, boites temporaires et seize utilitaires, dans une seule fenetre applicative.**

Un binaire compilé + une interface HTML/CSS/JS embarquee · zero bundler · zero telemetrie

[Francais](#francais) · [English](#english) · [Legal](LEGAL.md) · [Changelog](CHANGELOG.md)

</div>

---

## Captures

| Tableau de bord | Compositeur |
|---|---|
| Hero, compteurs reels, lanceur de modules, journal en direct | Editeur riche, pieces jointes, redaction assistee, test de connexion |

| Campagne | Boite temporaire |
|---|---|
| Analyse de liste, dedoublonnage, delai maitrise, progres en direct | Adresse jetable, boite de reception, rafraichissement auto, cadre isole |

| Boite a outils | Parametres |
|---|---|
| 16 outils groupes, resultat immediat, export CSV/JSON | 6 onglets, 6 accents, profils d'envoi, liste d'exclusion |

> Les captures sont refaites depuis l'application reelle. Un apercu navigateur est disponible (`npm run preview`) : le pont Electron est alors remplace par des donnees de demonstration, rien n'est envoye.

---

## Francais

### Ce que fait l'application

**E-mail**
- **Compositeur** — expediteur, nom affiche, destinataire, Cc/Cci, reponse, objet, editeur HTML riche (gras, italique, listes, liens, titres, citation, bascule source), pieces jointes jusqu'a 20 Mo, apercu dans un cadre isole, version texte generee automatiquement.
- **Transports** — SMTP via `nodemailer` (STARTTLS 587, SSL 465, TLS verifie, DKIM optionnel) **ou** API HTTP : Resend, SendGrid, Brevo, Mailgun, endpoint JSON generique. Test de connexion avec diagnostic des erreurs courantes (EAUTH, ETIMEDOUT, ESOCKET, certificats).
- **Campagne** — liste collee ou import CSV, dedoublonnage, detection des adresses invalides, liste d'exclusion, variables `{{nom}}` / `{{email}}` / colonnes du CSV, delai minimum d'une seconde entre messages avec gigue, ligne de desinscription automatique, arret propre, progression message par message.
- **Redaction assistee** — huit fournisseurs preconfigurees (Groq, OpenRouter, Google AI Studio, Mistral, Cerebras, Ollama, LM Studio, OpenAI) plus un endpoint personnalise. Langue, ton, longueur, consignes permanentes. Cles chiffrees au repos.
- **Boites temporaires** — mail.tm, Maildrop, Guerrilla Mail derriere une interface commune. Adresse en un clic, copie, boite de reception, lecture dans un `iframe` sandbox, rafraichissement automatique, purge locale.
- **Modeles et snippets** — bibliotheque de modeles HTML avec variables, blocs courts reutilisables, insertion au curseur.
- **Historique et journaux** — chaque envoi conserve son identifiant de message, sa reponse serveur et sa latence ; journal en direct filtrable et exportable.

**Utilitaires** — donnees fictives (FR/EN, export CSV/JSON), mots de passe et phrases de passe (entropie calculee), UUID v4 / ULID, texte de test, Base64, URL encode, hachage SHA-256/512, SHA-1, MD5, casse et slug, formateur JSON, horodatage, couleurs HEX/RGB/HSL, comparateur de texte, analyseur d'en-tetes e-mail, statistiques de texte.

**Analyseur d'en-tetes** — chaine `Received` avec delais par saut, verdicts SPF/DKIM/DMARC, `Reply-To` sur un domaine different, `Return-Path` desaligne, `Message-ID` ou `Date` absents, en-tetes dupliques, en-tetes de filtre local, extraction du corps texte.

### Architecture

```
src/
  core/                     logique partagee GUI + CLI (aucune dependance Electron)
    paths.js                dossier de donnees (%APPDATA%/MailForge)
    crypto.js               AES-256-GCM pour les secrets
    store.js                stockage JSON atomique, logs, historique
    services/
      smtp.js               transports SMTP/API, file d'envoi espacee
      apis.js               adaptateurs Resend / SendGrid / Brevo / Mailgun / generique
      tempmail.js           registre de fournisseurs de boites jetables
      ai.js                 client compatible OpenAI + catalogue de fournisseurs
      tools.js              fonctions pures des 16 outils
      headers.js            analyse RFC 5322 et delivrabilite
      recipients.js         analyse de listes CSV / texte
      run-tool.js           repartiteur partage IPC + CLI
  main/                     processus Electron
    main.js                 fenetre sans cadre, bornes persistees, mode --smoke
    ipc.js                  57 canaux, enveloppe {ok, data}
    preload.js              pont contextIsolation (seule surface exposee)
  renderer/                 interface, servie localement, sans bundler
    css/                    tokens, base, layout, composants, vues
    js/                     icons, api, ui, state, router, palette
    js/views/               11 vues (dashboard, composer, campagne, ...)
  cli/                      entree CLI partageant src/core
scripts/
  make-icons.js             generation PNG/ICO sans dependance
  preview.js                serveur statique pour revoir l'interface
```

Trois decisions structurantes :

1. **Le routage est un dossier de vues.** Chaque vue est un objet `{ id, title, group, icon, preload, render, mount }` enregistre aupres du routeur. Ajouter un ecran = un fichier + une balise `<script>`. La barre laterale, la palette de commandes et les raccourcis se mettent a jour seuls.
2. **Toute la logique vit dans `src/core`, sans Electron.** Le CLI et l'interface appellent exactement les memes services : un outil ajoute est immediatement disponible dans les deux.
3. **Le renderer ne touche jamais a Node.** `contextIsolation` actif, aucune integration Node, CSP stricte, et seulement les canaux enumeres dans `preload.js`.

### Extensions prevues

| Ajouter | Ou | Effort |
|---|---|---|
| Un fournisseur de boite temporaire | une entree dans `PROVIDERS` (`src/core/services/tempmail.js`) | ~30 lignes |
| Un transport API | une entree dans `PROTOCOLS` (`src/core/services/apis.js`) | ~20 lignes |
| Un outil | une entree dans `CATALOG` + `runTool` + un panneau dans `views/tools.js` | ~40 lignes |
| Un fournisseur IA | une entree dans `CATALOG` (`src/core/services/ai.js`) | ~10 lignes |
| Une vue | un fichier dans `src/renderer/js/views/` | ~100 lignes |

### Installation et lancement

```bash
# 1. installer les dependances
npm install

# 2. lancer en mode developpement (DevTools ouverts)
npm run dev

#    ou lancer simplement l'application
npm start

#    verifier le socle sans ouvrir de fenetre (12 controles)
npm run smoke

#    revoir l'interface dans un navigateur (pont simule, aucun envoi)
npm run preview          # http://127.0.0.1:4321

# 3. compiler l'application (dossier non installe, release/win-unpacked/)
npm run pack

# 4. generer l'executable final (installeur NSIS + version portable)
npm run dist

# 5. produire aussi l'archive CLI (facultatif, inclus dans npm run release)
npm run package:cli

#    tout en une commande
npm run release
```

Artefacts produits dans `release/` :

| Fichier | Taille | Description |
|---|---|---|
| `MailForge-Setup-1.0.0.exe` | ~82 Mo | Installeur Windows (choix du dossier, raccourci, desinstallation) |
| `MailForge-1.0.0-portable.exe` | ~82 Mo | Executable autonome, sans installation |
| `MailForge-1.0.0-cli.zip` | ~48 Ko | Ligne de commande seule (Node >= 18), sans interface |
| `win-unpacked/MailForge.exe` | ~180 Mo | Version non compressee, utile pour debugger |

> **Note de compilation Windows.** La chaine `npm run dist` est en trois temps : `pack` produit le dossier non installe, `brand` y applique l'icone et les metadonnees de version, puis `electron-builder --prepackaged` fabrique l'installeur et la version portable. Cette decomposition existe parce qu'electron-builder, sur une machine Windows sans mode developpeur active, ne peut pas extraire son propre outil de signature (l'archive contient des liens symboliques macOS, qui demandent un privilege administrateur). Le resultat est identique a la chaine standard, sans droits administrateur ni certificat de signature.

Les icones sont versionnees dans `build/`. Pour les regenerer : `npm run icons` (encodeur PNG/ICO ecrit a la main, aucune dependance image : sept tailles PNG, un ICO multi-resolution, un SVG).

### Ligne de commande

Le meme binaire expose une CLI complete : `MailForge.exe --cli <commande>`, ou `npm run cli -- <commande>` en developpement.

```bash
mailforge profiles list
mailforge profiles add --label "Gmail" --host smtp.gmail.com --port 587 --user vous@gmail.com --password "motdepasse-application" --from vous@gmail.com
mailforge test                       # verifie hote, TLS et authentification
mailforge send --to destinataire@exemple.fr --subject "Bonjour" --html message.html --attach rapport.pdf
mailforge campaign --list contacts.csv --subject "Nouveautes" --html modele.html --throttle 5000
mailforge campaign --list contacts.csv --subject "Test" --text msg.txt --dry-run
mailforge temp new --provider mailtm
mailforge temp poll --box <id>
mailforge headers --file message.eml   # SPF, DKIM, DMARC, delais par saut
mailforge tools password --length 32
mailforge tools fake-data --count 50 --locale fr --json
mailforge logs --limit 50 --level error
mailforge config set ai.activeProviderId groq
mailforge export --out sauvegarde.json
```

Ajoutez `--json` a n'importe quelle commande pour une sortie exploitable par un script.

### Securite et vie privee

- Mots de passe SMTP et cles d'API chiffres en AES-256-GCM, cle locale en 0600 dans le dossier de donnees.
- Les secrets ne sont jamais renvoyes a l'interface apres enregistrement (seul un indicateur « secret enregistre » remonte).
- Aucune telemetrie, aucun appel vers un serveur de l'editeur. Les seules requetes sortantes vont vers les fournisseurs que **vous** configurez.
- L'interface est servie en local avec une CSP stricte (`connect-src 'none'`, `frame-src 'none'`), et le contenu des messages distants est rendu dans un `iframe sandbox`.

### Ce que l'application ne fait pas

MailForge n'embarque **aucune technique de contournement de filtre antispam** : pas de rotation d'IP, pas d'usurpation d'en-tetes (`From` / `Return-Path` / `Message-ID`), pas de generation de variantes textuelles destinees a tromper les filtres, pas de ciblage automatique d'adresses collectees. Ces pratiques sont illicites dans la plupart des juridictions et detruisent la reputation du domaine emetteur : les implementer dans un outil d'envoi reviendrait a livrer un moteur de spam.

Ce qui est implemente a la place, pour un envoi groupe qui arrive reellement :
- delai configurable entre messages, minimum une seconde appliquee (une cadence mecanique est un signal de spam) ;
- ligne de desinscription en pied de chaque message de campagne ;
- liste d'exclusion respectee automatiquement ;
- personnalisation par destinataire plutot qu'un unique message en Cci ;
- signature DKIM possible avec votre propre cle ;
- analyseur d'en-tetes pour comprendre pourquoi un message a ete filtre.

### Contact et liens

- Depot : <https://github.com/cameleonnbss/MailForge>
- Auteur : <https://github.com/cameleonnbss>
- Discord : `cameleonmortis`
- Licence : MIT — voir [LICENSE](LICENSE) et [LEGAL.md](LEGAL.md)

### Topics GitHub suggeres

`electron` `email` `smtp` `nodemailer` `desktop-app` `dashboard` `temporary-email` `developer-tools` `bulk-email` `windows` `javascript` `html` `css` `cli` `privacy` `productivity` `self-hosted`

---

## English

**MailForge is a desktop email workbench**: a rich composer sending through SMTP or an HTTP mail API, a throttled bulk sender for opt-in lists, temporary mailboxes, and sixteen local utilities — packaged as a real application window, not a browser tab.

**Highlights**
- Frameless Electron window with a custom draggable titlebar, persisted bounds, six accent themes, toasts, modals and a `Ctrl+K` command palette.
- SMTP (STARTTLS/SSL, TLS verification, optional DKIM) and API transports: Resend, SendGrid, Brevo, Mailgun, generic JSON endpoint.
- Bulk sender with CSV import, deduplication, suppression list, per-recipient `{{variables}}`, a hard one-second floor between messages, unsubscribe footer and live progress.
- Temporary mailboxes behind a provider registry (mail.tm, Maildrop, Guerrilla Mail).
- Optional AI drafting through any OpenAI-compatible endpoint, including free tiers and local runtimes.
- Email header analyser: `Received` chain with per-hop delays, SPF/DKIM/DMARC verdicts and the inconsistencies that actually explain a spam-folder landing.
- Full CLI parity: every core service is shared between the GUI and `MailForge.exe --cli`.

**Commands**

```bash
npm install     # dependencies
npm run dev     # development (DevTools)
npm run smoke   # headless self-test, 12 checks
npm run preview # browser preview of the UI (mocked bridge)
npm run pack    # unpacked build
npm run dist    # final Windows installer + portable exe
```

**Not included, on purpose:** no antispam filter evasion, no header/sender spoofing, no IP rotation, no address harvesting. See [LEGAL.md](LEGAL.md).
