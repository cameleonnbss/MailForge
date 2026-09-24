# Usage, licence et responsabilite — MailForge

## Francais

### Objet du logiciel

MailForge est un **outil d'envoi d'e-mail** : il transmet les messages que vous redigez, via le serveur SMTP ou l'API que vous configurez, vers les destinataires que vous designez. Il fournit des fonctions de composition, de mise en forme, de personnalisation, de rythme d'envoi et d'analyse. Il ne choisit pas les destinataires et ne redige pas les messages a votre place.

### Usage legal, ethique et educatif

L'utilisation de ce logiciel est destinee a un **usage legal, ethique et educatif** :

- communication avec des personnes qui attendent votre message (clients, prospects ayant consenti, membres inscrits, collegues, partenaires) ;
- tests techniques sur vos propres adresses et vos propres domaines ;
- apprentissage du fonctionnement du courrier electronique : SMTP, authentification de domaine, en-tetes `Received`, SPF, DKIM, DMARC, delivrabilite ;
- outils de developpement et de test (jeux de donnees, verification de modeles, analyse d'en-tetes).

### Ce que le logiciel ne fait pas

MailForge n'embarque volontairement **aucune fonction de contournement de filtre antispam** :

- pas de rotation d'adresses IP ni de serveurs relais ;
- pas d'usurpation d'expediteur, d'en-tete `Return-Path`, de `Reply-To` ou de `Message-ID` ;
- pas de generation de variantes textuelles (spinning) destinees a eviter les filtres de contenu ;
- pas d'envoi automatique sur des adresses collectees ou achetees ;
- pas de lien entre le module campagne et le module de boites temporaires.

Ces techniques ne sont pas des fonctions manquantes : elles sont exclues par conception. Un outil d'envoi qui les integre devient un moteur de spam.

### Responsabilite de l'utilisateur

**Le createur de ce logiciel n'est pas responsable de l'usage qui en est fait.** L'utilisateur est seul responsable :

- du **consentement** de ses destinataires et de l'origine des adresses qu'il traite ;
- du **contenu** de ses messages, de leur exactitude et de leur conformite ;
- du **respect de la legislation applicable**, notamment, sans y etre limite :
  - en France : RGPD, loi Informatique et Libertes, LCEN (article 6) relatif a la publicite par courrier electronique sans consentement prealable, Code des postes et communications electroniques ;
  - dans l'Union europeenne : RGPD (Reglement 2016/679) et directive ePrivacy (2002/58/CE) ;
  - aux Etats-Unis : CAN-SPAM Act, et les lois locales applicables ;
  - au Canada : LCAP (CASL) ; au Royaume-Uni : PECR ; ailleurs : toute loi locale equivalente.
- des **consequences** techniques : reputation de domaine, blacklisting, suspension par son fournisseur d'acces ou son hebergeur.

Consequences typiques d'un envoi non consenti : plaintes, filtrage global du domaine, blocage de votre adresse professionnelle, amendes administratives (jusqu'a 4 % du chiffre d'affaires annuel au titre du RGPD pour certaines infractions, plafonds propres au CAN-SPAM et au CASL).

### Donnees traitees localement

Le logiciel ne transmet rien a son auteur :

- configuration, historique, journaux, modeles et snippets restent dans un fichier JSON local (`%APPDATA%\MailForge\mailforge.json` sous Windows) ;
- mots de passe SMTP et cles d'API chiffres en AES-256-GCM, cle locale en permissions restreintes ;
- aucune telemetrie, aucune analyse d'usage, aucun appel vers un serveur de l'editeur ;
- les seules connexions sortantes vont vers les services que **vous** configurez : votre serveur SMTP, votre fournisseur d'API d'envoi, votre fournisseur d'IA, l'API publique du service de boite temporaire choisi.

**Boites temporaires** : une adresse jetable est publique par nature. Ne faites transiter par elle aucune information personnelle, aucun secret, aucune donnee soumise a confidentialite.

**Redaction assistee** : si vous activez un fournisseur d'IA en ligne, le texte de votre demande et votre consigne sont transmis a ce fournisseur, selon ses propres conditions. Les fournisseurs locaux (Ollama, LM Studio) n'envoient rien a l'exterieur.

### Licence

MIT. Voir [LICENSE](LICENSE). Le logiciel est fourni « en l'etat », sans garantie d'aucune sorte, expresse ou implicite, y compris mais sans s'y limiter les garanties de qualite marchande, d'adequation a un usage particulier et d'absence de contrefacon. En aucun cas les auteurs ou titulaires du droit d'auteur ne peuvent etre tenus responsables de toute reclamation, dommage ou autre responsabilite, que ce soit dans le cadre d'un contrat, d'un delit ou autre, decoulant de, ou lie a, l'utilisation du logiciel.

---

## English

### What this software is

MailForge is an **email sending tool**: it delivers the messages you write, through the SMTP server or API you configure, to the recipients you specify. It provides composition, formatting, personalisation, pacing and analysis features. It does not choose the recipients and does not write the messages for you.

### Intended use

Legal, ethical and educational use only:

- communicating with people who expect your message (consented contacts, subscribed members, colleagues, partners) ;
- technical testing against your own addresses and domains ;
- learning how email actually works: SMTP, domain authentication, `Received` headers, SPF, DKIM, DMARC, deliverability ;
- development and testing utilities (test data, template checks, header analysis).

### What it deliberately does not do

MailForge includes **no antispam filter evasion**:

- no IP rotation or relay rotation;
- no sender or header spoofing (`From`, `Return-Path`, `Reply-To`, `Message-ID`);
- no content spinning to slip past content filters;
- no automatic sending to harvested or purchased address lists;
- no link between the campaign module and the temporary mailbox module.

These are excluded by design, not missing. A sending tool that ships them becomes a spam engine.

### No author liability

**The creator of this software is not responsible for how it is used.** You are solely responsible for the consent of your recipients, the origin of the addresses you process, the content of your messages, your compliance with applicable law (GDPR and ePrivacy in the EU, CAN-SPAM in the United States, CASL in Canada, PECR in the United Kingdom, LCEN in France, and any equivalent local law), and the technical consequences of your sending (domain reputation, blocklisting, provider suspension).

### Data stays local

Configuration, history, logs, templates and snippets live in a local JSON file. SMTP passwords and API keys are encrypted at rest with AES-256-GCM. There is no telemetry and no call to any server owned by the author. Outbound connections go only to the services you configure — your SMTP server, your mail API provider, your AI provider, and the public API of the temporary mailbox service you pick.

Temporary mailboxes are public by nature: never route personal data, credentials or confidential material through them. If you enable an online AI provider, your prompt is sent to that provider under its own terms; local runtimes (Ollama, LM Studio) send nothing anywhere.

### Licence

MIT. See [LICENSE](LICENSE). The software is provided "as is", without warranty of any kind. In no event shall the authors or copyright holders be liable for any claim, damages or other liability arising from, out of or in connection with the software or its use.
