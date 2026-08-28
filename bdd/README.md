# BDD - Behaviour-Driven Development

Structure BDD pour NexaFlow - Plateforme de gestion de sécurité industrielle.

## Structure des fichiers

```
bdd/
├── cucumber.json              # Configuration Cucumber
├── features/                  # Scénarios Gherkin (.feature)
│   ├── auth/                  # Authentification & rôles
│   ├── procedures/            # Gestion des procédures
│   ├── execution/             # Exécution de procédures
│   ├── rounds/                # Rondes quotidiennes
│   ├── iot/                   # Monitoring IoT
│   ├── teams/                 # Gestion des équipes
│   ├── qr/                    # Validation QR Code
│   ├── ai/                    # Assistant IA
│   └── sync/                  # Synchronisation offline
├── step-definitions/          # Définitions des steps (TypeScript)
│   ├── auth/
│   ├── procedures/
│   ├── execution/
│   └── ...
├── support/                   # Hooks & World
│   ├── hooks.ts               # Before/After hooks (Playwright)
│   └── world.ts               # Custom World Cucumber
├── fixtures/                  # Données de test
│   └── procedure-valide.json
└── reports/                   # Rapports d'exécution
```

## Prérequis

```bash
npm install --save-dev @cucumber/cucumber playwright @playwright/test ts-node
npx playwright install chromium
```

## Commandes

```bash
# Tous les tests BDD
npx cucumber-js

# Avec profil dev (format pretty)
npx cucumber-js --profile dev

# Par tag
npx cucumber-js --tags "@auth"
npx cucumber-js --tags "@smoke"

# Par feature
npx cucumber-js features/auth/authentication.feature
```

## Tags disponibles

| Tag | Description |
|-----|-------------|
| `@auth` | Authentification |
| `@smoke` | Tests critiques |
| `@regression` | Tests de régression |
| `@offline` | Mode hors-ligne |
| `@e2e` | Tests end-to-end |

## Convention de nommage

- **Features**: `nom-fonctionnalite.feature`
- **Steps**: `domaine.steps.ts`
- **Fixtures**: `description-type.json`

## Langue

Les scénarios sont rédigés en **français** (locale `fr`).
