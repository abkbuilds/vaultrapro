/**
 * Outlier rejection for chart series.
 *
 * The marketplace feeds occasionally publish a single mis-keyed asking price
 * (e.g. $688 on a card whose every other reading sits between $28 and $92).
 * Those readings are not market observations, so they are dropped from the
 * curve rather than drawn. Nothing is invented or smoothed: every remaining
 * point is still a real, dated, source-backed reading.
 */

export interface DatedPoint {
  date: string;
  value: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : ((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Removes readings far away from the series' own median.
 *
 * @param factor how many times the median a reading may be before it is
 *               treated as a mis-listing (and the same ratio below it).
 * @param minPoints below this many readings there is no reliable median, so
 *                  everything is kept.
 */
export function dropOutliers(
  points: DatedPoint[],
  { factor = 5, minPoints = 4 }: { factor?: number; minPoints?: number } = {},
): DatedPoint[] {
  if (points.length < minPoints) return points;
  const med = median(points.map((p) => p.value));
  if (!(med > 0)) return points;
  const kept = points.filter((p) => p.value <= med * factor && p.value * factor >= med);
  // Never empty a series out — if the guard rejects nearly everything the
  // median itself is unreliable, so leave the readings untouched.
  return kept.length >= Math.max(2, Math.ceil(points.length / 2)) ? kept : points;
}
