# Site-wide Lenis scrolling refinement

## Goal
Make scrolling feel consistently smooth and polished across every page without interfering with native mobile gestures, accessibility, dialogs, menus, or horizontal card lists.

## Changes
- Refine the shared Lenis settings for smoother wheel momentum and better anchor positioning beneath the fixed header.
- Preserve browser history scroll restoration while resetting genuinely new page visits cleanly.
- Pause background scrolling whenever a dialog, side sheet, or drawer is open, then restore it safely when closed.
- Mark nested vertical panels and horizontal rails so they keep native, contained scrolling instead of fighting the page scroll.
- Synchronize section reveals and the top progress indicator with Lenis, reducing layout work during active scrolling.
- Keep all motion disabled or immediate for people who prefer reduced motion.

## Validation
- Check the home page and a long card/detail page on desktop and mobile sizes.
- Open and scroll dialogs or sheets to confirm the page behind them stays fixed.
- Verify route navigation, browser back/forward restoration, anchors, horizontal rails, and reduced-motion behavior.
- Confirm there are no browser errors or blank screens.

## Technical details
- Continue using one shared `ReactLenis` root; do not create page-level instances.
- Add a small overlay-lock bridge based on Radix/Vaul open-state attributes rather than changing every feature screen.
- Use Lenis-native scroll callbacks and resize hooks while retaining IntersectionObserver for efficient reveal triggers.
