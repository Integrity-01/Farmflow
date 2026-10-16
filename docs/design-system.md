# FarmFlow Design System

A single source of truth for colour, surfaces, motion, and layout across the
FarmFlow web app. All tokens live in `src/index.css` inside the Tailwind v4
`@theme` block, so they are available as utility classes everywhere (for
example `--color-accent-400` powers `bg-accent-400`, `text-accent-400`, etc.).

## Colour tokens

| Token | Value | Usage |
| --- | --- | --- |
| `accent-200` | `#E2FBC4` | soft lime highlight |
| `accent-300` | `#C8F79A` | lime label / on-dark accent |
| `accent-400` | `#A8F05A` | **primary lime** (CTA, active accents) |
| `accent-500` | `#8FDC3F` | lime hover |
| `accent-600` | `#6FB52A` | lime active |
| `forest-50` | `#EEF5F0` | active surface tint |
| `forest-700` | `#1C5638` | deep green ink |
| `forest-900` | `#123D2A` | **deep forest green** (headings) |
| `forest-950` | `#0B2A1C` | hero overlay / footer |
| `brand-600` | `#16A34A` | primary green (buttons, links) |
| `pale` | `#F2F8EC` | app background |
| `ink` | `#193326` | primary text |
| `muted` | `#66766B` | secondary text |
| `hairline` | `#DFE9DE` | borders / dividers |

The legacy `brand-*` scale is retained for compatibility with existing screens;
new work should prefer `accent-*` for call-to-action emphasis and `forest-*` /
`ink` / `muted` / `hairline` for text and structure.

Status colours reuse the existing `Alert` / `Badge` variants (success, warning,
danger) which are tuned for contrast on light surfaces.

## Surfaces (glassmorphism)

Three utility classes are defined in the `@layer utilities` block:

| Class | Description |
| --- | --- |
| `glass-surface` | Translucent white panel (`0.76`), 18px blur, soft shadow. Use for content cards over imagery/colour. |
| `glass-panel` | Opaque-leaning white panel (`0.9`), 22px blur. Use for forms and primary content where legibility matters most. |
| `glass-dark` | Dark forest panel (`0.42`), 16px blur. Use for panels layered over the hero photo. |

Every glass class has a `@supports not (backdrop-filter: ...)` fallback that
swaps to a near-opaque background, and text on glass always sits on a surface
with sufficient contrast (no text directly on raw blur).

## Typography & radius

- Font: system UI stack (`--font-sans`).
- Radius: `xs 6px` → `2xl 20px`; cards and glass panels use `rounded-2xl` /
  `rounded-3xl`.
- Shadows: `--shadow-soft`, `--shadow-glass`, `--shadow-lift` for the layered,
  low-contrast look used by the glass surfaces.

## Motion

Animation tokens (`--animate-*`) cover fade, pop, zoom, slide, `rise-in`
(hero content entrance) and `drift`. Entrances are short (140–700ms) and
use an ease-out cubic-bezier.

**Reduced motion:** a global `@media (prefers-reduced-motion: reduce)` block in
`@layer base` collapses all animations/transitions to ~0ms, so the app is fully
usable without motion.

## Imagery

`public/images/farm-hero.svg` is a project-owned, license-free vector artwork
(sunrise over crop rows with a survey drone). It is small, resolution
independent, and used as the splash / auth hero. It is referenced with a plain
`<img>` (`object-cover`) so it is resilient, and the splash marks decorative
instances `aria-hidden`. A dark gradient overlay guarantees text contrast, and
solid `forest-900` sits behind the image as a fallback.

## Screens & navigation

- `/login` — **Splash**: full-bleed hero, white typography, feature highlights,
  and a lime **Proceed** pill. Proceed routes to `/login/welcome`, preserving
  `?next`.
- `/login/welcome` — the option screen (Admin, User, Create organization) in a
  two-column hero + glass layout.
- `AuthLayout` renders every password/registration screen as a split layout:
  hero panel on `lg`, glass form panel beside it, stacked on mobile.
- The in-app shell (`AppShell`, `Sidebar`, `TopBar`, `BottomNav`) uses
  `hairline` borders, translucent blurred bars, a soft radial backdrop, and a
  forest-tinted active navigation pill.

## Accessibility

- Focus rings remain on-brand (`outline-brand-600`).
- Interactive glass surfaces keep ≥ 4.5:1 text contrast; overlays darken the
  hero beneath white text.
- Motion respects `prefers-reduced-motion`.
- Safe-area insets are honoured (`safe-area-top`, `safe-area-bottom`).
