# Rapport Technique et Fonctionnel — NexaFlow

**Projet** : NexaFlow — Plateforme de gestion des procédures et workflows opérationnels  
**Stack** : Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4.1, Prisma 5, Dexie 4  
**Base de données** : PostgreSQL (web) + SQLite (client local) + IndexedDB (navigateur)  
**Langue** : Exclusivement français (fr-FR)  

---

## 1. Présentation du projet

NexaFlow est une application industrielle de gestion des procédures opérationnelles destinée aux équipes de terrain (rondiers, chefs de quart, chefs de bloc) dans des environnements tels que des centrales électriques ou des sites industriels.

L'application permet de :
- Créer, valider, approuver et exécuter des procédures pas-à-pas avec contrôles de sécurité, minuteurs et capture média.
- Disposer de tableaux de bord adaptés au rôle (administrateur, chef de quart, chef de bloc, rondier).
- Bénéficier d'une assistance vocale (reconnaissance et synthèse vocale) pour un fonctionnement mains-libres.
- Gérer la collaboration : visioconférence, chat, invitations, présence en ligne.
- Maintenir une base de connaissances (Q/R), des banques d'images et des rapports d'inspection.
- Synchroniser les données entre le serveur web (PostgreSQL) et le stockage local (SQLite + IndexedDB).
- Piloter des systèmes embarqués/IoT (capteurs, actionneurs, sortie vocale).

**Branding** : *"NexaFlow — Automate workflows without the chaos"*

---

## 2. Architecture générale

```
src/
├── app/                      # Next.js App Router (pages, layouts, API routes)
│   ├── (dashboard)/          # Groupe de routes dashboard (layout partagé)
│   ├── api/                  # API Route Handlers (REST)
│   ├── login/                # Page de connexion
│   ├── contact/              # Page de contact
│   ├── procedures/           # Pages procédures (guide dynamique)
│   ├── layout.tsx            # Layout racine
│   └── page.tsx              # Page d'accueil (landing page)
├── components/               # Composants React réutilisables
│   ├── ui/                   # Composants shadcn/ui (button, card, dialog, etc.)
│   ├── dashboard/            # Sidebar et top-nav du dashboard
│   ├── procedures/           # Formulaires et exécution de procédures
│   ├── homepage/             # Sections de la landing page
│   ├── embedded-system/      # Panneau système embarqué/IoT
│   ├── pipeline/             # Pipeline CI/CD
│   ├── sync/                 # Synchronisation
│   └── providers/            # Providers React (Query, Theme)
├── lib/                      # Bibliothèques, services, hooks, utilitaires
│   ├── procedures/           # Moteur de procédures (core)
│   ├── qr/                   # Service Q/R (question/réponse)
│   ├── images/               # Gestion de la banque d'images
│   ├── etat-des-lieux/       # Service inspections
│   ├── llm/                  # Client LLM (Groq / Azure OpenAI)
│   ├── speech/               # Reconnaissance et synthèse vocale
│   ├── db/                   # Dexie (IndexedDB local)
│   ├── sync/                 # Synchronisation web ↔ local
│   ├── iot/                  # Client capteurs IoT
│   ├── i18n/                 # Traductions procédures (partiel)
│   └── media/                # Capture média et géolocalisation
├── hooks/                    # Hooks React globaux
├── data/                     # Données statiques
└── middleware.ts             # Middleware Next.js (protection pipeline prod)
```

**Pattern d'architecture** : Next.js App Router avec Server Components par défaut, couche API REST (`/api/*`), stockage hybride PostgreSQL + SQLite + IndexedDB, React Query pour l'état serveur, contexte React pour le thème.

---

## 3. Stack technique détaillé

