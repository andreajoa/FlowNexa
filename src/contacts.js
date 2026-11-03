// One contact per person in a workspace, across channels: website form, Instagram (and later WhatsApp).
// The contact id joins what the person said everywhere, so the assistant knows where they came from and what they asked.
import {encryptToken,decryptToken} from './instagram-oauth.js';
import {metaRequest} from './meta-client.js';

let ready=false;
async function ensure(env){
 if(ready)return;
 await env.DB.batch([
  env.DB.prepare('CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, encrypted_profile TEXT NOT NULL, email_hash TEXT, phone_hash TEXT, instagram_username TEXT, instagram_recipient_hash TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS contacts_ws_email ON contacts(workspace_id,email_hash)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS contacts_ws_instagram ON contacts(workspace_id,instagram_username)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS contacts_ws_recipient ON contacts(workspace_id,instagram_recipient_hash)'),
  env.DB.prepare('CREATE TABLE IF NOT EXISTS contact_events (id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, channel TEXT NOT NULL, encrypted_text TEXT NOT NULL, at INTEGER NOT NULL)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS contact_events_contact ON contact_events(contact_id,at)')
 ]);
 ready=true;
}
const sha=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
export const normalizeInstagram=v=>{const m=/^(?:https?:\/\/(?:www\.)?instagram\.com\/)?@?([A-Za-z0-9._]{1,30})\/?$/.exec(String(v||'').trim());return m?m[1].toLowerCase():null;};
const normalizePhone=v=>{const d=String(v||'').replace(/\D/g,'');return d.length>=10?d:null;};
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';

/** Website (or any other) lead: creates or updates the contact and records what the person wrote. */
export async function recordLead(env,workspaceId,lead){
 await ensure(env);
 const email=clean(lead.email,254).toLowerCase(),phone=normalizePhone(lead.phone),instagram=normalizeInstagram(lead.instagram);
 const message=clean(lead.message,3000);
 if(!email&&!phone&&!instagram)throw Error('lead_identity_required');
 const emailHash=email?await sha('email:'+email):null,phoneHash=phone?await sha('phone:'+phone):null;
 let row=await env.DB.prepare('SELECT * FROM contacts WHERE workspace_id=? AND ((email_hash IS NOT NULL AND email_hash=?) OR (phone_hash IS NOT NULL AND phone_hash=?) OR (instagram_username IS NOT NULL AND instagram_username=?)) ORDER BY created_at LIMIT 1').bind(workspaceId,emailHash,phoneHash,instagram).first();
 const now=Date.now();
 const profile={...(row?JSON.parse(await decryptToken(row.encrypted_profile,env.TOKEN_ENCRYPTION_KEY)):{}),...Object.fromEntries(Object.entries({name:clean(lead.name,100),email,phone:phone||'',city:clean(lead.city,100),interest:clean(lead.service,150),source:clean(lead.source,40)||'site'}).filter(([,v])=>v))};
 const sealed=await encryptToken(JSON.stringify(profile),env.TOKEN_ENCRYPTION_KEY);
 if(row)await env.DB.prepare('UPDATE contacts SET encrypted_profile=?,email_hash=COALESCE(?,email_hash),phone_hash=COALESCE(?,phone_hash),instagram_username=COALESCE(?,instagram_username),updated_at=? WHERE id=?').bind(sealed,emailHash,phoneHash,instagram,now,row.id).run();
 else{row={id:crypto.randomUUID()};await env.DB.prepare('INSERT INTO contacts(id,workspace_id,encrypted_profile,email_hash,phone_hash,instagram_username,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(row.id,workspaceId,sealed,emailHash,phoneHash,instagram,now,now).run();}
 const summary=['Enviou pelo formulário do site',profile.interest&&'interesse: '+profile.interest,profile.city&&'cidade: '+profile.city].filter(Boolean).join(' · ')+(message?'. Mensagem: '+message:'');
 await env.DB.prepare('INSERT INTO contact_events(id,contact_id,channel,encrypted_text,at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),row.id,clean(lead.source,40)||'site',await encryptToken(summary,env.TOKEN_ENCRYPTION_KEY),now).run();
 return {contact_id:row.id,linked_instagram:instagram};
}

/** On an Instagram conversation: find (or attach) the person's contact by their @ username. Best effort. */
export async function contactForInstagram(env,account,senderId,recipientHash){
 try{
  await ensure(env);
  let row=await env.DB.prepare('SELECT * FROM contacts WHERE workspace_id=? AND instagram_recipient_hash=? LIMIT 1').bind(account.workspace_id,recipientHash).first();
  if(row)return row;
  const profile=await metaRequest(env,account,`${encodeURIComponent(senderId)}?fields=username,name`);
  const username=normalizeInstagram(profile?.username);
  if(!username)return null;
  row=await env.DB.prepare('SELECT * FROM contacts WHERE workspace_id=? AND instagram_username=? LIMIT 1').bind(account.workspace_id,username).first();
  if(row){await env.DB.prepare('UPDATE contacts SET instagram_recipient_hash=?,updated_at=? WHERE id=?').bind(recipientHash,Date.now(),row.id).run();return {...row,instagram_recipient_hash:recipientHash};}
  const now=Date.now(),id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO contacts(id,workspace_id,encrypted_profile,instagram_username,instagram_recipient_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,account.workspace_id,await encryptToken(JSON.stringify({name:clean(profile?.name,100),source:'instagram'}),env.TOKEN_ENCRYPTION_KEY),username,recipientHash,now,now).run();
  return {id,workspace_id:account.workspace_id,instagram_username:username,instagram_recipient_hash:recipientHash};
 }catch{return null;}
}

/** What the person said on other channels (website form, WhatsApp), as memory entries for the assistant. */
export async function otherChannelHistory(env,workspaceId,recipientHash){
 try{
  await ensure(env);
  const row=await env.DB.prepare('SELECT id,encrypted_profile FROM contacts WHERE workspace_id=? AND instagram_recipient_hash=? LIMIT 1').bind(workspaceId,recipientHash).first();
  if(!row)return {events:[],profile:null};
  const profile=JSON.parse(await decryptToken(row.encrypted_profile,env.TOKEN_ENCRYPTION_KEY));
  const events=(await env.DB.prepare("SELECT channel,encrypted_text,at FROM contact_events WHERE contact_id=? AND channel<>'instagram' ORDER BY at DESC LIMIT 6").bind(row.id).all()).results;
  const out=[];for(const e of events.reverse())out.push({role:'user',text:'('+(e.channel==='site'?'formulário do site':e.channel)+') '+await decryptToken(e.encrypted_text,env.TOKEN_ENCRYPTION_KEY),at:e.at});
  return {events:out,profile,contactId:row.id};
 }catch{return {events:[],profile:null};}
}
