# Changelog

Toutes les versions notables de MailForge. Format inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versionnage [SemVer](https://semver.org/lang/fr/).

## [1.0.0] — 2026-09-24

Premiere version publique. Application de bureau complete, executable Windows et CLI.

### Ajoute — Fenetre et interface

- Fenetre Electron sans cadre avec barre de titre personnalisee : zone de deplacement (`-webkit-app-region`), boutons reduire / agrandir / fermer, double-clic sur la barre pour maximiser.
- Position et taille de la fenetre memorisees, avec verification que la fenetre reste sur un ecran connecte.
- Barre laterale de navigation groupee (Pilotage, E-mail, Boites, Outils, Systeme) qui se reduit en rail d'icones sous 980 px de large.
- Six accents de couleur commutables a chaud, densite compacte, animations desactivables, respect de `prefers-reduced-motion`.
- Notifications empilees, modales, boites de confirmation, palette de commandes `Ctrl+K`, raccourcis clavier globaux (`Ctrl+1..9`, `Ctrl+N`, `Ctrl+R`, `Ctrl+Entree`, `Echap`).
- Etats vides, ecrans d'erreur par vue, tableaux a en-tetes collants, barres de progression, badges et pastilles d'etat.

### Ajoute — E-mail

- Compositeur : expediteur, nom affiche, destinataire multiple, Cc, Cci, reponse, objet, editeur HTML riche, bascule source HTML, pieces jointes (20 Mo par fichier), apercu en cadre isole, version texte generee, brouillon conserve localement.
- Transports d'envoi : SMTP (STARTTLS, SSL direct, verification TLS, DKIM) et API HTTP (Resend, SendGrid, Brevo, Mailgun, endpoint JSON generique).
- Test de connexion avec diagnostic lisible : `EAUTH` (mot de passe d'application requis), `ETIMEDOUT`, `ECONNREFUSED`, `ESOCKET` (mismatch TLS), certificat.
- Campagne : liste collee ou import CSV, dedoublonnage, detection des lignes invalides, liste d'exclusion appliquee automatiquement, variables `{{nom}}` / `{{email}}` / colonnes CSV, delai minimum de 1000 ms entre messages avec gigue, ligne de desinscription, arret propre, progression par destinataire et bilan final.
- Historique des envois : identifiant de message, reponse serveur, latence, statut, export CSV/JSON.
- Journal en direct : 800 lignes bornees, filtre par niveau et recherche texte, export, copie.
- Redaction assistee : huit fournisseurs preconfigurees (Groq, OpenRouter, Google AI Studio, Mistral, Cerebras, Ollama, LM Studio, OpenAI), endpoint personnalise, langue, ton, longueur, consignes permanentes, test du fournisseur, transfert du brouillon vers le compositeur.
- Boites temporaires : mail.tm, Maildrop et Guerrilla Mail derriere un registre de fournisseurs, creation d'adresse, copie, boite de reception, lecture en `iframe` sandbox, reponse, rafraichissement automatique configurable, purge locale.
- Modeles e-mail : bibliotheque, editeur HTML, categories, cinq modeles de depart, variables detectees automatiquement.
- Snippets : blocs courts, etiquettes, recherche, copie, insertion au curseur dans le compositeur.

### Ajoute — Outils

- Donnees fictives FR/EN (identites, adresses, IBAN, societes) avec export CSV/JSON.
- Mots de passe crypto-aleatoires avec entropie calculee, phrases de passe.
- UUID v4, sans tirets, majuscules, `nil`, et ULID triable.
- Lorem ipsum en texte ou HTML.
- Base64 (variante URL-safe), URL encode/decode.
- Hachage SHA-256, SHA-512, SHA-1, MD5.
- Casse et slug : majuscules, minuscules, Title Case, phrase, slug, snake_case, camelCase, inversion.
- Formateur JSON avec statistiques et localisation de l'erreur.
- Convertisseur d'horodatage (Unix <-> ISO/UTC, temps relatif).
- Convertisseur de couleurs HEX / RGB / HSL.
- Comparateur de texte ligne par ligne.
- Analyseur d'en-tetes e-mail : chaine `Received` avec delais par saut, verdicts SPF/DKIM/DMARC, incoherences d'expediteur, en-tetes dupliques, filtre local, extraction du corps.
- Statistiques de texte : caracteres, mots, lignes, octets, temps de lecture.

### Ajoute — Application

- Stockage JSON atomique partage entre l'interface et la CLI.
- Secrets chiffres en AES-256-GCM avec cle locale en permissions restreintes ; les mots de passe et cles ne sont jamais renvoyes a l'interface apres enregistrement.
- Rendu en isolation de contexte : aucune integration Node dans l'interface, CSP stricte, seuls les canaux de `preload.js` sont exposes.
- CLI complete partageant les memes services que l'interface : `profiles`, `test`, `send`, `campaign`, `temp`, `tools`, `headers`, `ai`, `logs`, `config`, `export`, avec `--json` partout.
- Mode `--smoke` : auto-test sans fenetre visible (12 controles, dont le chargement de l'interface et l'enregistrement des 57 canaux IPC).
- Serveur d'apercu local (`npm run preview`) permettant de revoir l'interface dans un navigateur avec des donnees de demonstration.
- Generateur d'icones sans dependance (PNG multi-tailles, ICO, SVG) : `npm run icons`.
- Configuration de compilation electron-builder : installeur NSIS, version portable, dossier non compresse.
- Documentation : README bilingue, guide d'architecture, conditions d'usage (LEGAL.md), notes de version.

### Exclu volontairement

- Aucune technique de contournement de filtre antispam : pas de rotation d'IP, pas d'usurpation d'en-tetes, pas de content spinning, pas d'envoi automatique sur des listes collectees. Voir [LEGAL.md](LEGAL.md).

[1.0.0]: https://github.com/cameleonnbss/MailForge/releases/tag/v1.0.0
