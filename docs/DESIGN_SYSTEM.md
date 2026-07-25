# EA System — Design System

- **Version:** 1.0
- **Last Updated:** 2026-07-25
- **Status:** Active — source of truth for all UI work

---

## Brand Identity

**Product name:** EA System (Educational & Academics System)

**Brand archetype:** Premium Educational SaaS — modern, technical, calm, minimal, high-contrast, professional.

**Visual metaphor:** A powerful operating system for schools. CLI-inspired chrome accents (JetBrains Mono labels, status lines) layered over a clean, modern SaaS interface. Green (`#8EF24A`) is the sole accent. The UI should still look premium when viewed in grayscale — color is enhancement, not dependency.

---

## Logo Usage

The product logotype is the text `❯ EA System` in JetBrains Mono. The `❯` character (U+276F, HEAVY RIGHT-POINTING ANGLE QUOTATION MARK ORNAMENT) is the logomark.

- **Light mode:** Black (`#111827`)
- **Dark mode:** White (`#FAFAFA`)
- **Minimum clear space:** 1x the height of the `❯` glyph on all sides
- **Minimum size:** 16px height for the logomark

---

## Color Palette

### Primary Accent

```
#8EF24A — EA Green
```

**Uses:** Primary buttons, active navigation indicators, chart data, progress bars, success states, highlights, active indicators, thin accent borders.

**Never:** Body text (unless WCAG AA contrast is verified), full-page background fills, large area fills.

### Dark Theme

| Token        | Value     | Usage                                |
| ------------ | --------- | ------------------------------------ |
| Background   | `#09090B` | Page background                      |
| Surface      | `#14161A` | Cards, modals, dropdowns             |
| Border       | `#2A2F36` | Dividers, input borders              |
| Primary Text | `#FAFAFA` | Headings, body text                  |
| Muted        | `#9CA3AF` | Secondary text, labels, placeholders |
| Accent       | `#8EF24A` | (unchanged in dark mode)             |

### Light Theme

| Token        | Value     | Usage                                |
| ------------ | --------- | ------------------------------------ |
| Background   | `#F8FAFC` | Page background                      |
| Cards        | `#FFFFFF` | Cards, modals, dropdowns             |
| Border       | `#E5E7EB` | Dividers, input borders              |
| Primary Text | `#111827` | Headings, body text                  |
| Muted        | `#6B7280` | Secondary text, labels, placeholders |
| Accent       | `#8EF24A` | (unchanged in light mode)            |

### Contrast Verification

Primary Accent `#8EF24A` against:

| Background      | Ratio   | AA Normal | AA Large | AAA Normal | AAA Large |
| --------------- | ------- | --------- | -------- | ---------- | --------- |
| Dark `#09090B`  | 13.15:1 | PASS      | PASS     | PASS       | PASS      |
| Light `#F8FAFC` | 1.22:1  | FAIL      | FAIL     | FAIL       | FAIL      |

**Light theme restriction:** `#8EF24A` must NOT be used as text or UI component foreground on light backgrounds. On light backgrounds, use dark text (`#111827`) for content and `#8EF24A` only as:

- Chart/accent fills with dark text overlay
- Icon accents (Lucide icons with `text-[#8EF24A]`)
- Progress bar fills (with dark text labels)
- Thin accent borders

Dark backgrounds (`#09090B` / `#14161A`) pass WCAG AAA at 13.15:1 — full usage safe.

---

## Typography

| Role                                                           | Font               | Weights            |
| -------------------------------------------------------------- | ------------------ | ------------------ |
| Body, headings, UI labels                                      | **Geist Sans**     | 400, 500, 600, 700 |
| Nav links, CLI chrome, status lines, tech labels, mono accents | **JetBrains Mono** | 400, 500, 600, 700 |

**Scale (rem):** 0.75 (xs), 0.875 (sm), 1 (base), 1.125 (lg), 1.25 (xl), 1.5 (2xl), 1.875 (3xl), 2.25 (4xl), 3 (5xl)

---

## Icons

**Library:** Lucide Icons
**Style:** Outline only
**Sizes:** 16px (sm), 20px (md), 24px (lg)

No filled icon packs permitted. Consistency across all modules.

---

## Motion

| Property | Value                                              |
| -------- | -------------------------------------------------- |
| Duration | 150–250ms                                          |
| Easing   | `ease-out` (entrance), `ease-in-out` (transitions) |
| Types    | Fade, slide (Y: 4–8px), scale (0.95→1)             |

**Avoid:** Bounce, flash, spring-over-300ms, heavy motion.

---

## Spacing

Tailwind default scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

- Card padding: `p-6` (24px)
- Section gap: `gap-6` (24px)
- Page padding: `px-4 md:px-6 lg:px-8`
- Content max-width: `max-w-6xl` (72rem / 1152px)

---

## Border Radius

