// Contact memory: what each person (recipient_hash, per Instagram account) and the assistant said, so a later
// conversation continues from where it stopped instead of starting over. Encrypted like the account tokens.
import {encryptToken,decryptToken} from './instagram-oauth.js';

const MAX_TURNS=24,MAX_TEXT=600;
let ready=false;
async function ensure(env){
 if(ready)return;
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS contact_memory (account_id TEXT NOT NULL, recipient_hash TEXT NOT NULL, encrypted_history TEXT NOT NULL, turns INTEGER NOT NULL DEFAULT 0, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY(account_id,recipient_hash))').run();
 ready=true;
}
export async function loadMemory(env,accountId,recipientHash){
 if(!env.DB||!env.TOKEN_ENCRYPTION_KEY||!recipientHash)return [];
 try{
  await ensure(env);
  const row=await env.DB.prepare('SELECT encrypted_history FROM contact_memory WHERE account_id=? AND recipient_hash=?').bind(accountId,recipientHash).first();
  return row?JSON.parse(await decryptToken(row.encrypted_history,env.TOKEN_ENCRYPTION_KEY)):[];
 }catch{return [];}
}
export async function remember(env,accountId,recipientHash,role,text){
 if(!env.DB||!env.TOKEN_ENCRYPTION_KEY||!recipientHash||typeof text!=='string'||!text.trim())return;
 try{
  const history=(await loadMemory(env,accountId,recipientHash)).concat({role,text:text.trim().slice(0,MAX_TEXT),at:Date.now()}).slice(-MAX_TURNS);
  const now=Date.now(),sealed=await encryptToken(JSON.stringify(history),env.TOKEN_ENCRYPTION_KEY);
  await env.DB.prepare('INSERT INTO contact_memory(account_id,recipient_hash,encrypted_history,turns,first_seen,last_seen) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,recipient_hash) DO UPDATE SET encrypted_history=excluded.encrypted_history,turns=contact_memory.turns+1,last_seen=excluded.last_seen').bind(accountId,recipientHash,sealed,1,now,now).run();
 }catch{/* memory is best effort: a failure never blocks the reply */}
}
// Plain transcript for the model, oldest first, trimmed to fit the prompt.
export function transcript(history,limit=1500){
 const lines=history.map(h=>{const when=new Date(h.at).toISOString().slice(0,10);return `[${when}] ${h.role==='user'?'Pessoa':'Atendente'}: ${h.text.replace(/\s+/g,' ')}`;});
 let out='';for(let i=lines.length-1;i>=0;i--){if(out.length+lines[i].length+1>limit)break;out=lines[i]+'\n'+out;}
 return out.trim();
}
