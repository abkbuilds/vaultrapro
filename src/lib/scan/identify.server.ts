/**
 * AI card identification (server-only).
 *
 * A photo of a card is sent to the Lovable AI gateway (Gemini vision) which
 * reads the printed name, set symbol/number and language directly off the
 * card — no guessing, no random picks. The model returns structured JSON that
 * the client then matches against the real catalogue.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface IdentifiedCard {
  name: string | null;
  /** Printed collector number, e.g. "025" or "TG05". */
  number: string | null;
  /** Printed set code / abbreviation, e.g. "SV4a". */
  setCode: string | null;
  setName: string | null;
  language: "EN" | "JP" | null;
  confidence: number;
  notes: string | null;
}

const SYSTEM = `You identify Pokémon trading cards from photographs.
Read ONLY what is printed on the card. Never invent a card.
- name: the Pokémon/Trainer/Energy name in ENGLISH (translate Japanese names to their official English name, keep suffixes like "ex", "VMAX", "V", "GX").
- number: the collector number exactly as printed, without the total (e.g. "025/165" -> "025").
- setCode: the printed set abbreviation/expansion code if visible (e.g. "SV4a", "MEW", "S12a"), else null.
- setName: expansion name if legible, else null.
- language: "JP" if the card text is Japanese, otherwise "EN".
- confidence: 0-1, how sure you are of the name AND number.
If the image does not contain a readable trading card, return every field null with confidence 0.
Respond with JSON only.`;

const schema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    number: { type: ["string", "null"] },
    setCode: { type: ["string", "null"] },
    setName: { type: ["string", "null"] },
    language: { type: ["string", "null"], enum: ["EN", "JP", null] },
    confidence: { type: "number" },
    notes: { type: ["string", "null"] },
  },
  required: ["name", "number", "setCode", "setName", "language", "confidence"],
  additionalProperties: false,
} as const;

export async function identifyCardImage(imageDataUrl: string): Promise<IdentifiedCard> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Identify this card." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "card", strict: true, schema },
      },
    }),
  });

  if (res.status === 429) throw new Error("Scanner is busy — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`Identification failed (${res.status})`);

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<IdentifiedCard>;
  try {
    parsed = JSON.parse(raw) as Partial<IdentifiedCard>;
  } catch {
    parsed = {};
  }

  return {
    name: parsed.name?.trim() || null,
    number: parsed.number?.trim() || null,
    setCode: parsed.setCode?.trim() || null,
    setName: parsed.setName?.trim() || null,
    language: parsed.language === "JP" ? "JP" : parsed.name ? "EN" : null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    notes: parsed.notes?.trim() || null,
  };
}
