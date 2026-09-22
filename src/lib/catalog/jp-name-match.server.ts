/**
 * Matches vintage Japanese cards to their real TCGplayer product photo.
 *
 * Old Japanese groups on tcgcsv carry no collector number and only English
 * product names, while our rows only hold the printed Japanese name. The model
 * is used purely to line the two *existing* lists up — it never invents a card,
 * a name or an image: every answer must be one of the supplied product names.
 */

interface MatchInput {
  setName: string;
  cards: { id: string; number: string; name: string }[];
  productNames: string[];
}

export async function matchJapaneseNames(
  input: MatchInput,
): Promise<Record<string, string>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || !input.cards.length || !input.productNames.length) return {};

  const prompt = [
    `Japanese Pokémon TCG set: ${input.setName}.`,
    "",
    "Products available in this set (English names, pick only from this list):",
    ...input.productNames.map((n) => `- ${n}`),
    "",
    "Cards to match (collector number and printed Japanese name):",
    ...input.cards.map((c) => `${c.number} | ${c.name}`),
    "",
    'Return JSON: {"matches":[{"number":"003","product":"<exact product name>"}]}.',
    "Only include a card when you are confident it is the same card. Omit the",
    "card entirely when unsure. Never invent product names.",
  ].join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as { matches?: { number?: string; product?: string }[] };
    const allowed = new Set(input.productNames);
    const byNumber = new Map(input.cards.map((c) => [c.number, c.id]));
    const out: Record<string, string> = {};
    for (const m of parsed.matches ?? []) {
      const id = m.number ? byNumber.get(String(m.number)) : undefined;
      if (id && m.product && allowed.has(m.product)) out[id] = m.product;
    }
    return out;
  } catch (e) {
    console.error("jp name match failed", e);
    return {};
  }
}
