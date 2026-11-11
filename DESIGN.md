# Hiveborn design system — "Heartlight"

Hiveborn is a companion for _Heart: The City Beneath_: a living nightmare city under
the city, lit red by the Heart, threaded with the dead iron of the Vermissian and
hollowed into hives. The interface should feel like a well-printed, well-used
rulebook carried into that place: bone paper, crimson ink, soot, tarnished brass.

**Direction in one line:** crimson heart-light on bone (light) or soot-iron (dark);
sharp, slightly notched shapes; a bladed display face for names and headings; plain,
timeless sans for everything you actually read.

- Flair comes from a few signature elements, used deliberately: the **ritual band**
  (notched crimson header), the **iron plate** (double-rule panel), the **heart sigil**
  (heart hanging in a hive cell), a faint printed **grain**, and a red **heart-light glow**
  rising from the bottom of the page.
- Everything else stays quiet. Group with spacing and proximity before adding borders.
- No decorative copy, no explanatory blurbs about how the app works internally.

Tokens live in `src/index.css`. Primitives live in `src/components/ui/`. Shell
components live in `src/components/`.

---

## Fonts (2 families)

| Role    | Family                                                 | Use via                    |
| ------- | ------------------------------------------------------ | -------------------------- |
| Display | **Grenze** 500/600/700 (`@fontsource/grenze`, bundled) | `font-display`, `h1`, `h2` |
| Body/UI | Helvetica Neue → Helvetica → Arial → system-ui         | default (`font-sans`)      |

- `h1`/`h2` get Grenze automatically. `h3` and below are sans; add `font-display` when a
  small heading needs it (names, card titles, dialog titles already use it).
- Helpers: `.title-display` (page title, clamp 1.6–2.1rem), `.eyebrow` (11px, tracked,
  uppercase, heart-red — the small label above a title), `.font-display`.
- Keep headings modest. A page title is ~2rem; section titles 1–1.25rem.
- Numbers in inputs use tabular figures.

## Color

All colors are OKLCH CSS variables; Tailwind utilities are generated for each
(`bg-card`, `text-heart`, `border-border-strong`, …). **Use semantic tokens in
components**; raw scales are for illustration/edge cases.

### Semantic tokens

| Token                                       | Light ("Bone & Blood")   | Dark ("Soot & Heartlight")              | Use                                                                       |
| ------------------------------------------- | ------------------------ | --------------------------------------- | ------------------------------------------------------------------------- |
| `background` / `background-deep`            | bone paper               | soot-iron                               | page                                                                      |
| `foreground`                                | sepia-black ink          | bone                                    | body text                                                                 |
| `card` / `card-foreground`                  | lightest bone            | iron plate                              | panels                                                                    |
| `popover`                                   | lightest bone            | raised iron                             | menus, dialogs, toasts                                                    |
| `sunken`                                    | recessed bone            | recessed soot                           | input wells, segmented tracks                                             |
| `primary` / `primary-hover` / `-foreground` | crimson 700              | crimson ~0.52L                          | the one main action, active segments, checked boxes                       |
| `heart`                                     | crimson 700              | bright heart-red                        | **red text & icons** (links, eyebrows, accents) — readable on both themes |
| `secondary` / `-foreground`                 | bone 300                 | iron 700                                | secondary buttons                                                         |
| `muted` / `muted-foreground`                | —                        | —                                       | quiet fills / secondary text                                              |
| `accent` / `-foreground`                    | warm bone wash           | dried-blood wash                        | hover & highlighted rows                                                  |
| `honey`                                     | brass                    | honey                                   | hive accents, sparingly                                                   |
| `iron`                                      | cool iron                | cool iron                               | Vermissian/cold accents                                                   |
| `destructive` / `-foreground`               | arterial red             | arterial red (more orange than primary) | delete/danger                                                             |
| `success` / `warning` / `info`              | verdigris / brass / iron | lighter variants                        | status                                                                    |
| `border` / `border-strong` / `input`        | hairlines                | hairlines                               | dividers, field borders                                                   |
| `ring`                                      | crimson                  | heart-red                               | focus outline (used at ~50% alpha)                                        |

> Text on a dark surface that should read "red": use `text-heart`, not `text-primary`.

### Raw scales

`crimson-50…950`, `bone-50…950`, `iron-50…950`, `honey-200/400/500/700/900`,
`verdigris-300/500/700` — e.g. `bg-crimson-900`, `text-bone-600`.