| Couche | Technologie | Usage |
|--------|------------|-------|
| Framework | Next.js 14.2.35 (App Router) | Rendu, routing, API routes |
| Frontend | React 18 + TypeScript 5 | Interface utilisateur |
| Styling | Tailwind CSS 3.4.1 + shadcn/ui (base-nova) | Design system |
| ORM | Prisma 5 + @prisma/adapter-pg | Accès PostgreSQL |
| Base locale | SQLite (@sqlite.org/sqlite-wasm) + IndexedDB (brut) | Stockage client hors-ligne structuré |
| State serveur | TanStack React Query 5 | Cache, mutations, synchronisation |
| Forms | React Hook Form + Zod | Validation de formulaires |
| Notifications | Sonner | Toasts |
| Speech | Web Speech API (natif) | Reconnaissance et synthèse vocale |
| LLM | Groq API (Llama 3.1) + Azure OpenAI (fallback) | Chat IA, assistant |
| GitHub | Octokit (@octokit/rest) | Pipeline pull/deploy |
| Tests | Vitest + Testing Library + Happy DOM | Tests unitaires |
| Déploiement | Vercel | Hébergement |

---

## 4. Fonctionnalités détaillées

### 4.1 Page d'accueil (Landing page)
Page marketing publique présentant la plateforme.
- **Fichiers** : `src/app/page.tsx`, `src/components/homepage/navbar.tsx`, `src/components/homepage/hero.tsx`, `src/components/homepage/features.tsx`, `src/components/homepage/stats.tsx`, `src/components/homepage/pricing.tsx`, `src/components/homepage/cta.tsx`, `src/components/homepage/footer.tsx`

### 4.2 Authentification et rôles
Système d'authentification basé sur les rôles déduits du pattern d'email. Quatre rôles : `admin`, `chef-de-quart`, `chef-de-bloc`, `rondier`. Sessions stockées en cookies et sessionStorage. Protection CSRF personnalisée.
- **Fichiers** : `src/app/login/page.tsx`, `src/lib/procedures/auth.ts`, `src/lib/procedures/server-auth.ts`, `src/lib/procedures/client-auth.ts`, `src/lib/procedures/csrf.ts`, `src/lib/procedures/csrf-fetch.ts`, `src/middleware.ts`

### 4.3 Tableau de bord (Dashboard)
Interface sécurisée par rôle avec navigation latérale adaptative et barre de navigation supérieure.
- **Fichiers** : `src/app/(dashboard)/layout.tsx`, `src/components/dashboard/sidebar.tsx`, `src/components/dashboard/top-nav.tsx`

### 4.4 Espaces par rôle
Tableaux de bord spécifiques à chaque rôle avec vue d'ensemble, statistiques et actions rapides.
- **Fichiers** :
  - Admin : `src/app/(dashboard)/admin/page.tsx`
  - Chef de quart : `src/app/(dashboard)/chef-de-quart/page.tsx`
  - Chef de bloc : `src/app/(dashboard)/chef-de-bloc/page.tsx`
  - Rondier : `src/app/(dashboard)/rondier/page.tsx`

### 4.5 Gestion des procédures (CRUD)
Création, modification, suppression et consultation de procédures opérationnelles avec métadonnées, étapes ordonnées, consignes de sécurité, minuteurs, alarms, médias et tags.
- **Fichiers** :
  - Pages : `src/app/(dashboard)/creer-procedure/page.tsx`, `src/components/creer-procedure-form.tsx`
  - Composants formulaire : `src/components/procedures/forms/DynamicProcedureForm.tsx`, `src/components/procedures/forms/StepEditor.tsx`, `src/components/procedures/forms/MetadataEditor.tsx`, `src/components/procedures/forms/MediaCaptureField.tsx`, `src/components/procedures/forms/MediaCapturePreview.tsx`
  - Services : `src/lib/procedures/services/procedure-manager.service.ts`, `src/lib/procedures/services/validator.service.ts`, `src/lib/procedures/types.ts`
  - API : `src/app/api/procedures/route.ts`, `src/app/api/procedures/[id]/route.ts`, `src/app/api/procedures/sync/route.ts`, `src/app/api/procedures/versions/route.ts`

