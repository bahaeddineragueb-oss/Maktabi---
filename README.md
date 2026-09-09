# ⚖️ ADVOCATE PRO ALGÉRIE

**Système professionnel de gestion de cabinet d'avocats — Algérie**
**نظام احترافي لإدارة مكاتب المحامين — الجزائر**

Plateforme complète de gestion de cabinet juridique **bilingue (Français / العربية)** avec support **RTL/LTR**, conçue spécifiquement pour les avocats et cabinets algériens : dossiers, audiences, échéances procédurales, bibliothèque juridique, annuaire judiciaire, facturation, permissions granulaires et journal d'audit.

---

## ⚠️ Avertissement légal / تنبيه قانوني

> **FR** — Cette application est un outil de gestion professionnelle destiné aux avocats. Les informations juridiques doivent être vérifiées sur les sources officielles en vigueur avant toute utilisation professionnelle ou procédurale.
>
> **AR** — هذا التطبيق أداة مهنية مخصصة لإدارة مكاتب المحامين. يجب التحقق دائماً من المعلومات القانونية والنصوص الرسمية السارية قبل اعتمادها في أي إجراء مهني أو قضائي.

**Intégrité des données juridiques** — le système distingue systématiquement :

| Statut | Signification |
|---|---|
| `official` | Source officielle vérifiée |
| `imported` | Référence importée |
| `user_note` | Note créée par l'utilisateur |
| `ai_suggestion` | Suggestion IA — **jamais présentée comme droit officiel** |
| `unverified` | Non vérifié |
| `demo` | Données fictives de démonstration |

Aucun texte d'article, aucune décision de justice et aucun délai procédural n'est pré-rempli comme « officiel » : tout contenu juridique doit être importé/vérifié depuis une source officielle (JORADP, Ministère de la Justice…) par un administrateur.

---

## 🚀 Démarrage rapide

### Windows — Version portable (sans installation) 🇩🇿

1. Décompressez `release/AdvocatePro-Algerie-Portable-Windows-x64.zip` où vous voulez (Bureau, disque externe, clé USB…).
2. Double-cliquez sur **`ADVOCATE-PRO-START.bat`** — le navigateur s'ouvre automatiquement sur `http://localhost:8787`.
3. Première exécution : la base de données se crée automatiquement dans le dossier `data/` (aucune installation, aucune connexion Internet, aucun pilote requis).

La version portable embarque son propre moteur Node.js (`node.exe` v22) et utilise le **SQLite intégré de Node** (`node:sqlite`) — zéro module natif à compiler, 100 % autonome. Toutes les données (base + documents) restent dans le dossier `data/` : la sauvegarde consiste simplement à copier ce dossier. / النسخة المحمولة لا تحتاج أي تثبيت — فك الضغط ثم شغّل `ADVOCATE-PRO-START.bat`.

### Développement (Linux / macOS / Windows)

```bash
npm install            # dépendances
npm run seed           # initialise la base (référentiels + données de démonstration)
npm run build          # compile le frontend (dist/)
npm start              # serveur production → http://localhost:8787
```

Mode développement : `npm run dev:api` (API :8787) + `npm run dev` (Vite :5173).

**Base de données** : SQLite (`data/advocate.db`) — sans installation externe. Deux moteurs, automatiquement sélectionnés : `better-sqlite3` si installé (développement), sinon le SQLite intégré de Node ≥ 22.5 (build portable — aucune compilation native). Sauvegardes : Paramètres → Sauvegarde (export JSON complet).

### Comptes de démonstration

| Identifiant | Mot de passe | Rôle |
|---|---|---|
| `admin` | `Admin@2026` | Super administrateur (cabinet) |
| `maitre.amina` | `Demo@2026` | Avocate |
| `maitre.yacine` | `Demo@2026` | Avocat collaborateur |
| `sara` | `Demo@2026` | Assistante juridique |
| `nadia` | `Demo@2026` | Secrétaire |
| `rachid` | `Demo@2026` | Comptable |
| `observateur` | `Demo@2026` | Lecture seule |

> ⚠️ **Production** : changer `ADV_JWT_SECRET`, créer de vrais comptes, désactiver les comptes de démonstration.

---

## 🧩 Modules

