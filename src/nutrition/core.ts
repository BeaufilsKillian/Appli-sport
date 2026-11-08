export const nutrients = ['kcal','protein','carbs','fat','fiber'] as const;
export type Nutrient = typeof nutrients[number];
export type Nutrition = Record<Nutrient, number | null>;
export type Food = { name: string; brand: string; unit: 'g'|'ml'; barcode: string; source: 'personal'|'ciqual'|'off'; sourceId: string; per100: Nutrition };
export type Ingredient = { food: Food; amount: number };
export type Recipe = { name: string; ingredients: Ingredient[]; finalWeight: number };
export type Entry = { date: string; slot: string; food: Food; amount: number };
export type Goals = { targets: Record<Nutrient,number>; mode: 'manual'|'estimated'; profile?: EstimateProfile };
export type EstimateProfile = { age: number; weight: number; height: number; sex: 'male'|'female'; activity: number; goal: 'maintain'|'lose'|'gain'; targetWeight: number; healthyAdult: boolean };
export type NutritionValue = Food | Recipe | Entry | Goals;
export const emptyNutrition = (): Nutrition => ({kcal:null,protein:null,carbs:null,fat:null,fiber:null});
const object = (value: unknown): Record<string,unknown> => { if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('Données nutritionnelles invalides.'); return value as Record<string,unknown>; };
const text = (value: unknown, max=250): string => { if(typeof value!=='string'||value.length>max) throw Error('Texte alimentaire invalide.'); return value.trim(); };
const number = (value: unknown, min: number, max: number): number => { if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max) throw Error('Quantité nutritionnelle invalide.'); return value; };
export const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date+'T12:00:00Z')) && new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
export function parseFood(input: unknown): Food {
  const value=object(input), name=text(value.name), source=text(value.source), per=object(value.per100);
  if(!name||!['personal','ciqual','off'].includes(source)||!['g','ml'].includes(String(value.unit))) throw Error('Aliment invalide.');
  if(source==='ciqual'&&value.unit!=='g')throw Error('Les valeurs Ciqual sont données pour 100 g.');
  const barcode=text(value.barcode,14); if(barcode&&!/^\d{8,14}$/.test(barcode)) throw Error('Code-barres invalide.');
  const per100=Object.fromEntries(nutrients.map(key=>[key,per[key]===null?null:number(per[key],0,key==='kcal'?1000:100)])) as Nutrition;
  return {name,brand:text(value.brand),unit:value.unit as Food['unit'],barcode,source:source as Food['source'],sourceId:text(value.sourceId),per100};
}
export function parseNutrition(key: string, input: unknown): NutritionValue | null {
  if(!/^(food|recipe|entry):[a-zA-Z0-9_-]{1,100}$/.test(key)&&key!=='goals:current') throw Error('Identifiant nutritionnel invalide.');
  if(input===null) return null;
  if(new TextEncoder().encode(JSON.stringify(input)).length>64000) throw Error('Élément nutritionnel trop volumineux.');
  const value=object(input);
  if(key.startsWith('food:')) return parseFood(value);
  if(key.startsWith('entry:')) {
    const date=text(value.date,10); if(!validDate(date)) throw Error('Date invalide.');
    const slot=text(value.slot,40); if(!['Petit-déjeuner','Déjeuner','Dîner','Collation'].includes(slot)) throw Error('Repas invalide.');
    return {date,slot,food:parseFood(value.food),amount:number(value.amount,.1,100000)};
  }
  if(key.startsWith('recipe:')) {
    if(!Array.isArray(value.ingredients)||value.ingredients.length<1||value.ingredients.length>100) throw Error('Ajoute 1 à 100 ingrédients.');
    const name=text(value.name); if(!name)throw Error('Nomme ton repas.');
    const ingredients=value.ingredients.map(input=>{const item=object(input);const food=parseFood(item.food);if(food.unit!=='g')throw Error('Pour une recette pesée, utilise des ingrédients en grammes.');return {food,amount:number(item.amount,.1,100000)};});
    return {name,ingredients,finalWeight:number(value.finalWeight,.1,100000)};
  }
  const targets=object(value.targets);
  if(!['manual','estimated'].includes(String(value.mode))) throw Error('Mode d’objectif invalide.');
  const result: Goals={mode:value.mode as Goals['mode'],targets:Object.fromEntries(nutrients.map(key=>[key,number(targets[key],key==='kcal'?1:0,key==='kcal'?10000:key==='fiber'?100:1500)])) as Goals['targets']};
  if(result.mode==='estimated') { result.profile=parseProfile(value.profile); const computed=estimateGoals(result.profile);if(nutrients.some(key=>result.targets[key]!==computed.targets[key]))throw Error('Objectifs estimés incohérents. Recalcule-les.'); }
  return result;
}
export function sumNutrition(items: Ingredient[]) {
  const values={kcal:0,protein:0,carbs:0,fat:0,fiber:0}; const missing=new Set<Nutrient>();
  for(const item of items) for(const key of nutrients) { const value=item.food.per100[key]; if(value===null)missing.add(key);else values[key]+=value*item.amount/100; }
  return {values,missing};
}
export function recipeFood(recipe: Recipe): Food {
  const {values,missing}=sumNutrition(recipe.ingredients);
  return {name:recipe.name,brand:'Repas maison',unit:'g',barcode:'',source:'personal',sourceId:'',per100:Object.fromEntries(nutrients.map(key=>[key,missing.has(key)?null:values[key]*100/recipe.finalWeight])) as Nutrition};
}
export function parseProfile(input: unknown): EstimateProfile {
  const value=object(input);
  if(!['male','female'].includes(String(value.sex))||!['maintain','lose','gain'].includes(String(value.goal))||value.healthyAdult!==true)throw Error('L’estimation est réservée aux adultes en bonne santé, hors grossesse/allaitement. Utilise des objectifs manuels sinon.');
  return {age:number(value.age,18,80),weight:number(value.weight,35,300),height:number(value.height,120,230),sex:value.sex as EstimateProfile['sex'],activity:number(value.activity,1.2,1.9),goal:value.goal as EstimateProfile['goal'],targetWeight:number(value.targetWeight,35,300),healthyAdult:true};
}
export function estimateGoals(input: EstimateProfile): Goals {
  const p=parseProfile(input), bmi=p.weight/(p.height/100)**2, targetBmi=p.targetWeight/(p.height/100)**2;
  if(bmi<18.5||bmi>35||targetBmi<18.5||targetBmi>35)throw Error('Pour ce poids, préfère des objectifs définis avec un professionnel.');
  if(p.goal==='lose'&&p.targetWeight>=p.weight||p.goal==='gain'&&p.targetWeight<=p.weight)throw Error('Le poids cible doit correspondre à ton objectif.');
  const resting=10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:-161);
  const kcal=Math.round(resting*p.activity*(p.goal==='lose'?.9:p.goal==='gain'?1.05:1)/10)*10;
  if(kcal<(p.sex==='male'?1500:1200)||kcal>6000)throw Error('Cette estimation nécessite un objectif personnalisé avec un professionnel.');
  const protein=Math.round(p.weight*1.6),fat=Math.round(kcal*.35/9),fiber=30;
  const carbs=Math.round((kcal-protein*4-fat*9-fiber*2)/4);
  if(carbs<0)throw Error('Répartition nutritionnelle incompatible.');
  return {mode:'estimated',profile:p,targets:{kcal,protein,fat,fiber,carbs}};
}
export function normalizeBarcode(input: string): string {
  let code=input.trim();
  if(/^https:\/\//i.test(code)) {const url=new URL(code); const match=url.pathname.match(/\/01\/(\d{8,14})(?:\/|$)/); if(!match)throw Error('Ce QR code ne contient pas de code alimentaire GS1 reconnu.');code=match[1];}
  if(!/^(?:\d{8}|\d{12,14})$/.test(code))throw Error('Indique un code-barres EAN/UPC ou un QR GS1 alimentaire.');
  let sum=0; for(let i=code.length-2,position=0;i>=0;i--,position++)sum+=Number(code[i])*(position%2===0?3:1);
  if((10-sum%10)%10!==Number(code.at(-1)))throw Error('Le code-barres est incomplet ou incorrect.');
  return code;
}
export function offFood(product: Record<string,unknown>): Food {
  const n=object(product.nutriments??{});
  const quantity=String(product.product_quantity_unit??'').toLowerCase();
  const liquid=['ml','cl','dl','l'].includes(quantity)||(!quantity&&/\d\s*(?:ml|cl|dl|l)\b/i.test(String(product.quantity??'')))||product.nutrition_data_per==='100ml';
  const name=product.product_name_fr||product.product_name||product.generic_name;
  const localized=name&&typeof name==='object'?name as Record<string,unknown>:null;
  // La base peut omettre les fibres : une absence n'est jamais un zéro.
  const read=(key:string)=>typeof n[key]==='number'&&Number.isFinite(n[key])&&Number(n[key])>=0?Number(n[key]):null;
  const kcal=read('energy-kcal_100g')??(read('energy_100g')!==null?Number(read('energy_100g'))/4.184:null);
  return parseFood({name:localized?(localized.fr||localized.main||localized.en||'Produit sans nom'):name||'Produit sans nom',brand:Array.isArray(product.brands)?product.brands.join(', '):product.brands??'',unit:liquid?'ml':'g',barcode:String(product.code??''),source:'off',sourceId:String(product.code??''),per100:{kcal,protein:read('proteins_100g'),carbs:read('carbohydrates_100g'),fat:read('fat_100g'),fiber:read('fiber_100g')}});
}