| Token         | Value    | Usage                         |
| ------------- | -------- | ----------------------------- |
| `rounded-sm`  | 0.125rem | Small badges, tags            |
| `rounded-md`  | 0.375rem | Inputs, buttons               |
| `rounded-lg`  | 0.5rem   | Cards, modals                 |
| `rounded-xl`  | 0.75rem  | Large cards, dashboard panels |
| `rounded-2xl` | 1rem     | Auth cards, hero panels       |

---

## Shadows

### Light Theme

- **Card:** `shadow-sm` (0 1px 2px rgb(0 0 0 / 0.05))
- **Dropdown/Modal:** `shadow-lg` (0 10px 15px -3px rgb(0 0 0 / 0.1))
- **Hover:** `shadow-md` (0 4px 6px -1px rgb(0 0 0 / 0.1))

### Dark Theme

- **Card:** `shadow-sm` with `ring-1 ring-[#2A2F36]` (border-based elevation)
- **Dropdown/Modal:** `shadow-lg` with `ring-1 ring-[#2A2F36]`

---

## Components

All UI components use **shadcn/ui** with the neutral base color. Custom components extend shadcn patterns.

### Buttons

| Variant                        | Usage                            |
| ------------------------------ | -------------------------------- |
| `default` (green `#8EF24A` bg) | Primary CTA, save, submit        |
| `secondary`                    | Less prominent actions           |
| `outline`                      | Cancel, secondary navigation     |
| `ghost`                        | Icon buttons, toolbar actions    |
| `destructive`                  | Delete, remove, critical actions |

### Status Indicators

| Status  | Color           | Icon             |
| ------- | --------------- | ---------------- |
| Present | Green `#8EF24A` | `Check` (lucide) |
| Late    | Amber           | `Clock` (lucide) |
| Absent  | Rose/Red        | `X` (lucide)     |
| Excused | Slate/Muted     | `Minus` (lucide) |

Never rely on color alone — always include icon + text label.

### Attendance Badge

Compact pill with icon + status label + optional count. Consistent across all role surfaces.

---

## Charts

**Library:** Recharts

- **Color palette:** `#8EF24A` (primary), `#9CA3AF` (comparison), `#F87171` (negative)
- **Grid:** Light (`#E5E7EB` / `#2A2F36`), subtle, not dominant
- **Tooltips:** Rounded, shadow, dark text on light bg (or light text on dark bg per theme)
- **Axes:** JetBrains Mono labels, muted color

---

## Layout

### Dashboard Shell

```
┌──────────────────────────────────────────┐
│  Sidebar (240px)  │   Main Content       │
│  - Logo           │                      │
│  - Nav items      │                      │
│  - School selector │                      │
│  - User menu      │                      │
└──────────────────────────────────────────┘
```

Responsive: sidebar collapses to hamburger on tablet/mobile (`<md`).

### Attendance Page Layouts

**Teacher:** Class selector → Date picker → Student grid (name, status toggle, notes) → Save

**Principal:** Summary cards (today %) → Trend chart → Absentee list → Class comparison

**Student:** Monthly summary card → Calendar view → History table

**Parent:** Child selector → Monthly summary → Recent absences list

---

## Responsive Design

| Breakpoint | Width          | Behavior                                        |
| ---------- | -------------- | ----------------------------------------------- |
| Mobile     | `<768px`       | Single column, stacked cards, full-width inputs |
| Tablet     | `768px–1024px` | Two-column where appropriate, sidebar collapsed |
| Desktop    | `>1024px`      | Full layout, sidebar visible, multi-column      |

All touch targets minimum 44×44px on mobile.

---

## Accessibility

**Target:** WCAG 2.1 AA

- All interactive elements keyboard-focusable with visible `focus-visible:ring-2` indicators
- `aria-label` on icon-only buttons
- Form inputs have associated `<Label>` components
- Status communicated via text + icon + color (never color alone)
- `prefers-reduced-motion` respected throughout
- Page landmarks: `<header>`, `<main>`, `<nav>`, `<footer>`

---

## Theme Integration

The Design System builds on the established three-layer theme architecture:

1. CSS custom properties in `globals.css`
2. Tailwind `@theme inline` bindings
3. React `ThemeProvider` context

The existing CLI accent tokens (`cli-*`) are preserved for:

- CLI-blue: connector lines, primary CTAs (legacy)
- CLI-emerald: checkmarks, success, status dots (legacy)
- CLI-cyan: typewriter/status lines (legacy)

New Sprint 2b components should use the Design System tokens (`#8EF24A` accent, surface colors above) via direct Tailwind classes or CSS variable references. The CLI aesthetic (JetBrains Mono for nav, typewriter effects) is retained for branding consistency.

---

## Module Application

All future modules (Timetable, Exams, Fees, Homework, Library, Hostel, Transport, Communication, Reports, HR) must reference this document as the single source of truth for visual design. Sprint specifications define feature behavior; this document defines visual presentation.