### 4.6 Guide et exécution de procédures
Déroulement pas-à-pas d'une procédure avec phases (briefing, prérequis, exécution, complétion, abandon), minuteurs, capture média, signalement d'anomalies et assistance vocale.
- **Fichiers** :
  - Pages : `src/app/(dashboard)/guide-procedure/page.tsx`, `src/app/procedures/guide/[id]/page.tsx`, `src/app/procedures/guide/[id]/ProcedureGuidePageClient.tsx`
  - Composants : `src/components/procedures/execution/ProcedureGuide.tsx`, `src/components/procedures/execution/ProcedureExecutor.tsx`, `src/components/procedures/execution/StepGuide.tsx`, `src/components/procedures/execution/RunningStage.tsx`, `src/components/procedures/execution/CompletedStage.tsx`, `src/components/procedures/execution/BriefingStage.tsx`, `src/components/procedures/execution/PrerequisitesStage.tsx`, `src/components/procedures/execution/AbortedStage.tsx`, `src/components/procedures/visualization/ProcedureTimeline.tsx`, `src/components/procedures/shared/AlarmDisplay.tsx`
  - Hooks : `src/lib/procedures/hooks/useProcedureExecution.ts`, `src/lib/procedures/hooks/useMediaCapture.ts`
  - Services : `src/lib/procedures/services/execution-logger.service.ts`, `src/lib/procedures/services/execution-repo.ts`, `src/lib/procedures/services/alert-evaluator.service.ts`
  - API : `src/app/api/procedures/guide/route.ts`, `src/app/api/procedures/guide/[id]/route.ts`, `src/app/api/procedures/guide/[id]/chat/route.ts`, `src/app/api/procedures/executions/route.ts`, `src/app/api/procedures/executions/[id]/route.ts`, `src/app/api/procedures/executions/[id]/steps/route.ts`, `src/app/api/procedures/executions/[id]/media/route.ts`

### 4.7 Approbation de procédures
Workflow de validation : soumission, approbation, rejet avec commentaires.
- **Fichiers** : `src/app/(dashboard)/approvals/page.tsx`, `src/app/api/procedures/approvals/route.ts`

### 4.8 Historique des exécutions
Consultation et filtrage des exécutions passées avec vue détaillée et export JSON.
- **Fichiers** : `src/app/(dashboard)/executions/page.tsx`

### 4.9 Pipeline CI/CD (développement uniquement)
Intégration GitHub pour pull et déploiement. Désactivé en production via le middleware.
- **Fichiers** : `src/app/(dashboard)/pipeline/page.tsx`, `src/app/(dashboard)/pipeline/PipelineClient.tsx`, `src/components/pipeline/DeployPipeline.tsx`, `src/components/pipeline/DeployButton.tsx`, `src/app/api/pipeline/pull/route.ts`, `src/app/api/pipeline/deploy/route.ts`, `src/middleware.ts`

### 4.10 Gestion Q/R (Question/Réponse)
Base de connaissances avec création, modification, suppression, recherche et export JSON de paires question/réponse.
- **Fichiers** :
  - Page : `src/app/(dashboard)/q-r/page.tsx`
  - Services : `src/lib/qr/server-store.ts`, `src/lib/qr/mock-service.ts`, `src/lib/qr/scoring.ts`
  - API : `src/app/api/qr/route.ts`, `src/app/api/qr/[id]/route.ts`, `src/app/api/qr/search/route.ts`, `src/app/api/qr/export/route.ts`, `src/app/api/qr/import/route.ts`

### 4.11 Banque d'images et médias
Galerie multimédia avec upload, capture caméra, enregistrement vidéo, opérations en masse, lightbox et filtres.
- **Fichiers** :
  - Page : `src/app/(dashboard)/images/page.tsx`
  - Services : `src/lib/images/server-store.ts`, `src/lib/images/mock-service.ts`
  - API : `src/app/api/images/route.ts`, `src/app/api/images/[id]/route.ts`

