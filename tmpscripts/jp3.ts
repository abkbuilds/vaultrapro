import { listEpisodes } from "../src/lib/prices/tcggo.server";
const eps = await listEpisodes("jp");
console.log(eps.filter(e=>/SV|S10/i.test(e.code ?? "")).map(e=>[e.id,e.code,e.name]));
