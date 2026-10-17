# AI Investment Advisor (real data)

A new **Advisor** bottom tab with daily Buy / Sell / Hold picks for cards and sealed products. Every pick is scored only from real recorded prices. When something has no data, the page says so. Nothing is invented.

## What the user sees
1. **Daily picks**: Cards and Sealed tabs, each with Top 10 Buys, Sells/Avoids and Holds. Each pick shows:
   - Image, name, set and real price
   - AI score (0–100), recommendation badge (Strong Buy to Strong Sell), confidence %, and a risk badge (Safe / Caution / High Risk)
   - A 30-day return range, worked out from the card's real past swings
   - A 2–4 sentence plain-English reason, plus the signals behind the score
   - A "last refreshed" time
2. **Search advisor**: Look up any card or product to get its full analysis. This adds a short-term (1–2 weeks) and long-term (1–3 months) outlook, a "why safe / why risky" note, a warning when sales are thin, and a graded-price summary when graded sales exist.
3. **Your Collection Insights**: Notes based on your real collection, for example "Your X is ranked a top sell". If you're signed out or your collection is empty, it says so.
4. **Track record**: Win rate and average return for past picks over 30, 60 and 90 days. It's measured against real later prices, so it starts empty and fills in over time. It includes a "past results don't guarantee future results" note.
5. A prominent "Not financial advice" warning, plus loading, empty and error states on every section.

## How the scores work
- These signals come from real data: price trend (7, 30 and 90 days), volatility, how many sources and sales back the price (liquidity), graded vs raw price gap (grading ROI), and how far the price sits from its 30-day average (technicals).
- Sentiment and population have no real source yet, so they show "no data" and don't count toward the score.
- Scoring follows fixed rules, so it can be repeated. AI only writes the plain-English explanation, using the real numbers it is given, and never changes them.

## Technical details
- New tables `ai_picks` (daily snapshot: kind, item id, score, recommendation, confidence, risk, return range, signals jsonb, thesis, outlooks, price_at_pick, picked_on) and `ai_pick_outcomes` for the track record. Both are public to read; only the backend can write. The migration includes GRANTs and RLS.
- `src/lib/advisor/score.ts` holds the pure scoring rules, with vitest tests for score bands, risk bands and confidence.
- `advisor.server.ts` builds the daily batch from `card_price_latest`, the trend functions and the sealed products from the TCGGO browse data. Theses are written with Lovable AI on `openai/gpt-6-astra` through Responses, using a strict JSON schema.
- New scheduled route `/api/public/build-ai-picks`, checked with a refresh token, runs daily. Past picks are graded at 30, 60 and 90 days.
- New server functions `fetchAdvisorPicks`, `analyzeItem` (search, scored live) and `fetchTrackRecord`. Collection insights are matched on the page.
- New route `src/routes/advisor.tsx` with its own page title and description. A new "Advisor" tab is added to `BottomNav`, and the tab labels are tightened so 8 tabs fit.
- Colour tokens for buy, hold and sell are added to `styles.css`.
