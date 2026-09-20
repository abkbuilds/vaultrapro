# Site-wide smooth scrolling

## What will change
- Add Lenis as the single global scroll engine across every page.
- Preserve native touch scrolling and automatically disable smoothing for reduced-motion preferences.
- Make page navigation reset instantly and reliably, without competing browser smooth-scroll behavior.
- Keep horizontal card rails and modal content independently scrollable.
- Coordinate the existing reveal and progress animations with Lenis scrolling.

## Technical details
- Mount one `ReactLenis` provider in the root layout with global wheel smoothing, anchors, nested scrolling, and route-change inertia cancellation.
- Import Lenis styles before the project styles and remove global CSS `scroll-behavior: smooth` from the document.
- Update route scroll handling to use the shared Lenis instance.
- Verify the homepage and another long page at desktop and mobile widths, including navigation and reduced-motion behavior.