### 4.12 Visioconférence
Interface de conférence vidéo avec chat intégré, liste des participants, invitations et détection de présence.
- **Fichiers** : `src/app/(dashboard)/video-conference/page.tsx`
- Services support : `src/lib/meetings.ts`, `src/lib/presence.ts`
- API : `src/app/api/meetings/route.ts`, `src/app/api/meetings/[id]/route.ts`, `src/app/api/meetings/[id]/invite/route.ts`, `src/app/api/presence/route.ts`

### 4.13 Profil utilisateur
Gestion du profil utilisateur.
- **Fichiers** : `src/app/(dashboard)/profile/page.tsx`

### 4.14 Rapports
Rapports quotidiens avec synthèse vocale (speech-to-text), zones, services et envoi aux utilisateurs.
- **Fichiers** : `src/app/(dashboard)/rapports/page.tsx`

### 4.15 État des lieux
Rapports d'inspection de site avec pièces jointes média et géolocalisation.
- **Fichiers** :
  - Page : `src/app/(dashboard)/etat-des-lieux/page.tsx`
  - Services : `src/lib/etat-des-lieux/server-store.ts`, `src/lib/etat-des-lieux/mock-service.ts`
  - API : `src/app/api/etat-des-lieux/route.ts`, `src/app/api/etat-des-lieux/[id]/route.ts`

### 4.16 Structure de la base de données
Explorateur arborescent comparatif entre la base web (PostgreSQL) et la base locale (IndexedDB) avec CRUD.
- **Fichiers** :
  - Page : `src/app/(dashboard)/structure-bdd/page.tsx`
  - Services : `src/lib/db/db.ts`, `src/lib/db/tree.ts`
  - API : `src/app/api/tree/route.ts`, `src/app/api/tree/nodes/[id]/route.ts`, `src/app/api/tree/reset/route.ts`, `src/app/api/tree/sync-to-local/route.ts`, `src/app/api/local-tree/route.ts`, `src/app/api/local-tree/nodes/[path]/route.ts`, `src/app/api/local-tree/view/[path]/route.ts`, `src/app/api/local-tree/edit/[path]/route.ts`, `src/app/api/local-tree/reset/route.ts`, `src/app/api/local-tree/clear/route.ts`

### 4.17 Chat IA
Assistant conversationnel simulé avec mode vocal, recherche de fallback dans la base Q/R et interface de chat.
- **Fichiers** : `src/app/(dashboard)/chat-ia/page.tsx`
- Services : `src/lib/llm/client.ts`, `src/lib/procedures/assistants/mock-assistant.ts`
- API : `src/app/api/sync/get-all-data/route.ts`

### 4.18 Actions IA (Système embarqué/IoT)
Panneau de contrôle pour systèmes embarqués : lecture de capteurs, contrôle d'actionneurs, sortie vocale, connexion de dispositifs.
- **Fichiers** :
  - Page : `src/app/(dashboard)/actions-ia/page.tsx`
  - Composants : `src/components/embedded-system/embedded-system-panel.tsx`, `src/components/embedded-system/voice-output.tsx`, `src/components/embedded-system/sensor-readings.tsx`, `src/components/embedded-system/device-connection.tsx`, `src/components/embedded-system/actuator-control.tsx`
  - Services : `src/lib/iot/sensor-client.ts`

### 4.19 Gestion des équipes
Liste des équipes avec recherche, détail d'équipe et détail de membre.
- **Fichiers** : `src/app/(dashboard)/equipes/page.tsx`, `src/app/(dashboard)/equipes/[teamId]/page.tsx`, `src/app/(dashboard)/equipes/[teamId]/[memberId]/page.tsx`, `src/data/teams.ts`

