import fs from 'node:fs';
import assert from 'node:assert/strict';
// Fichiers XML officiels Ciqual 2025, déposés dans .expo/nutrition-data (non publiés).
const root='.expo/nutrition-data/';
const decode=s=>s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0]==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&(amp|quot|apos|lt|gt);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[n]);
const field=(s,key)=>decode(s.match(new RegExp(`<${key}>([\\s\\S]*?)</${key}>`))?.[1]?.trim()??'');
const foods=new Map([...fs.readFileSync(root+'alim.xml','utf8').matchAll(/<ALIM>([\s\S]*?)<\/ALIM>/g)].map(m=>{const id=field(m[1],'alim_code');return [id,[id,field(m[1],'alim_nom_fr'),null,null,null,null,null]];}));
const columns={'328':2,'25003':3,'31000':4,'40000':5,'34100':6};
for(const match of fs.readFileSync(root+'compo_2025_11_03.xml','utf8').matchAll(/<COMPO>([\s\S]*?)<\/COMPO>/g)) {
  const column=columns[field(match[1],'const_code')];if(column===undefined)continue;
  const row=foods.get(field(match[1],'alim_code'));if(!row)continue;
  const raw=field(match[1],'teneur').replace(',','.');
  // Traces, seuils < et valeurs absentes restent inconnus, jamais remplacés par zéro.
  row[column]=/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):null;
}
const rows=[...foods.values()];assert.equal(rows.length,3484);assert(rows.every(r=>r[1]&&r.slice(2).every((v,i)=>v===null||v>=0&&v<=(i===0?1000:100))));
fs.mkdirSync('src/nutrition',{recursive:true});fs.writeFileSync('src/nutrition/ciqual.json',JSON.stringify(rows));
fs.writeFileSync('src/nutrition/sources.json',JSON.stringify({ciqual:{title:'Anses. 2025. Table de composition nutritionnelle Ciqual 2025.',url:'https://doi.org/10.5281/zenodo.17550133',foods:rows.length,nutrients:['328','25003','31000','40000','34100'],note:'Valeurs pour 100 g ; traces et seuils non quantifiés conservés inconnus.'},off:{title:'Open Food Facts — ODbL',url:'https://world.openfoodfacts.org/terms-of-use'}},null,2));
console.log(`Ciqual : ${rows.length} aliments, ${fs.statSync('src/nutrition/ciqual.json').size} octets.`);