### Selection, scrollbars

`::selection` uses a translucent crimson (`--selection`) keeping text color. Scrollbars
are themed globally (thin, iron/bone thumb, crimson on hover). Add `.scrollbar` to
inner scrollers if needed, `.scrollbar-none` to hide one (e.g. horizontal tab strips).

## Spacing, radius, elevation, layers

- Spacing: Tailwind's 4px scale. Page gutter `--gutter` (16px) / 24px ≥ sm; use
  `.page-container` for standard width + gutters. Leave ≥8px around buttons.
- App bar height `--app-bar-height` (3.5rem). Full-height pages:
  `min-h-(--page-min-h)`; sticky things below the bar: `top-(--app-bar-height)`.
- Radius: base `--radius` 6px → `rounded-xs` 2, `rounded-sm` 4, `rounded-md` 6,
  `rounded-lg` 8, `rounded-xl` 12, `rounded-2xl` 16. Prefer `md` for controls, `lg` for
  panels, `xl` for dialogs. Avoid pills unless it's truly a tag/count.
- Shadows: `shadow-xs | sm | md | lg | glow` (warm in light, deep black in dark;
  `glow` = crimson heart-light halo for "live"/highlighted things).
- Z-index (use `z-(--z-…)`): `--z-raised 10`, `--z-sticky 30` (app bar), `--z-dock 40`
  (floating buttons), `--z-overlay 50` / `--z-modal 50`, `--z-popover 60` (menus, select,
  tooltips — above dialogs), `--z-toast 70`, `--z-roll 80`.
- Safe areas: `.pb-safe` (bottom padding ≥ home bar / Firefox Android URL bar),
  `.bottom-safe` (for fixed bottom elements), `--safe-bottom`.

