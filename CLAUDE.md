# ClearHire — working rules

ClearHire is an AI talent-matching and team-formation product: FastAPI backend (`backend/`), Next.js 16 App Router frontend (`frontend/`). Read `frontend/AGENTS.md` before writing frontend code — this Next.js version differs from older training data; its docs live in `frontend/node_modules/next/dist/docs/`.

## Architecture constraints

- UI work is presentation-only. Never change API contracts (`frontend/lib/api.ts`), auth (`frontend/lib/auth.ts`, role layouts' `getServerSession` guards), scoring, or backend behavior to make a design work.
- All data comes from `api.*` in `lib/api.ts`. Never render hardcoded candidates, metrics, or identities as if they were live. Illustrative content (landing page only) must be labelled as an example.
- Never fall back to invented user names/emails; omit the element when session data is missing.
- No new dependencies for styling or motion. Available: Tailwind v4, lucide-react, framer-motion, recharts, d3.
- Don't use `any`, disable lint rules, or suppress TS errors.

## Design system — charcoal and lime

The palette is fixed; don't introduce new hues. Tokens live in `frontend/app/globals.css` (`:root` and `.dark`) and are exposed to Tailwind via `@theme`. Token names are semantic and were kept from the previous palette, so `primary` is the action colour and `teal` is the machine-output marker (now lime). Use the semantic utilities, never raw hex or Tailwind palette colours in pages.

| Color | Hex | Used for | Utility |
|---|---|---|---|
| Lime | #C6F135 | Primary buttons, active navigation, AI marks | `bg-primary` + `text-on-primary`, `.btn-primary`, `bg-teal` |
| Lime ink | #4D6B00 | Lime-family text on light surfaces (AA) | `text-primary-ink`, `text-teal-ink`, tints `bg-primary-tint` |
| Charcoal | #3A3A3C | App frame, sidebar, dark panels, stat strip | `bg-shell` (+ `bg-shell-2`, `bg-shell-3`) |
| Ink | #2B2B2D | Headings and body text | `text-fg` |
| Canvas | #F2F1EC | Page background | `bg-canvas`, `bg-sunken` |
| White | #FFFFFF | Cards | `bg-panel` |
| Line | #E3E1DA | Borders, dividers | `border-line` |
| Muted | #6B6A66 | Secondary text | `text-fg-2` |
| Signal | #FF4521 | Fills and large display type only (3.4:1 on white) | `bg-signal`, `text-signal-on-dark` |

Status: warning `text-warn` (#B45309), danger `text-danger` (#C2300F), positive = lime ink (`text-ok`). Lime text never goes on white; use the ink token.

### Rules
- Lime is the action colour; one primary button per area, charcoal text on lime. Others use `.btn-secondary` (outlined pill) or `.btn-ghost`.
- Lime also marks machine output: AI scores, match reasoning, extracted requirements carry the `.ai-rule` left rule and say where they came from.
- Type: Anton (`font-display`, applied to `h1`/`h2` automatically) for titles and big figures; Plus Jakarta Sans for everything else; JetBrains Mono only for identifiers and evidence refs. All three are self-hosted in `frontend/app/fonts/` via `next/font/local` — don't switch to `next/font/google`. Anton has a single weight: never add `font-bold` to it. Numbers use `tabular-nums`.
- Signature shape: `.notch` folder-tab card (clip-path `shape()`, rounded fallback). `Panel` applies it when it has a title. Anything placed in the notch must sit outside the clipped element, because clip-path clips children.
- Sentence case everywhere. No all-caps labels, no `→` on button text, no gradient text, no blurred blobs. The only glassmorphism is the sticky landing header (requested by the product owner).
- Numbers (`01`, `02`) only for real sequences: search rank, workflow steps.
- Radii: frame 28px, panel 22px, field 14px (`rounded-field`, for boxes and inputs), controls and chips are pills. Surfaces are flat; `shadow-menu` only for popovers.
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
