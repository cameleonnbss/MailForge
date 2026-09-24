# MailForge v1.0.0

**Poste de travail e-mail de bureau.** Compositeur SMTP/API, envoi groupe a liste consentie, boites temporaires, seize utilitaires — dans une vraie fenetre applicative, pas dans un onglet de navigateur.

---

## Telechargements

| Fichier | Taille | Pour qui |
|---|---|---|
| `MailForge-Setup-1.0.0.exe` | ~85 Mo | Installation classique : dossier au choix, raccourci, desinstallation propre |
| `MailForge-1.0.0-portable.exe` | ~85 Mo | Aucune installation, execution directe depuis une cle ou un dossier |
| `MailForge-1.0.0-cli.zip` | ~1 Mo | Version ligne de commande seule (Node >= 18), sans interface |

> Windows 10/11 x64. Aucun runtime a installer : la version installeur et la version portable embarquent tout.

---

## Ce qu'il y a dedans

**Compositeur** — editeur HTML riche, pieces jointes jusqu'a 20 Mo, apercu isole, version texte automatique, brouillon conserve localement, test de connexion avec diagnostic des erreurs courantes (`EAUTH`, `ETIMEDOUT`, `ESOCKET`, certificats).

**Transports** — SMTP via `nodemailer` (STARTTLS 587, SSL 465, verification TLS, signature DKIM possible) ou API HTTP : Resend, SendGrid, Brevo, Mailgun, endpoint JSON generique.

**Campagne** — import CSV ou liste collee, dedoublonnage, detection des adresses invalides, liste d'exclusion, variables `{{nom}}` / `{{email}}` / colonnes du fichier, **delai minimum d'une seconde** entre messages avec gigue, ligne de desinscription automatique, arret propre, progression message par message et bilan final.

**Redaction assistee** — huit fournisseurs preconfigurees dont cinq avec palier gratuit : Groq, OpenRouter, Google AI Studio, Mistral, Cerebras. Plus deux runtimes locaux (Ollama, LM Studio) ou aucune donnee ne quitte la machine, et un endpoint personnalise. Cles chiffrees en AES-256-GCM.

**Boites temporaires** — mail.tm, Maildrop, Guerrilla Mail derriere une interface commune : adresse en un clic, copie, boite de reception, lecture en cadre isole, rafraichissement automatique, purge locale.

**Analyseur d'en-tetes** — la fonction qui explique reellement un passage en spam : chaine `Received` avec delai par saut, verdicts SPF/DKIM/DMARC, `Reply-To` sur un domaine different, `Return-Path` desaligne, `Message-ID` ou `Date` absents, en-tetes dupliques, filtre local, extraction du corps texte.

**Seize utilitaires** — donnees fictives, mots de passe et phrases de passe avec entropie, UUID/ULID, texte de test, Base64, URL encode, hachage, casse et slug, formateur JSON, horodatage, couleurs, comparateur, analyseur d'en-tetes, modeles, snippets, statistiques de texte.

**Interface** — fenetre sans cadre avec barre de titre deplacable, six accents, densite compacte, palette de commandes `Ctrl+K`, raccourcis clavier, notifications, modales, tableaux collants, etats vides soignes.

**CLI complete** — les memes services que l'interface, accessibles sans fenetre :

```bash
MailForge.exe --cli test
MailForge.exe --cli send --to destinataire@exemple.fr --subject "Bonjour" --html message.html --attach rapport.pdf
MailForge.exe --cli campaign --list contacts.csv --subject "Nouveautes" --html modele.html --throttle 5000
MailForge.exe --cli headers --file message.eml
MailForge.exe --cli temp new --provider mailtm
MailForge.exe --cli tools fake-data --count 50 --json
```

---

## Ce que cette version ne fait pas, volontairement

Aucune fonction de contournement de filtre antispam : **pas de rotation d'IP, pas d'usurpation d'expediteur ou d'en-tetes, pas de content spinning, pas d'envoi sur des adresses collectees**. Ces techniques sont illicites dans la plupart des juridictions et detruisent durablement la reputation d'un domaine — un outil qui les integre est un moteur de spam.

Ce qui est implemente a la place, et qui fonctionne reellement : rythme d'envoi maitrise, desinscription en pied de message, liste d'exclusion, personnalisation par destinataire plutot qu'un Cci global, DKIM avec votre propre cle, et un analyseur d'en-tetes pour comprendre les refus.

**Usage legal, ethique et educatif.** Le createur n'est pas responsable de l'usage qui est fait du logiciel : le consentement des destinataires, le contenu des messages et la conformite legislative relevent de l'utilisateur. Detail complet dans [LEGAL.md](https://github.com/cameleonnbss/MailForge/blob/main/LEGAL.md).

---

## Installation

```bash
# depuis les sources
git clone https://github.com/cameleonnbss/MailForge.git
cd MailForge
npm install
npm run dev      # developpement
npm run dist     # genere release/MailForge-Setup-1.0.0.exe
```

## Verifications de cette version

- `npm run smoke` : 12 controles automatises sans fenetre visible — chargement de l'interface, aller-retour du stockage, chiffrement des secrets, outils, analyse d'en-tetes, enregistrement des 57 canaux IPC.
- Interface parcourue vue par vue : dashboard, compositeur, campagne, boites temporaires, redaction IA, outils, modeles, snippets, historique, journaux, parametres (6 onglets).

## Licence

MIT — voir [LICENSE](https://github.com/cameleonnbss/MailForge/blob/main/LICENSE).

## Remerciements

Interface et architecture inspirees de la serie d'outils de [@cameleonnbss](https://github.com/cameleonnbss) — OptimizeKit, WormGPT-desktop. Contact Discord : `cameleonmortis`.