### 4.20 Synchronisation
Synchronisation bidirectionnelle des données entre serveur et stockage local.
- **Fichiers** : `src/components/sync/SyncButton.tsx`, `src/lib/sync/useSyncData.ts`, `src/lib/sync/types.ts`, `src/lib/procedures/offline-repo.ts`

### 4.21 Assistance vocale
Reconnaissance vocale (speech-to-text) et synthèse vocale (text-to-speech) pour l'ensemble de l'application, notamment dans les procédures, les rapports et le chat.
- **Fichiers** : `src/hooks/use-voice-assistant.ts`, `src/lib/speech/use-speech.ts`, `src/components/ui/speech-controls.tsx`

### 4.22 Thème et apparence
Gestion du thème clair/sombre via contexte React et variables CSS.
- **Fichiers** : `src/components/theme-provider.tsx`, `src/app/globals.css`, `tailwind.config.ts`

### 4.23 Page de contact
Formulaire de contact public.
- **Fichiers** : `src/app/contact/page.tsx`

---

## 5. Modèle de données (3 bases de données)

### 5.1 PostgreSQL (Web) — Prisma ORM

| Modèle | Description | Champs clés |
|--------|------------|-------------|
| `TreeNode` | Arborescence (fichiers/dossiers) | id, name, type (root/directory/file), parentId, metadata, order |
| `QARegistry` | Registre de questions/réponses | id, title, description, pairs |
| `QAPair` | Paire question/réponse | id, question, answer, order, registryId |
| `Procedure` | Procédure opérationnelle | id, code (unique), title, description, category, priority, estimatedTimeMinutes, requiredRoles, globalSafetyInstructions, status (draft), authorId, approverId, version, tags, language, body (Json) |
| `ProcedureExecution` | Exécution d'une procédure | id, procedureId, userId, userName, userRole, phase, currentStepIndex, completedSteps, startedAt, finishedAt, anomalies, globalElapsed, steps, media |
| `ExecutionStep` | Étape d'exécution | id, executionId, stepId, stepOrder, title, type, isMandatory, isCompleted, timerEnabled, timerSeconds, startedAt, finishedAt, anomaly |
| `ExecutionMedia` | Média capturé lors d'une exécution | id, executionId, stepId, type, url, filename, mimeType, size, geolocation (Json), timestamp, capturedAt |
| `Approval` | Approbation de procédure | id, procedureId, approverId, approverName, approverRole, status (pending), comment |
| `ProcedureVersion` | Version d'une procédure | id, procedureCode, version, body (Json), createdBy, comment |
| `IotSensorState` | État des capteurs IoT | id, name, type, value, unit, threshold, updatedAt, createdAt |
| `IotActuatorState` | État des actionneurs IoT | id, name, type, isOn, position, updatedAt, createdAt |
| `User` | Utilisateur | id, email (unique), name, passwordHash, role, teamId, createdAt, updatedAt |
| `Team` | Équipe | id, name, members, createdAt, updatedAt |
| `RegistrationRequest` | Demande d'inscription | id, email, name, passwordHash, desiredRole, status, reviewedBy, reviewedAt, reviewComment, createdAt, updatedAt |
| `BootstrapRequest` | Demande de bootstrap | id, userId, status, requestedAt, approvedAt, downloadedAt, token, reviewedById, reviewedByName, reviewComment, createdAt, updatedAt |
| `Notification` | Notification | id, userId, type, title, message, relatedId, read, createdAt, updatedAt |
| `MediaCategory` | Catégorie de média | id, name (unique), description, parentId, order, createdAt, updatedAt |
| `MediaItem` | Média (image/vidéo) | id, title, category, description, tags, kind, mimeType, size, dataUrl, thumbnailDataUrl, geolocation, syncStatus, createdAt, updatedAt |

### 5.2 SQLite (Client local) — @sqlite.org/sqlite-wasm

