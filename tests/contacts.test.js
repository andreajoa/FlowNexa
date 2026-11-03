import test from 'node:test';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {recordLead,contactForInstagram,otherChannelHistory,normalizeInstagram} from '../src/contacts.js';
const KEY='a'.repeat(64);
test('instagram handle from form input: @, URL or plain name',()=>{
 assert.equal(normalizeInstagram('@Maria.Silva'),'maria.silva');
 assert.equal(normalizeInstagram('https://www.instagram.com/maria_silva/'),'maria_silva');
 assert.equal(normalizeInstagram('não tenho'),null);
});
test('a website lead and the same person on Instagram become one contact; the form message reaches the assistant',async()=>{
 const db=identityDatabase(),env={DB:db,TOKEN_ENCRYPTION_KEY:KEY};
 const lead=await recordLead(env,'ws1',{name:'Maria',email:'Maria@Example.com',instagram:'@maria.silva',city:'Santos',service:'Reforço escolar',message:'Meu filho de 8 anos tem dificuldade na leitura.',source:'site'});
 assert.ok(lead.contact_id);
 // Same e-mail again joins the same contact.
 assert.equal((await recordLead(env,'ws1',{email:'maria@example.com',message:'Segunda mensagem'})).contact_id,lead.contact_id);
 // The person writes on Instagram: the @ resolved from the Graph API links them.
 const {encryptToken}=await import('../src/instagram-oauth.js');
 const account={id:'acc',workspace_id:'ws1',status:'connected',token_expires_at:Math.floor(Date.now()/1000)+99999,encrypted_token:await encryptToken('IGAAtoken',KEY)};
 const asked=[];env.META_FETCH=async url=>{asked.push(String(url));return Response.json({username:'Maria.Silva',name:'Maria S'});};
 const linked=await contactForInstagram(env,account,'123456','hashX');
 assert.equal(linked.id,lead.contact_id);assert.match(asked[0],/123456\?fields=username/);
 // Next time the link is already known: no Graph call.
 await contactForInstagram(env,account,'123456','hashX');assert.equal(asked.length,1);
 const other=await otherChannelHistory(env,'ws1','hashX');
 assert.equal(other.profile.name,'Maria');
 assert.equal(other.events.length,2);
 assert.match(other.events[0].text,/formulário do site.*Reforço escolar.*leitura/);
 // Another workspace never sees it.
 assert.equal((await otherChannelHistory(env,'ws2','hashX')).events.length,0);
});
