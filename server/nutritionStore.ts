import { neon } from '@neondatabase/serverless';
import type { NutritionValue } from '../src/nutrition/core.js';
export function nutritionStore(connection: string) {
  const sql=neon(connection);
  return {
    async pull(owner: string,after: number) {
      const rows=await sql`SELECT key,payload,revision FROM training_nutrition WHERE owner_id=${owner} AND revision>${after} ORDER BY revision LIMIT 21`;
      const changes=rows.slice(0,20).map(row=>({...row,revision:Number(row.revision)}));
      return {changes,cursor:changes.at(-1)?.revision??after,more:rows.length>20};
    },
    async save(owner: string,key: string,base: number,payload: NutritionValue|null) {
      // Le verrou de la tête sérialise les commits et les curseurs d'un même compte.
      // shortcut: 50 000 identifiants conservés par compte, prévoir l'archivage au-delà.
      const [,rows]=await sql.transaction([
        sql`INSERT INTO training_nutrition_heads(owner_id,revision) VALUES (${owner},1) ON CONFLICT(owner_id) DO UPDATE SET revision=training_nutrition_heads.revision+1`,
        sql`INSERT INTO training_nutrition(owner_id,key,payload,revision)
          SELECT ${owner},${key},${payload===null?null:JSON.stringify(payload)}::jsonb,revision FROM training_nutrition_heads
          WHERE owner_id=${owner} AND (${base}=0 OR EXISTS(SELECT 1 FROM training_nutrition WHERE owner_id=${owner} AND key=${key} AND revision=${base}))
          AND (EXISTS(SELECT 1 FROM training_nutrition WHERE owner_id=${owner} AND key=${key}) OR (SELECT count(*) FROM training_nutrition WHERE owner_id=${owner})<50000)
          ON CONFLICT(owner_id,key) DO UPDATE SET payload=excluded.payload,revision=excluded.revision WHERE training_nutrition.revision=${base}
          RETURNING key,payload,revision`,
      ]);
      return rows[0]?{...rows[0],revision:Number(rows[0].revision)}:null;
    },
  };
}
