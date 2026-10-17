# Simpler, clearer Advisor

Rewrite the Advisor's wording in everyday language. The scoring and real data stay the same; only the words and layout change.

## What changes on screen
- **Labels in plain words**
  - "AI score" becomes "Score out of 100"; "conf." becomes "How sure: High / Medium / Low"
  - Badges: Strong Buy → "Great time to buy", Buy → "Good time to buy", Hold → "Keep it", Sell → "Think about selling", Strong Sell → "Good time to sell"
  - Risk: Safe → "Steady price", Caution → "Some ups and downs", High Risk → "Price jumps a lot"
  - "Next 30 days: +x% to +y%" becomes "Over the next month, the price could move between x% and y%"
  - "Thin trading" becomes "Not many people buy or sell this, so the price can change quickly"
- **Signal chips replaced by 3–4 short plain sentences**, shown only when there is real data, for example:
  - "Price is up 12% this month"
  - "Price is higher than usual right now"
  - "Sold 8 times in the last month"
  - "Price checked on 2 marketplaces"
  - Items with no data are hidden from the card instead of showing "no data" chips (one line "Some info isn't available yet" if any are missing).
- **Section titles**: "Top buys" → "Worth buying", "Top sells / avoids" → "Worth selling or skipping", "Top holds" → "Worth keeping"; "Track record" → "How past picks did", with columns "Time later", "Picks checked", "Went the right way", "Average change".
- **Short "How to read this" note** at the top, 2 lines, explaining the score and badges.
- **AI-written explanations** asked to use short sentences, everyday words, no jargon (no "volatility", "liquidity", "momentum", "technicals", "ROI"), 2–3 sentences max. Fallback text rewritten the same way.

## Technical details
- `src/routes/advisor.tsx`: label maps for recommendation/risk/confidence, new `plainReasons(signals)` helper built from existing signal scores/details, updated headings and track-record table.
- `src/lib/advisor/score.ts`: rewrite `factualThesis` and signal `detail` strings in plain English (numbers unchanged); update affected test expectations if any.
- `src/lib/advisor/advisor.server.ts`: update model instructions for plain, jargon-free wording.
- Scores, buckets and stored data are unchanged.