Base de données fichier `nexaflow-client.sqlite` stockée en OPFS / IndexedDB / mémoire.

| Table | Description | Champs clés |
|-------|-------------|-------------|
| `qa_registries` | Registres Q/R locaux | id, title, description, created_at, updated_at |
| `qa_pairs` | Paires Q/R locales | id, question, answer, registry_id, created_at, updated_at |
| `chat_sessions` | Sessions de chat IA | id, title, messages (JSON), created_at, updated_at |
| `local_tree` | Arborescence locale | id, remote_id, name, type, parent_id, node_order, path, size, content, created_at, updated_at |
| `vector_documents` | Documents vectorisés | id, name, original_path, relative_path, content, embedding, metadata, created_at |
| `sensor_configs` | Configurations capteurs | id, name, type, value, unit, threshold, updated_at |
| `actuator_states` | États actionneurs | id, name, type, is_on, position, updated_at |
| `devices` | Appareils IoT | id, name, type, subtype, ip_address, port, is_active, metadata, created_at, updated_at |
| `iot_history` | Historique IoT | id, entity_type, entity_id, field, old_value, new_value, alert, resolved, created_at |

**Fichiers** : `src/lib/client-engine/sqlite.ts`, `src/lib/db/db.ts`, `src/lib/db/tree.ts`

### 5.3 IndexedDB (Navigateur)

Deux bases IndexedDB distinctes :

**5.3.1 nexaflow-vector-db** (stockage vectoriel / RAG)

| Object Store | Description | Clé / Index |
|--------------|-------------|-------------|
| `documents` | Documents vectorisés | keyPath: id ; index: relativePath |
| `chunks` | Morceaux de documents avec embeddings | keyPath: id (autoIncrement) ; index: documentId, relativePath |
| `vector_tree` | Arborescence vectorielle | keyPath: id ; index: parentId, relativePath |

**5.3.2 nexaflow-json-db** (stockage JSON clé/valeur)

| Object Store | Description | Clé |
|--------------|-------------|-----|
| `json-store` | Paires clé/valeur JSON génériques | keyPath: key |

**Fichiers** : `src/lib/client-engine/vector-store.ts`, `src/lib/client-engine/json-store.ts`

---

## 6. API Routes

### Procédures (`/api/procedures`)
- `GET /` — Liste des procédures (avec fallback hors-ligne)
- `POST /` — Création (admin / chef-de-quart)
- `GET /[id]` — Détail d'une procédure
- `PUT /[id]` — Mise à jour
- `DELETE /[id]` — Suppression
- `POST /sync` — Synchronisation avec versioning
- `GET /versions` — Historique des versions
- Guide : `GET/POST /guide`, `GET/PATCH /guide/[id]`, `POST /guide/[id]/chat`
- Exécutions : `POST /executions`, `GET /executions`, `GET /executions/[id]`, `POST /executions/[id]/steps`, `POST /executions/[id]/media`
- Approbations : `POST /approvals`

### Arborescence (`/api/tree`, `/api/local-tree`)
- Web (PostgreSQL) : CRUD sur les nœuds, reset, sync vers local
- Local (SQLite) : CRUD sur les nœuds, vue/édition de fichiers, reset, clear

### Q/R (`/api/qr`)
- CRUD sur les paires Q/R, recherche, export/import JSON

### Images (`/api/images`)
- Liste paginée avec recherche et filtres, création, suppression en masse, tag en masse

### Réunions (`/api/meetings`)
- CRUD réunions, invitations

### Présence (`/api/presence`)
- Heartbeat, liste des utilisateurs en ligne

### Pipeline (`/api/pipeline`)
- Pull GitHub, déploiement (dev uniquement)

### Autres
- `/api/etat-des-lieux` — CRUD rapports d'inspection
- `/api/iot/sensors` — Données capteurs IoT
- `/api/sync/get-all-data` — Synchronisation globale
- `/api/invitations` — Invitations utilisateur

