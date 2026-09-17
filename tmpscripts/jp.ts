import { tcggoLookup } from "../src/lib/prices/tcggo.server";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
const { data } = await sb.from("tcg_cards").select("id,name,number,set_code").eq("language","JP").is("market_price",null).order("id").limit(5);
for (const r of (data ?? []) as any[]) console.log(r.id, "|", r.set_code, "|", r.number, "=>", await tcggoLookup({id:r.id,name:r.name,number:r.number,setCode:r.set_code,language:"JP"}));
