import { defineMcp } from "@lovable.dev/mcp-js";
import searchCards from "./tools/search-cards";
import getCard from "./tools/get-card";
import getCardPrices from "./tools/get-card-prices";
import topMovers from "./tools/top-movers";
import listSets from "./tools/list-sets";

export default defineMcp({
  name: "card-compass",
  title: "Card Compass",
  version: "0.1.0",
  instructions:
    "Public read-only tools over the Pokémon TCG catalogue (English and Japanese, including promos). Use list_sets to find a set, search_cards to find printings by name/set/number, get_card for full details, get_card_prices for source-backed quotes, history and recent sales, and top_movers for the biggest daily, weekly or monthly price moves. All prices are real recorded readings — never estimate or interpolate missing values.",
  tools: [searchCards, getCard, getCardPrices, topMovers, listSets],
});