---

## 7. Stratégie hors-ligne (Offline-first)

L'application est conçue pour fonctionner sans connexion internet grâce à plusieurs couches de stockage :
1. **PostgreSQL** (source de vérité serveur) → via Prisma
2. **SQLite** (client local via WASM) pour les données structurées hors-ligne (Q/R, chat, arborescence, IoT)
3. **IndexedDB** (navigateur) pour le stockage vectoriel (RAG) et le cache JSON clé/valeur
4. **In-memory** (modules `meetings.ts`, `presence.ts`, `execution-repo.ts`)
5. **Mock data** (`mock-data.ts`, `mock-service.ts`)

Le repository de procédures (`offline-repo.ts`) implémente un pattern repository avec bascule automatique vers les fallbacks locaux.

---

## 8. Internationalisation

L'application est **unilingue français**. Les chaînes de caractères sont principalement codées en dur dans les composants. Une structure d'i18n partielle existe pour les procédures (`src/lib/i18n/procedures.ts`). La synthèse et la reconnaissance vocale utilisent `fr-FR`.

---

## 9. Observations techniques

- **Authentification non production-ready** : Les rôles sont déduits du pattern d'email, aucune vérification de mot de passe réelle. Des variables d'environnement NextAuth existent mais ne sont pas utilisées activement.
- **CSRF personnalisé** : Un système de token CSRF maison est implémenté (`csrf.ts`, `csrf-fetch.ts`).
- **React Query** : Utilisé pour la synchronisation et la gestion de l'état serveur avec un stale time de 5 minutes.
- **Design system** : shadcn/ui avec variante `base-nova`, thème sombre via variables CSS OKLCH.
- **Désactivation pipeline en prod** : Le middleware redirige `/pipeline*` vers `/` en production.

---

## 10. Arborescence complète des fichiers sources

