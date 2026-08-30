# AGENTS.md

## Commands

### Development
- `npm run dev` — Start Next.js development server (http://localhost:3000)

### Build
- `npm run build` — Production build
- `npm run start` — Start production server

### Quality
- `npm run lint` — Run ESLint
- `npm run typecheck` — Run TypeScript type checking (`tsc --noEmit`)
- `npm test` — Run unit tests with Vitest

### Commands
- `npm run lint`: `next lint`
- `npm run typecheck`: `tsc --noEmit`
- `npm test`: `vitest run`
- `npm run test:watch`: `vitest watch`

### Database
- `npm run db:generate` — Generate Prisma client
- `npm run db:push` — Push schema to database (no migration)
- `npm run db:seed` — Seed database from `.data/` and `.registry/`

### Notes
- Tests are located in `src/**/*.test.{ts,tsx}`
- Vitest config: `vitest.config.ts`
