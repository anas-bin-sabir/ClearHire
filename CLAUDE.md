# ClearHire — working rules

ClearHire is an AI talent-matching and team-formation product: FastAPI backend (`backend/`), Next.js 16 App Router frontend (`frontend/`). Read `frontend/AGENTS.md` before writing frontend code — this Next.js version differs from older training data; its docs live in `frontend/node_modules/next/dist/docs/`.

## Architecture constraints

- UI work is presentation-only. Never change API contracts (`frontend/lib/api.ts`), auth (`frontend/lib/auth.ts`, role layouts' `getServerSession` guards), scoring, or backend behavior to make a design work.
- All data comes from `api.*` in `lib/api.ts`. Never render hardcoded candidates, metrics, or identities as if they were live. Illustrative content (landing page only) must be labelled as an example.
- Never fall back to invented user names/emails; omit the element when session data is missing.
- No new dependencies for styling or motion. Available: Tailwind v4, lucide-react, framer-motion, recharts, d3.
- Don't use `any`, disable lint rules, or suppress TS errors.

## Design system — ClearHire palette

The palette is fixed; don't introduce new hues. Tokens live in `frontend/app/globals.css` (`:root` and `.dark`) and are exposed to Tailwind via `@theme`. Use the semantic utilities, never raw hex or Tailwind palette colors (`slate-*`, `indigo-*`, `white/5` …) in pages.

| Color | Hex | Used for | Utility |
|---|---|---|---|
| Electric Indigo | #4F46E5 | Primary buttons, active navigation, links | `bg-primary`, `text-primary-ink`, `bg-primary-tint`, `.btn-primary` |
| Midnight Navy | #111827 | Sidebar/frame, headings, dark UI | `bg-shell` (+ `bg-shell-2` #1F2937, `bg-shell-3` #374151), `text-fg` |
| Teal | #14B8A6 | AI match indicators, positive signals | `bg-teal` (bars, rules), `text-teal-ink` (#0F766E — teal text must use this for AA), `bg-teal-tint` |
| Cool White | #F8FAFC | Page background | `bg-canvas` |
| White | #FFFFFF | Cards, surfaces | `bg-panel` |
| Slate | #E2E8F0 | Borders, dividers | `border-line` |
| Slate Gray | #64748B | Secondary text | `text-fg-2` |

Status colors (existing identity): warning amber `text-warn` (#B45309), danger rose `text-danger` (#E11D48), positive = teal (`text-ok`). Star ratings use `text-star`.

### Rules
- Indigo is the action color; one primary button per area. Everything else is `.btn-secondary` / `.btn-ghost`.
- Teal marks machine output: AI match scores, match reasoning, extracted requirements and the AI explanation all carry teal (`.ai-rule` left rule, teal bars) and say where they came from.
- Type: Plus Jakarta Sans for everything, JetBrains Mono only for identifiers and evidence refs (`f12.skills`). Both are self-hosted in `frontend/app/fonts/` via `next/font/local` — don't switch back to `next/font/google` (the build machine can't reach fonts.gstatic.com). Numbers use `tabular-nums`.
- Sentence case everywhere. No all-caps labels, no eyebrow above every heading, no `→` on button text, no gradient text, no blurred blobs, no glassmorphism.
- Numbers (`01`, `02`) only for real sequences: search rank, workflow steps.
- Radii: frame 20px, panel 14px, control 10px, chip 8px. Shadows: `shadow-card`, `shadow-menu` only.
- Don't nest panels in panels; separate with spacing and `divide-line`.
- Scores are only shown when the API returned them, labelled, with evidence nearby. `match_score` is 0–100; `fraud_score` is 0–1.
- Fraud output is a *signal*, never a verdict: say "flagged for review", not "fraudulent".
- Motion: 150–200ms transitions on state change only; `prefers-reduced-motion` is handled globally.
- Every icon-only control needs `aria-label`; focus is shown by the global `:focus-visible` style.

### Shared building blocks (`frontend/components/`)
- `layout/AppShell.tsx` — navy frame, role sidebar, mobile drawer. Role layouts pass a nav config; don't create per-role sidebars.
- `ui/PageHeader.tsx`, `ui/Panel.tsx`, `ui/Badge.tsx`, `ui/States.tsx` (Empty/Error/Loading/Skeleton), `ui/Dialog.tsx`, `ui/Avatar.tsx`, `ui/Segmented.tsx`.
- Button and field styles are CSS component classes in globals.css: `.btn` + `btn-primary | btn-secondary | btn-ghost | btn-danger | btn-dark` + `btn-sm | btn-lg | btn-icon`; `.field-label`, `.input`, `.input-dark`, `.field-hint`, `.field-error`; `.data-table`.

## Verification commands (run from `frontend/`)

- Type check: `npx tsc --noEmit`
- Lint: `npx eslint` (baseline before the 2026-10 redesign: 77 errors / 69 warnings, mostly `no-explicit-any` and `set-state-in-effect`; don't add new ones)
- Build: `npx next build`
- Backend tests: `cd backend && pytest`
- Visual check: `npx next dev`, then headless Chrome screenshots (`google-chrome --headless --screenshot --window-size=W,H URL`). Authenticated routes need the backend running and a seeded user.

## Gotchas found during the redesign

- Don't name a CSS component class after a Tailwind utility. `.table` collided with Tailwind's `table` (display: table) and beat `hidden`; the component class is `.data-table`.
- `sr-only` text inside a horizontally scrolling table escapes the scroller unless an ancestor is positioned (`.data-table` is `position: relative` for this reason).
- Recharts and D3 write colors as SVG attributes, which can't read CSS variables. Charts take their colors from the `.chart` rules in globals.css (`--chart-line`); D3 graphs read the palette at draw time via `lib/graphColors.ts`.
- D3 drawings need their `<svg>` mounted while data loads; show a loading overlay on top instead of swapping the svg for a spinner.
- Landing and helper copy must match the backend. Check claims (algorithms, fraud signals, accuracy figures) against `backend/app/ai/` before writing them.

## Route checklist

Every route uses `PageHeader`, has loading, empty and error states, and was checked for horizontal overflow at 320–1440px.

- Public: `/`, `/login`, `/signup` (`AuthFrame`)
- Client: dashboard, projects/new, search, team-builder, contracts, freelancers/[id]
- Freelancer: dashboard, profile/edit, trust-score, matches, contracts, skill-graph
- Admin: dashboard, fraud, members, projects, graph, analytics, seed