## Motion

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1); /* enter, UI response   → ease-out   */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* on-screen movement → ease-in-out */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1); /* sheets/drawers      → ease-drawer */
--ease-in: cubic-bezier(0.55, 0, 1, 0.45); /* exits               → ease-in    */
--duration-fast: 120ms;
--duration-base: 180ms;
--duration-slow: 260ms;
```

Tailwind's `ease-out`, `ease-in`, `ease-in-out` utilities are overridden with these
curves; `ease-drawer` is added. Rules:

- Only animate `transform` and `opacity` (color/background transitions are fine for
  hovers). Stay under 300ms for UI.
- Enter with ease-out, fast; exit with ease-in, faster (≈60–70% of the enter).
- Things that pop open scale from **0.90** (menus, dialogs) or **0.97** (tooltips),
  never from 0, and grow from their origin: Radix popovers use their transform-origin
  var; dialogs grow from the point you clicked (`DialogContent` handles it).
- Tooltips: first one waits 350ms; once one is open, the next opens instantly with no
  animation (`[data-state="instant-open"]` / `[data-instant]` → 0ms).
- Every button/clickable: `cursor: pointer`, `:active` → `scale(.97)` (global rule).
- Hover styles only apply on `(hover: hover) and (pointer: fine)` — Tailwind's `hover:`
  is redefined to that; write raw CSS hovers inside the same media query.
- `prefers-reduced-motion`: slides/zooms/scales are neutralised (tw-animate vars zeroed,
  pop → fade, no press-scale, dice land immediately), fades and color changes remain.
- Keyframes available: `hb-fade-in`, `hb-rise-in` (`animate-hb-fade-in`,
  `animate-hb-rise-in`), `hb-pop-in/out`, `hb-sheet-up/down`, `hb-shimmer`,
  `hb-heartbeat` (`.hb-heartbeat`, e.g. a live indicator).

## Focus & accessibility

- Global `:focus-visible` = 2px ring-colored outline at ~55% alpha, `outline-offset: 0`
  so it sits on the component's border. Don't add heavy `ring-*` halos.
- Icon-only buttons need `aria-label` (and usually a `<Hint>` tooltip).
- Disabled buttons should say why: wrap in `<Hint label="…" wrap>`.

---

## Components

All in `@/components/ui/*` unless noted.

### Button — `@/components/ui/button`

```tsx
import { Button, TrashButton } from "@/components/ui/button"

<Button>Save nickname</Button>                       // primary (crimson), alias variant="primary"
<Button variant="secondary">Cancel</Button>
<Button variant="outline">Load character</Button>
<Button variant="ghost" size="icon-sm" aria-label="More"><MoreHorizontal /></Button>
<Button variant="subtle">Show beats</Button>
<Button variant="destructive">Delete</Button>        // alias variant="danger"
<Button variant="link">rowanrookanddecard.com</Button>
<TrashButton aria-label={`Delete ${name}`} onClick={…} />  // subtle icon-only delete
```

Sizes: `xs` (28px), `sm` (32), `default` (40, matches inputs), `lg` (44), `icon` (40),
`icon-sm` (32), `icon-xs` (28). One primary per region. Delete buttons are
`TrashButton`s (icon only); the confirmation button spells out **Delete**.

### Card / panels — `@/components/ui/card`

```tsx
<Card variant="default | plate | sunken | ghost">
    <CardHeader>
        <CardTitle>…</CardTitle>
        <CardDescription>…</CardDescription>
    </CardHeader>
    <CardContent>…</CardContent>
    <CardFooter>…</CardFooter>
</Card>
```

- `plate` = Vermissian iron plate (double inner rule) — featured / hero content.
- CSS-only equivalents: `.panel`, `.panel-plate`.
- Section header: `.ritual-band` (notched crimson band, display caps). The existing
  `.sheet-section-heading`, `.sheet-shell`, `.sheet-choice`, `.segmented-control`,
  `.form-select` classes are restyled onto the tokens and safe to keep using.
- Ornament: `<SigilDivider />` and `<HeartSigil />` from `@/components/ui/sigil`.

### Form fields

```tsx
import { Input, fieldClassName } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownTextarea } from "@/components/ui/markdown-textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

<Label htmlFor="nick">Nickname</Label>
<Input id="nick" placeholder="e.g. HoneyWitch" />

<Select value={skill} onValueChange={setSkill}>
    <SelectTrigger aria-label="Skill"><SelectValue placeholder="Pick a skill" /></SelectTrigger>
    <SelectContent>{skills.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
</Select>
```

- Inputs, select triggers and `.form-select` are all **h-10** with the same well
  (`bg-sunken`, `border-input`). `text-base` on mobile (prevents iOS zoom), `sm:text-sm`.
- Replace native `<select>` with `Select`. Radix forbids `""` as an item value — map the
  empty choice to a sentinel (e.g. `"none"`) at the call site.
- `Checkbox` is an ink-box: checked = solid crimson square (stress tracks read like the
  printed sheet). Hit area extends 6px beyond the box.
- Inputs no longer default to bold/xl text — size them at the call site if a field is a
  "hero" field (e.g. the character name).

### Tabs — `@/components/ui/tabs`

```tsx
<Tabs value={tab} onValueChange={setTab}>
    <TabsList variant="segmented">
        {" "}
        {/* or "underline" */}
        <TabsTrigger value="minor">Minor</TabsTrigger>
        <TabsTrigger value="major">Major</TabsTrigger>
    </TabsList>
    <TabsContent value="minor">…</TabsContent>
</Tabs>
```

Prefer these over importing `@radix-ui/react-tabs` directly. If tabs switch page-level
views, keep the value in the URL (TanStack Router search params).

### Dialog / ConfirmDialog

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
;<ConfirmDialog
    trigger={<TrashButton aria-label={`Delete ${name}`} />}
    title={`Delete ${name}?`}
    description="You can restore it from Deleted characters."
    confirmLabel="Delete"
    onConfirm={() => removeCharacter(index)} // may return a Promise; button shows busy
/>
```

- `DialogContent` animates from 0.90 out of the click point, exits to 0.97 with ease-in.
  It scrolls internally, keeps its close button pinned, respects the safe area. Pass
  `hideClose` to drop the ✕. Width via `className="sm:max-w-xl"` etc.
- Autofocus: Radix focuses the first focusable element; put the input first when a
  dialog is for typing. In confirmations focus lands on **Cancel**.
- Never use `window.confirm`. For undoable actions (archive/move) skip the dialog and
  show a toast with an Undo action instead.

### Menus

```tsx
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
;<ContextMenu>
    <ContextMenuTrigger asChild>
        <article>…card/row…</article>
    </ContextMenuTrigger>
    <ContextMenuContent>
        <ContextMenuItem onSelect={open}>
            <BookOpen /> Open sheet
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={askDelete}>
            <Trash2 /> Delete…
        </ContextMenuItem>
    </ContextMenuContent>
</ContextMenu>
```

