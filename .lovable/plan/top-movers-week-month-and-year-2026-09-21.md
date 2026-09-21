# Top movers: week, month and year

Make the movers lists unambiguous — each list states its own time window, and the percentage shown next to a card is the change over exactly that window.

## What changes

**Home page ("My top movers")**
- Currently ranks by the last 24 hours. It becomes **this week**, labelled "My top movers · this week".

**Market page (Top movers)**
- Three side-by-side tabs instead of the current day/week/month index toggle driving everything: **This week**, **This month**, **This year**.
- Each tab shows gainers and losers ranked by that window, and every row's percentage is that same window's change (with the window spelled out under the heading, e.g. "Change over the last 7 days").
- Week stays the default.
- The price index block above keeps its own Today / This week / This month toggle, but gains an explicit caption naming the window it is averaging, so it can't be mistaken for the movers below.

**Yearly data honesty**
- A yearly change does not exist in the data yet. It will be computed from real recorded readings the same way the weekly and monthly ones are: comparing today's recorded price to the card's own recorded price roughly a year ago.
- Only about 1,100 cards currently have readings that far back, so the year tab will legitimately be short at first and will show a note: "Yearly movement only appears for cards with recorded prices from a year ago." It fills in naturally as history accumulates.
- Nothing is estimated or back-filled.

## Technical details

- Migration: add `change_1y numeric` to `public.card_price_latest`; extend `refresh_price_changes()` with a `p365` lookback (`captured_on <= CURRENT_DATE - 365`, latest prior row) and include `change_1y` in the insert/upsert. Re-run the function once after the migration.
- `src/lib/prices/history.server.ts`: extend `MoverWindow` with `"1y"`, add `"1y": "change_1y"` to `COL`, same for `getMarketPulse`.
- `src/lib/prices/prices.functions.ts`: widen the `window` enum in `fetchMovers` (keep `fetchMarketPulse` on 24h/7d/30d).
- `src/routes/trends.tsx`: separate movers window state (`7d` default) from the index window state; render the three-tab selector and per-window caption; pass the selected window to `fetchMovers`.
- `src/routes/index.tsx`: switch the dashboard movers query to `window: "7d"` and update its heading.
- `src/lib/mcp/tools/top-movers.ts`: add `1y` to the accepted window enum and column map.
- Regenerate Supabase types after the migration; typecheck with `bunx tsgo --noEmit`.
