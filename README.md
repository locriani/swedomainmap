# swedomainmap

Software Engineering Knowledge Domain Map — an interactive web reference that visualizes which knowledge areas typically fall within different engineering roles' scope, at different seniority levels, with a custom-selection mode for asking "what do _I_ already know?".

## Why

Engineering roles are fuzzy. "iOS engineer," "platform engineer," "full-stack" — each implies a different (and often contested) slice of the broader software-engineering knowledge surface. And "senior" means very different things at different orgs and at different roles. This tool lays the categories and items out in one view and lets you toggle a role + level to highlight what's typically in-scope, so you can have a calibrated conversation about coverage and gaps instead of arguing from gut feel.

## Quick start

```bash
git clone <this-repo>
cd swedomainmap
npm install
npm run dev
```

Then open the URL printed by Vite (default `http://localhost:5173`).

## Usage

- **Pick a role** from the header (default: iOS). The map highlights items that role typically owns.
- **Pick a level** (Jr / Mid / Sr / Staff). Default is Mid — the calibrated baseline. Items expected at higher levels appear desaturated with a small "earned at L_n" badge so you can see what's coming next.
- **Toggle highlighting off** to see the full unfiltered map.
- **Custom selection** — pick "Custom selection" from the role dropdown to choose your own subset of items (e.g. "what I personally know"). Coverage stats reflect your custom set. Persisted to localStorage; survives reloads.
- Coverage stats per category appear in the header.

The data lives in [`src/data/`](src/data/) (`categories.ts`, `roles.ts`) — edit these files to adjust the map for your team's reality. Add levels per role with the `iLv()` helper.

## Architecture

Clean-architecture-ish split:

- [`src/domain/`](src/domain/) — pure types and pure functions (no React, no I/O). Owns `RoleId`, `Level`, `RoleSelection` (discriminated `predefined | custom`), `slugify`, `isItemInScope`, `computeCoverage`, `effectiveLevel`, `levelRank`.
- [`src/data/`](src/data/) — the map content itself: `CATEGORIES`, `ROLES`, role-grouping constants in `roleGroups.ts`. Items are declared via `i('Label', ...roles)` (or `iLv('Label', { role: 'sr' }, ...roles)` for level annotations).
- [`src/presentation/`](src/presentation/) — React components (`App`, `Header`, `CategoryCard`, `ItemPill`, `RoleSelector`, `LevelSelector`, `CustomRoleEditor`) and hooks (`useRoleSelection`, `useCoverage`, `usePersistedState`).

Persistence: a single localStorage key (`swedomainmap.state.v1`) holds the user's selection, level, and highlight preference, schema-versioned for future migrations.

Tests live next to the code they cover (`*.test.ts`/`*.test.tsx`), powered by Vitest + Testing Library. Data invariants (every role-id known, every item id unique, every `levels` key in `item.roles`, per-role smoke counts) live in `src/data/categories.test.ts`.

## Development

```bash
npm run dev            # Vite dev server with HMR
npm run build          # type-check + production build
npm run typecheck      # tsc --noEmit
npm run test           # vitest run (one-shot)
npm run test:watch     # vitest watch mode
npm run preview        # preview a production build
```

Stack: React 18, TypeScript 5 (strict), Vite 5, Tailwind CSS 3, Vitest 2, Testing Library.

### Adding a role

1. Add a string-literal id to `RoleId` in [`src/domain/types.ts`](src/domain/types.ts).
2. Add a `Role` entry to `ROLES` in [`src/data/roles.ts`](src/data/roles.ts).
3. Optionally extend a group in [`src/data/roleGroups.ts`](src/data/roleGroups.ts) (e.g. add to `ALL_BUT_EM` or `DATA_PEOPLE`) so existing items pick up the role automatically.
4. Run `npm run test` — the smoke tests will tell you if the new role has too few in-scope items. Annotate items in `categories.ts` until coverage looks right.

### Adding level annotations

Use `iLv(label, levels, ...roles)` instead of `i(label, ...roles)`:

```ts
iLv('Kubernetes (...)', { devops: 'mid', backend: 'sr' }, 'devops', 'backend', ...);
```

Only annotate roles whose expectation diverges from the Mid default. Every key in `levels` must also appear in `roles` (the data tests enforce this).