| Module | Contenu |
|---|---|
| **Tableau de bord** | Audiences du jour/demain, échéances à 14 j, tâches en retard, factures impayées, dossiers inactifs, rendez-vous, compteurs |
| **Dossiers** | Références (interne + greffe), parties, juridiction/chambre, domaine, statuts (14 + personnalisables), priorités, équipe, chronologie complète, archives |
| **Clients** | Personnes physiques et morales (RC/NIF/NIS — jamais inventés), relations (conflits), dossiers/documents/factures liés |
| **Vérification de conflits** | Feux tricolores (vert/jaune/rouge) sur client, partie adverse et tiers liés — ne déclare jamais un conflit juridique |
| **Audiences** | Vues jour/semaine/mois/agenda + par juridiction et par avocat ; issue de séance, renvois, prochaine date, tâches générées |
| **Calendrier unifié** | Audiences + échéances + rendez-vous + tâches + jours fériés ; **export ICS** (Google Calendar / Outlook) |
| **Échéances procédurales** | Moteur de calcul (jours calendaires/ouvrables/légaux, exclusion week-end vendredi-samedi + jours fériés, suspension, prolongation, override manuel). Bannière permanente : *« Calculé automatiquement — à vérifier avant de s'y fier »* |
| **Tâches** | Assignation, priorités, statuts, retards, notifications |
| **Documents** | Coffre-fort : PDF/DOCX/XLSX/JPG/PNG/ZIP, versioning, étiquettes, texte indexé (OCR branchable), expiration, rattachement client/dossier/audience/facture |
| **Modèles** | Moteur bilingue avec variables `{{CLIENT_NAME}}`, `{{CASE_NUMBER}}`, `{{COURT_NAME}}`… et rendu contextualisé |
| **Bibliothèque juridique** | Textes (constitution, lois, ordonnances, codes…), **articles avec contrôle de versions** (historique, versions modifiées), jurisprudence (favoris, consultations liées), registre des sources officielles |
| **Annuaire judiciaire** | **58 wilayas** (référentiel officiel 2019), types de juridictions configurables (ordinaire/administratif/commercial/conflits), entités hiérarchiques + chambres configurables, registre des conflits de données |
| **Facturation** | Factures (TVA paramétrable), lignes, paiements (espèces/virement/chèque), dépenses (refacturables), synthèse comptable et graphiques |
| **Équipe & permissions** | 8 rôles, **matrice de permissions granulaires** (35 permissions, overrides par utilisateur), profils avocats (barreau, spécialisations) |
| **Rapports** | Dossiers par statut/domaine/juridiction/avocat/mois, audiences, facturation mensuelle, respect des échéances |
| **Recherche globale** | Moteur bilingue **normalisé** : diacritiques arabes ignorés, `أ/إ/آ→ا`, `ة→ه`, `ى→ي`, accents français ignorés (`é→e`) |
| **Paramètres** | Cabinet, langues, avertissement légal, calendrier/jours fériés éditables, domaines juridiques, statuts, **journal d'audit**, sauvegarde/restauration |
| **Modules optionnels** | Portail client et assistant IA — **désactivés par défaut**, toute suggestion IA est explicitement marquée non officielle |

---

## 🏛️ Données de référence intégrées

- **58 wilayas** (codes 01–58, noms AR/FR, régions) — découpage officiel de 2019 ; population volontairement non renseignée (jamais inventée).
- **Types de juridictions** : Tribunal, Cour (مجلس قضائي), Cour d'assises, Cour suprême (المحكمة العليا), Tribunal administratif, Cour administrative d'appel, Conseil d'État (مجلس الدولة), Tribunal de commerce spécialisé, Pôle pénal, Tribunal des conflits — **extensibles par l'administrateur**.
- **Textes fondateurs** des principaux codes (références bibliographiques) — Statut *non vérifié* jusqu'à import officiel.
- **Calendrier légal** : fériés fixes (officiels) + fériés religieux (estimations astronomiques *non vérifiées*, à confirmer par annonce officielle) — entièrement éditable.
- Toute divergence entre sources alimente le **registre des conflits de données** (Directory → Conflits) pour résolution administrateur.

## 🔐 Sécurité

- JWT (expiration 12 h), bcrypt (10 rounds), rate-limiting login (30 req/10 min)
- RBAC granulaire serveur-side (`requirePerm` sur chaque route)
- Journal d'audit de toutes les mutations (utilisateur, action, entité, IP)
- Téléchargements de fichiers protégés par JWT ; liste blanche d'extensions ; 50 MB max
- `express-rate-limit` avec `trust proxy` correctement configuré

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, Vite 5, Ant Design 5 (RTL natif), Recharts |
| Backend | Node.js, Express 4 |
| Base de données | SQLite — WAL (better-sqlite3 en dev, `node:sqlite` intégré en portable) |
| Auth | jsonwebtoken + bcryptjs |
| i18n | `/locales/fr.json` + `/locales/ar.json` — aucun texte UI codé en dur |

## 📁 Structure

```
server/
  index.js            # serveur Express (API + statiques)
  db.js               # schéma SQLite (39 tables)
  permissions.js      # catalogue permissions + rôles
  middleware/auth.js  # JWT + RBAC + audit
  utils/normalize.js  # normalisation arabe/français (recherche)
  utils/deadlines.js  # moteur d'échéances (calendaire/ouvrable/légal)
  routes/             # auth, cases, clients, schedule, documents,
                      # legal, finance, directory, admin, insights
  seed/               # référentiels (wilayas, types, domaines, textes…)
src/                  # React (pages, composants, i18n)
public/locales/       # ar.json / fr.json
```

## 🧪 Tests

```bash
bash test-api.sh      # 28 vérifications API (auth, RBAC, moteur d'échéances,
                      # conflits, recherche bilingue, ICS, audit…)
```

**Dépannage installation** : si `better-sqlite3` ne trouve pas de binaire pré-compilé et échoue via node-gyp, indiquer les en-têtes Node locaux :
`npm install --nodedir=$(dirname $(dirname $(which node)))` (ou installez les `node-gyp` build tools).

---

**ADVOCATE PRO ALGÉRIE v1.0** — *Outil de gestion, pas un conseil juridique.* · *أداة إدارة، وليست استشارة قانونية.*