- Lists that can be acted on (character tabs, group cards, roll rows, archived sheets)
  should get a context menu with the most important actions.
- Menu items: `variant="destructive"` for danger; icons get muted automatically.
- Opening a dialog from a menu item: keep dialog state outside the menu and set it in
  `onSelect`; use `<DropdownMenu modal={false}>` (see `app-bar.tsx`).

### Tooltip — `@/components/ui/tooltip`

```tsx
import { Hint, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

<Hint label="Open dice roller"><Button size="icon" aria-label="Open dice roller"><Dices /></Button></Hint>
<Hint label="Sign in to share rolls" wrap><Button disabled>Share</Button></Hint>
```

Dark ink tooltip in both themes, collision-aware (flips/shifts with 8px padding),
skip-delay via the single app-wide `TooltipProvider` in `App.tsx`. Prefer `<Hint>` over
`title=""`.

### Other

- `ScrollArea` — themed thumb; global scrollbars are themed too.
- `Skeleton` — `<Skeleton className="h-4 w-40" />`; reserve the final size so nothing reflows.
- `Kbd` — `<Kbd>⌘K</Kbd>`.
- `Markdown` / `MarkdownTextarea` — unchanged API; markdown headings use the display face.
- Toasts — `import { toast } from "sonner"`; skinned globally (left accent bar per type,
  safe-area offsets, follows the app theme). `toast("Archived", { action: { label: "Undo", onClick } })`.
- `.heart-loading-dots` — the bouncing blood-drop loader for full-panel loading.

## App shell (`src/components/`)

- `app-bar.tsx` — sticky top bar on `/` and `/play*`: brand (sigil + "Hiveborn"),
  Sheets/Play links (active = crimson underline), "Jump to… ⌘K", theme toggle,
  account / sign-in (+ local test sign-in on localhost), "More" menu (external links,
  copyright). On phones, sign-in/account/play move into "More". `/auth/callback` and
  `/stage-connect` render without chrome.
- `quick-navigator.tsx` (+ lazy `quick-navigator-palette.tsx`) — Cmd/Ctrl+K palette:
  characters, play groups (when signed in), pages, actions (new character, dice roller,
  theme, sign in). Call `openQuickNavigator()` to open it from anywhere.
- `theme-toggle.tsx`, `cookie-consent.tsx`, `on-page-roll-overlay.tsx`.
- Theme is the zustand store in `src/lib/theme.ts` (not next-themes). `index.html`
  pre-paints `#f6efe4` / `#090f17`; keep those in sync with `--background`.

---

## Page agent checklist

1. Use tokens only — no hex/rgb, no `red-*`/`gray-*` Tailwind palette classes. Red text →
   `text-heart`; red fills → `bg-primary`; danger → `destructive`.
2. Build from `@/components/ui/*`. Native `<select>` → `Select`; raw Radix Tabs → `ui/tabs`;
   `title=""` → `<Hint>`; any destructive action → `ConfirmDialog` (or Undo toast if reversible).
3. Delete = `TrashButton` (icon-only, aria-label); confirm button text says "Delete".
4. Add context menus to actionable lists/cards.
5. Headings: Grenze via `h1`/`h2`/`font-display`/`.title-display`, small labels via `.eyebrow`.
   Keep sizes modest. No decorative or "how it works" copy.
6. Layout below the app bar: `min-h-(--page-min-h)`, sticky offsets `top-(--app-bar-height)`;
   don't add another theme toggle or back-to-sheets nav — the app bar has them.
7. Group with spacing first; borders sparingly. Inputs/selects h-10; buttons have room around them.
8. Motion: only transform/opacity, curves from tokens, ≤300ms, scale from .90/.97, exits ease-in.
   Gate hovers (Tailwind `hover:` already is). Check reduced motion.
9. Mobile (390), tablet (768), desktop (1440), both themes. Fixed bottom UI uses
   `.bottom-safe`/`.pb-safe`; nothing important under the Firefox/iOS bottom bar.
10. Loading = skeletons sized like the content; errors per-request with retry/detail buttons.
11. Keep behavior, data, test ids, aria-labels and copy that tests rely on (`grep` `*.test.tsx`).
12. `pnpm run typecheck && pnpm run lint:check && pnpm test && pnpm exec vite build`.
