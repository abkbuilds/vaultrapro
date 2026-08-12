# Card Compass

Heres my file from bolt.new of my project, help me do the following improvements. Build a mobile-first TCG collecting app with an AI card scanner and comprehensive price tracking, inspired by Rare Candy and ALT from the App Store.

## Core Features

### 1. AI Card Scanner (Rare Candy-style)

- Use AI image recognition to identify PokémonHere’s a **complete, copy-paste-ready prompt** you can give to **bolt.new** to build an AI-powered card scanner and price tracker like **Rare Candy** + **ALT**, with all the features you described.

---

## 🧠 Full Prompt for bolt.new

```text

Build a mobile-first TCG collecting app with an AI card scanner and comprehensive price tracking, inspired by Rare Candy and ALT from the App Store.

## Core Features

### 1. AI Card Scanner (Rare Candy-style)

- Use AI image recognition to identify Pokémon cards from a photo (both English and Japanese).

- Support bulk scanning: user can tap once per card to scan quickly, with an optional auto-scan mode that captures cards as they’re lined up in view.

- After each scan, show:

  - Card name (in English, even for Japanese cards)

  - Set name and set number (e.g., “SV4P — 025”)

  - Card image thumbnail

  - Condition selector (Near Mint, Lightly Played, etc.)

  - “Add to Collection” and “Add to Wishlist” buttons

- Allow users to rotate through similar card versions (reverse holo, different rarities, promos) if the AI is unsure.

- Include a “Scan” bottom nav tab with a full-screen camera view, large capture button, and a small preview strip of recently scanned cards.

### 2. Complete Pokémon Card Database

- Preload the app with all existing English and Japanese Pokémon TCG cards.

- For every card, store:

  - English name (for Japanese cards, translate or use official English name)

  - Set name and set number

  - High-quality card image

  - Rarity, type, HP, and other metadata

- Provide a “Database” or “Browse” screen where users can:

  - Search by name, set, or number

  - Filter by language (English/Japanese), set, rarity, and type

  - View card details with price history and market data

### 3. Price Data Aggregation

Pull pricing data from multiple sources and combine them into unified graphs:

**English cards:**

- TCGPlayer (market price, low/mid/high)

- eBay sold listings (past day, week, month, 3 months, year)

- PriceCharting (historical averages)

**Japanese cards:**

- snkrdunk (buyback prices, listing prices, recent sales)

- eBay sold listings (same time windows as above)

- For each card’s detail screen, show:

  - A combined price graph with all sources overlaid (e.g., TCGPlayer in blue, eBay in green, snkrdunk in red, PriceCharting in orange).

  - Toggle buttons to show/hide individual sources.

  - Time range filters: 1 day, 1 week, 1 month, 3 months, 1 year, all time.

  - A table of recent listings/sales with date, source, condition, and price.

### 4. TCG Market Trends (ALT-style)

- Add a “Trends” or “Market” tab showing price trends for different TCGs (Pokémon, Magic, One Piece, Lorcana, etc.).

- For each TCG, display:

  - A line graph of the overall market index (average card value or total portfolio value) over the past week, month, 3 months, and year.

  - Top 10 gaining and losing cards in that TCG for each time window.

  - Weekly updates: fetch new data every week and update graphs automatically.

- Show a summary dashboard with:

  - “Hot TCGs this week” (biggest % gain in market index)

  - “Cooling TCGs” (biggest % drop)

### 5. User Collection & Portfolio

- Allow users to build a personal collection:

  - Add cards via scanner or manual search.

  - Track quantity, condition, and purchase price.

- Show a portfolio dashboard:

  - Total current value (sum of all cards using latest prices).

  - Portfolio value over time (line chart).

  - Top gainers/losers in the user’s collection.

  - Allocation by TCG (pie chart: Pokémon %, Magic %, etc.).

## Technical & Design Requirements

- Mobile-first responsive design (iOS/Android-like).

- Dark mode by default, with a modern, clean UI (dark background, bold accent colors like electric blue or purple).

- Use shadcn/ui components for buttons, cards, inputs, and charts.

- Use Recharts or Chart.js for all price graphs and trend lines.

- Organize code so it’s easy to plug in real APIs later (e.g., separate services for TCGPlayer, eBay, snkrdunk, PriceCharting).

- Include placeholder/mock data for all APIs so the app is fully functional in demo mode.

## Screens to Build

1. **Onboarding**: Brief intro to scanner, database, and price tracking.

2. **Home/Dashboard**: Portfolio value, value-over-time chart, top movers, recent activity.

3. **Scan**: Full-screen camera with AI scanner UI, recent scans strip, auto-scan toggle.

4. **Card Detail**: Large card image, metadata, combined price graph, recent listings table, add to collection/wishlist.

5. **Collection**: Grid of user’s cards with filters and search.

6. **Database**: Browse all cards with advanced filters.

7. **Trends/Market**: TCG market indices, top gainers/losers, time range toggles.

8. **Profile/Settings**: User account, connected marketplaces, notification preferences.

## Example API Integration Notes (for future dev)

- Use PokeTrace or Pokémon TCG API for card metadata.

- Use TCGPlayer API, eBay API, and PriceCharting (via scraping or partner API) for English card prices.

- Use snkrdunk data (via scraping or unofficial API) and eBay for Japanese card prices.

- For ALT-style trends, compute a weighted index of top cards in each TCG weekly.

Take visual and UX inspiration from:

- Rare Candy’s scanner speed, simplicity, and auto-scan mode.

- ALT’s clean market trend graphs and TCG index overview.

- Collectr’s portfolio dashboard and value tracking.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vaultrapro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2e68f372-b76b-4004-bfa4-a81e76faf004).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
