import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

export type AccessStatus = 'pending'|'approved'|'denied'|'blocked';
export type Identity = { id:string; email:string; sessionId:string };
export const tokenHash = (value:string) => createHash('sha256').update(value).digest('hex');
export function isAdministrator(user:Pick<Identity,'id'|'email'>) {
  return !!process.env.ADMIN_USER_ID && user.id === process.env.ADMIN_USER_ID && user.email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
}
export function accessStore(connection:string) {
  const sql=neon(connection);
  return {
    async ensure(user:Pick<Identity,'id'|'email'>) {
      const admin=isAdministrator(user);
      const created=await sql`INSERT INTO training_access(user_id,email,status) VALUES (${user.id},${user.email.toLowerCase()},${admin?'approved':'pending'}) ON CONFLICT(user_id) DO NOTHING RETURNING user_id`;
      if(admin) await sql`UPDATE training_access SET status='approved',email=${user.email.toLowerCase()} WHERE user_id=${user.id} AND (status<>'approved' OR email<>${user.email.toLowerCase()})`;
      return {created:created.length>0,admin};
    },
    async read(id:string) {const [row]=await sql`SELECT status, version FROM training_access WHERE user_id=${id}`;return row as {status:AccessStatus;version:number}|undefined;},
    async count() {const [row]=await sql`SELECT count(*)::int AS count FROM training_access WHERE status='pending'`;return Number(row.count);},
    async summary() {const [row]=await sql`SELECT count(*)::int AS count,coalesce(max(requested_at)::text,'') AS revision FROM training_access WHERE status='pending'`;return {count:Number(row.count),revision:String(row.revision)};},
    async list() {return await sql`SELECT user_id AS id,email,status FROM training_access WHERE user_id<>${process.env.ADMIN_USER_ID??''} ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,requested_at DESC LIMIT 500`;},
    async decide(id:string,decision:'approved'|'denied',actor:string,expected:AccessStatus) {
      if(id===process.env.ADMIN_USER_ID) return false;
      const rows=await sql`UPDATE training_access SET status=${decision==='denied'&&expected==='approved'?'blocked':decision},decided_at=now(),decided_by=${actor},version=version+1 WHERE user_id=${id} AND status=${expected} RETURNING user_id`;
      return rows.length>0;
    },
    async attempt(id:string) {
      const [row]=await sql`INSERT INTO training_admin_attempts(user_id,attempts) VALUES (${id},1) ON CONFLICT(user_id) DO UPDATE SET attempts=CASE WHEN training_admin_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE training_admin_attempts.attempts+1 END,window_start=CASE WHEN training_admin_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE training_admin_attempts.window_start END RETURNING attempts`;
      return Number(row.attempts)<=5;
    },
    async clearAttempts(id:string) {await sql`DELETE FROM training_admin_attempts WHERE user_id=${id}`;},
    async unlock(id:string,sessionId:string,token:string) {
      await sql.transaction([
        sql`DELETE FROM training_admin_sessions WHERE expires_at<now()`,
        sql`INSERT INTO training_admin_sessions(token_hash,user_id,auth_session,expires_at) VALUES (${tokenHash(token)},${id},${tokenHash(sessionId)},now()+interval '15 minutes')`,
      ]);
    },
    async unlocked(user:Identity,token:string) {
      if(!/^[a-f0-9]{64}$/.test(token)) return false;
      const rows=await sql`SELECT 1 FROM training_admin_sessions WHERE token_hash=${tokenHash(token)} AND user_id=${user.id} AND auth_session=${tokenHash(user.sessionId)} AND expires_at>now()`;
      return rows.length>0;
    },
    async lock(token:string) {await sql`DELETE FROM training_admin_sessions WHERE token_hash=${tokenHash(token)}`;},
    async subscribe(id:string,subscription:unknown,endpoint:string) {
      await sql`INSERT INTO training_admin_push(endpoint_hash,user_id,subscription) VALUES (${tokenHash(endpoint)},${id},${JSON.stringify(subscription)}::jsonb) ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=excluded.user_id,subscription=excluded.subscription`;
      await sql`DELETE FROM training_admin_push WHERE user_id=${id} AND endpoint_hash NOT IN (SELECT endpoint_hash FROM training_admin_push WHERE user_id=${id} ORDER BY created_at DESC LIMIT 10)`;
    },
    async subscriptions() {return await sql`SELECT endpoint_hash,subscription FROM training_admin_push WHERE user_id=${process.env.ADMIN_USER_ID??''} LIMIT 10`;},
    async unsubscribe(id:string,endpoint:string) {await sql`DELETE FROM training_admin_push WHERE user_id=${id} AND endpoint_hash=${tokenHash(endpoint)}`;},
    async removePush(hash:string) {await sql`DELETE FROM training_admin_push WHERE endpoint_hash=${hash}`;},
  };
}
