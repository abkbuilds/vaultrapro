---
name: animejs
description: Anime.js v4 animation library for the web — animate DOM/CSS/SVG/JS objects, timelines, staggers, scroll-triggered and draggable interactions, springs and custom easings. Use when building motion, micro-interactions, SVG line drawing, text animation, or complex animation sequencing in a React/TypeScript project.
---

# Anime.js v4

Lightweight ES-module animation engine. Works with CSS properties, transforms, SVG attributes, DOM attributes and plain JS objects.

## When to use

Reach for anime.js when the task needs imperative, timeline-based or physics-like motion that CSS transitions and simple Tailwind animations cannot express: sequenced choreography, staggered grids/lists, SVG path drawing/morphing, per-character text animation, draggable elements with inertia, scroll-linked motion, or animating numbers in JS state.

Prefer plain CSS/Tailwind transitions for simple hover/fade/slide states. Do not add anime.js for one-off two-state transitions.

## Install

```bash
bun add animejs
```

TypeScript types ship with the package — no `@types/animejs` for v4.

## Core API

Everything is a named ES import; there is no default `anime()` export in v4.

```ts
import { animate, createTimeline, createTimer, createDraggable, createScope,
         stagger, utils, svg, text, onScroll, eases, spring } from "animejs";
```

| Import | Purpose |
| --- | --- |
| `animate(targets, params)` | Animate CSS props, transforms, attributes, JS objects |
| `createTimeline({ defaults })` | Sequence animations with `.add()`, `.sync()`, `.label()` |
| `createTimer({ duration, onUpdate })` | Frame loop / countdown without targets |
| `createAnimatable(target, opts)` | Cheap, repeatedly-settable values (cursor followers) |
| `createDraggable(target, opts)` | Drag with bounds, snapping, inertia |
| `createScope({ root, mediaQueries })` | Scoped instances with a single `.revert()` — the React cleanup primitive |
| `stagger(value, opts)` | Per-target delays/values (`from: "center"`, `grid: [x,y]`) |
| `utils` | `$`, `set`, `get`, `random`, `clamp`, `snap`, `remap`, `sync` |
| `svg` | `createDrawable`, `morphTo`, `createMotionPath` |
| `text` | `split()` for per-line/word/char animation |
| `onScroll` | Scroll-linked/triggered playback via `autoplay: onScroll(...)` |
| `eases` / `spring` / `cubicBezier` | Easing functions, e.g. `ease: spring({ stiffness: 120 })` |
| `waapi.animate` | Native Web Animations path when hardware-composited motion is enough |

Common params: `duration`, `delay`, `ease`, `loop`, `alternate`, `autoplay`, `composition`, `modifier`, `onBegin`, `onUpdate`, `onComplete`.
Per-property objects accept `{ from, to, duration, ease, delay }`.

```ts
animate(".square", {
  x: 320,
  rotate: { from: -180 },
  duration: 1250,
  delay: stagger(65, { from: "center" }),
  ease: "inOutQuint",
  loop: true,
  alternate: true,
});
```

## React / TanStack Start rules

1. **SSR-safe.** Never call `animate` at module scope or during render. All calls go in `useEffect`/`useLayoutEffect`, which only run in the browser.
2. **Always clean up.** Wrap work in a scope and revert it:

```tsx
import { useEffect, useRef } from "react";
import { animate, createScope, stagger } from "animejs";

export function Cards() {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<ReturnType<typeof createScope> | null>(null);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate(".card", { opacity: [0, 1], y: [16, 0], duration: 600,
        delay: stagger(60), ease: "outQuad" });
    });
    return () => scope.current?.revert();
  }, []);

  return <div ref={root}>{/* .card children */}</div>;
}
```

3. **Target via refs or scope-relative selectors**, never global `document.querySelector`, so multiple mounted instances don't fight.
4. **Respect reduced motion.** Guard with `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and skip or shorten animations.
5. **Animate compositor-friendly properties** (`x`, `y`, `scale`, `rotate`, `opacity`) — avoid animating `width`, `height`, `top`, `left`.
6. **Don't fight React state.** Anime mutates the DOM directly; don't animate an element whose style React re-renders on the same tick.

## Timelines

```ts
const tl = createTimeline({ defaults: { duration: 500, ease: "outExpo" } });
tl.label("intro")
  .add(".title", { opacity: [0, 1], y: [24, 0] })
  .add(".sub", { opacity: [0, 1] }, "-=250")   // relative offset
  .add(".cta", { scale: [0.9, 1] }, "intro+=800");
```

`tl.play() / pause() / restart() / seek(ms) / reverse()`; `tl.completed`, `tl.currentTime`.

## SVG and text

```ts
const [drawable] = svg.createDrawable(".line");
animate(drawable, { draw: "0 1", duration: 1500, ease: "inOutQuad" });

const { chars } = text.split("h1", { chars: true });
animate(chars, { y: [20, 0], opacity: [0, 1], delay: stagger(30) });
```

## Verify

After adding animation, check the preview: element ends in its final state (no stuck opacity 0), no layout shift, no console errors on unmount/route change, and reduced-motion users get a static result.

Full docs: https://animejs.com/documentation
