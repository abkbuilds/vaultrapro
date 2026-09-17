import { tcggoLookup, listEpisodes } from "../src/lib/prices/tcggo.server";
import { createClient } from "@supabase/supabase-js";
const eps = await listEpisodes("jp");
console.log("jp episodes:", eps.length, "has E1:", eps.some(e=>e.code?.toUpperCase()==="E1"));
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
for (const code of ["SV1A","S10B","SV8"]) {
  const { data } = await sb.from("tcg_cards").select("id,name,number,set_code,market_price").eq("language","JP").eq("set_code",code).limit(2);
  for (const r of (data ?? []) as any[]) console.log(r.id, r.set_code, r.number, "=>", await tcggoLookup({id:r.id,name:r.name,number:r.number,setCode:r.set_code,language:"JP"}));
}
