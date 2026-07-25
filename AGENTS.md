<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# EA System Theme System (always apply)

## Architecture

Three-layer theme: CSS variables → Tailwind `@theme inline` → React context (`ThemeProvider` in `src/components/ui/theme-provider.tsx`).

## Color palette

- **Light mode**: White base + neutral grayscale (shadcn neutral)
- **Dark mode**: Navy base `oklch(0.12 0.01 255)` (~`#0b0e14`) — note: this overrides the default shadcn `.dark` palette
- **CLI accent tokens** (use via `text-cli-*`, `bg-cli-*`, `border-cli-*`):
  - `cli-blue` — primary CTAs, connector lines
  - `cli-emerald` — checkmarks, success, status dot
  - `cli-cyan` — typewriter/status lines
  - `cli-purple` — analytics/dashboard icons
  - `cli-amber` — warnings/secondary highlights
  - `cli-rose` — security/destructive indicators
  - `cli-yellow` — supplementary accent
  - `cli-navy` — dark base background
  - `cli-surface`, `cli-border`, `cli-muted` — dark mode surface hierarchy

## Accent rule

**Accent colors are for icons, status indicators, small accents, and thin borders ONLY.** Never use them as large fills, full backgrounds, or body text. All large areas use the standard shadcn semantic tokens (`bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`).

## Fonts

- `font-sans` — Geist Sans → body text, headings
- `font-mono` — JetBrains Mono → nav links, CLI chrome, status lines, tech labels

## Theme toggle

- Client component `ThemeToggle` in `src/components/ui/theme-toggle.tsx`
- Sun/Moon icon swap with rotation animation
- Persists to `localStorage` key `"theme"`
- Falls back to `prefers-color-scheme` on first visit
- Always include in navbars/headers

## When building any page/component

- Use existing shadcn semantic tokens for structural colors (`bg-card`, `text-muted-foreground`, `border-border`)
- Use `cli-*` tokens exclusively for accents (icons, status dots, small indicators)
- Match the CLI dashboard aesthetic: JetBrains Mono for labels/nav, clean white cards in light mode, navy surfaces in dark
- Never introduce new color palettes or theme systems — extend the existing tokens if needed in `globals.css:7-64`