```
src/
├── _gen.js
├── middleware.ts
├── data/
│   └── teams.ts
├── hooks/
│   └── use-voice-assistant.ts
├── lib/
│   ├── utils.ts
│   ├── prisma.ts
│   ├── presence.ts
│   ├── meetings.ts
│   ├── db/
│   │   ├── db.ts
│   │   └── tree.ts
│   ├── procedures/
│   │   ├── types.ts
│   │   ├── auth.ts
│   │   ├── server-auth.ts
│   │   ├── client-auth.ts
│   │   ├── csrf.ts
│   │   ├── csrf-fetch.ts
│   │   ├── offline-repo.ts
│   │   ├── mock-data.ts
│   │   ├── services/
│   │   │   ├── validator.service.ts
│   │   │   ├── procedure-manager.service.ts
│   │   │   ├── execution-repo.ts
│   │   │   ├── execution-logger.service.ts
│   │   │   ├── alert-evaluator.service.ts
│   │   │   └── mock-assistant.ts
│   │   ├── hooks/
│   │   │   ├── useProcedureExecution.ts
│   │   │   ├── useProcedureExecution.test.ts
│   │   │   └── useMediaCapture.ts
│   │   └── assistants/
│   ├── i18n/
│   │   └── procedures.ts
│   ├── speech/
│   │   └── use-speech.ts
│   ├── llm/
│   │   └── client.ts
│   ├── qr/
│   │   ├── server-store.ts
│   │   ├── mock-service.ts
│   │   ├── scoring.ts
│   │   └── scoring.test.ts
│   ├── images/
│   │   ├── server-store.ts
│   │   └── mock-service.ts
│   ├── etat-des-lieux/
│   │   ├── server-store.ts
│   │   └── mock-service.ts
│   ├── sync/
│   │   ├── useSyncData.ts
│   │   └── types.ts
│   ├── media/
│   │   └── capture.ts
│   ├── iot/
│   │   └── sensor-client.ts
│   └── prisma.ts
├── components/
│   ├── ui/ (shadcn/ui components)
│   ├── brand/
│   │   └── nexaflow-logo.tsx
│   ├── theme-provider.tsx
│   ├── providers/
│   │   └── query-provider.tsx
│   ├── homepage/
│   │   ├── navbar.tsx
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── stats.tsx
│   │   ├── pricing.tsx
│   │   ├── cta.tsx
│   │   └── footer.tsx
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   └── top-nav.tsx
│   ├── procedures/
│   │   ├── forms/
│   │   │   ├── DynamicProcedureForm.tsx
│   │   │   ├── StepEditor.tsx
│   │   │   ├── MetadataEditor.tsx
│   │   │   ├── MediaCaptureField.tsx
│   │   │   └── MediaCapturePreview.tsx
│   │   ├── execution/
│   │   │   ├── ProcedureGuide.tsx
│   │   │   ├── ProcedureExecutor.tsx
│   │   │   ├── StepGuide.tsx
│   │   │   ├── RunningStage.tsx
│   │   │   ├── CompletedStage.tsx
│   │   │   ├── BriefingStage.tsx
│   │   │   ├── PrerequisitesStage.tsx
│   │   │   └── AbortedStage.tsx
│   │   ├── visualization/
│   │   │   └── ProcedureTimeline.tsx
│   │   └── shared/
│   │       └── AlarmDisplay.tsx
│   ├── pipeline/
│   │   ├── DeployPipeline.tsx
│   │   └── DeployButton.tsx
│   ├── sync/
│   │   └── SyncButton.tsx
│   ├── embedded-system/
│   │   ├── embedded-system-panel.tsx
│   │   ├── voice-output.tsx
│   │   ├── sensor-readings.tsx
│   │   ├── device-connection.tsx
│   │   └── actuator-control.tsx
│   └── creer-procedure-form.tsx
└── app/
    ├── layout.tsx
    ├── page.tsx
    ├── globals.css
    ├── fonts/
    ├── login/page.tsx
    ├── contact/page.tsx
    ├── procedures/guide/[id]/...
    ├── (dashboard)/
    │   ├── layout.tsx
    │   ├── admin/page.tsx
    │   ├── chef-de-quart/page.tsx
    │   ├── chef-de-bloc/page.tsx
    │   ├── rondier/page.tsx
    │   ├── creer-procedure/page.tsx
    │   ├── guide-procedure/page.tsx
    │   ├── approvals/page.tsx
    │   ├── executions/page.tsx
    │   ├── pipeline/page.tsx + PipelineClient.tsx
    │   ├── q-r/page.tsx
    │   ├── images/page.tsx
    │   ├── video-conference/page.tsx
    │   ├── profile/page.tsx
    │   ├── rapports/page.tsx
    │   ├── etat-des-lieux/page.tsx
    │   ├── structure-bdd/page.tsx
    │   ├── chat-ia/page.tsx
    │   ├── actions-ia/page.tsx
    │   └── equipes/...
    └── api/ (voir section 6)
```

---

## 11. Configuration et déploiement

| Fichier | Rôle |
|---------|------|
| `package.json` | Dépendances et scripts (dev, build, lint, typecheck, test, db) |
| `tsconfig.json` | Configuration TypeScript (alias `@/* → ./src/*`) |
| `tailwind.config.ts` | Thème Tailwind étendu (variables CSS, couleurs alarmes) |
| `components.json` | Configuration shadcn/ui (base-nova) |
| `next.config.mjs` | Configuration Next.js |
| `middleware.ts` | Redirection pipeline vers accueil en production |
| `vercel.json` | Commande de build Vercel (db push + generate + build) |
| `vitest.config.ts` | Configuration tests Vitest |
| `.eslintrc.json` | Règles ESLint |
| `prisma/schema.prisma` | Schéma de base de données |
| `.env` / `.env.local` | Variables d'environnement |

---

*Fin du rapport.*
