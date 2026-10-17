import { describe, expect, it } from "vitest";
import { confidenceFor, recommendationFor, riskFor, scoreItem } from "./score";

describe("advisor scoring rules", () => {
  it("maps score bands to recommendations", () => {
    expect(recommendationFor(80)).toBe("Strong Buy");
    expect(recommendationFor(60)).toBe("Buy");
    expect(recommendationFor(50)).toBe("Hold");
    expect(recommendationFor(30)).toBe("Sell");
    expect(recommendationFor(10)).toBe("Strong Sell");
  });

  it("assigns risk bands from volatility and liquidity", () => {
    expect(riskFor(3, 80)).toBe("Safe");
    expect(riskFor(8, 80)).toBe("Caution");
    expect(riskFor(15, 80)).toBe("High Risk");
    expect(riskFor(3, 10)).toBe("High Risk");
    expect(riskFor(null, 80)).toBe("Caution");
  });

  it("raises confidence with data coverage and history depth", () => {
    expect(confidenceFor(0, 7, 0)).toBe(35);
    expect(confidenceFor(7, 7, 30)).toBe(100);
  });

  it("never invents a return range without real volatility", () => {
    const r = scoreItem({
      price: 10, change7d: 5, change30d: 10, change90d: null, volatility: null,
      readings: 5, sales30d: 0, sources: 1, vsAvg30: null, gradedMultiple: null,
    });
    expect(r.expectedReturnMin).toBeNull();
    expect(r.signals.sentiment.score).toBeNull();
  });
});
