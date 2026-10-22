import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {identityDatabase} from './identity-helper.js';
import {encryptToken,decryptToken} from '../src/instagram-oauth.js';
import {enqueueWebhook,processPending} from '../src/automation-engine.js';
import {processConversations} from '../src/conversation-runtime.js';

test('tenant-scoped audio to Cloudflare transcript to generic IA reply reaches Instagram',async t=>{
 const db=identityDatabase();t.after(()=>db.close());
 for(const file of ['0005_runtime.sql','0008_conversations.sql'])db.sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 db.sqlite.exec("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('u','test@example.test','unused',1);INSERT INTO workspaces(id,name,owner_id) VALUES('tenant1','Bakery','u'),('tenant2','Other','u')");
 const env={DB:db,TOKEN_ENCRYPTION_KEY:'a'.repeat(64),MESSAGING_ENABLED:'true',META_APP_ID:'app',META_APP_SECRET:'secret',META_WEBHOOK_SECRET:'test',CLOUDFLARE_AI_ONLY:'true',CLOUDFLARE_AI_ENABLED:'true',CLOUDFLARE_AI_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_AI_TOKEN:'fake-for-test-only-not-real',VOICE_TRANSCRIPTION_ENABLED:'true'};
 for(const [id,w,ig] of [['account1','tenant1','100'],['account2','tenant2','101']]){
  await db.prepare("INSERT INTO instagram_accounts(id,workspace_id,username,ig_user_id,encrypted_token,token_expires_at,status) VALUES(?,?,?,?,?,?,'connected')").bind(id,w,id,ig,await encryptToken('meta-mock',env.TOKEN_ENCRYPTION_KEY),Math.floor(Date.now()/1000)+3600).run();
 }
 const graph={version:1,start:'hear',nodes:[{id:'hear',type:'transcribe_audio',next:'answer'},{id:'answer',type:'ai_reply',instructions:'You are the bakery assistant. Reply about cakes only.',next:'end'},{id:'end',type:'end'}]};
 await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('bakeryflow','tenant1','account1','Bakery voice','story_reply','all',?,1)").bind(JSON.stringify({entry_points:['dm'],reply_per_message:true,graph})).run();
 await db.prepare("INSERT INTO flows(id,workspace_id,account_id,name,trigger_type,scope,configuration,enabled) VALUES('otherflow','tenant2','account2','No voice','story_reply','all',?,1)").bind(JSON.stringify({entry_points:['dm'],graph:{version:1,start:'hello',nodes:[{id:'hello',type:'message',text:'Hello',next:'end'},{id:'end',type:'end'}]}})).run();
 let transcriptionCount=0;const sent=[];const prompts=[];
 env.VOICE_MEDIA_FETCH=async()=>new Response(new Uint8Array(256),{status:200,headers:{'content-type':'audio/ogg'}});
 env.CLOUDFLARE_AI_FETCH=async(url,opts)=>{
   if(String(url).endsWith('/@cf/openai/whisper')){transcriptionCount++;return Response.json({success:true,result:{text:'How much is a cake?'}});}
   prompts.push(JSON.parse(opts.body).messages);
   return Response.json({success:true,result:{response:'We can discuss a cake order. Which size?'}});
 };
 env.META_FETCH=async(_url,opts)=>{sent.push(JSON.parse(opts.body));return Response.json({message_id:'m'+sent.length});};
 const audio=(ig,mid)=>({object:'instagram',entry:[{id:ig,messaging:[{sender:{id:'200'},timestamp:Date.now(),message:{mid,attachments:[{type:'audio',payload:{url:'https://lookaside.fbsbx.com/recording.ogg'}}]}}]}]});
 assert.equal(await enqueueWebhook(audio('101','skip-no-node'),env),0);
 assert.equal(await enqueueWebhook(audio('100','bakery-note'),env),1);
 await processPending(env);await processConversations(env);
 assert.equal(transcriptionCount,1);
 assert.equal(sent.length,1);
 assert.equal(sent[0].message.text,'We can discuss a cake order. Which size?');
 assert.equal(prompts.length,1);
 assert.match(prompts[0][0].content,/bakery assistant/);
 assert.doesNotMatch(prompts[0][0].content,/Gilberto|Paul/);
 const encrypted=(await db.prepare("SELECT encrypted_event FROM automation_events WHERE account_id='account1'").first()).encrypted_event;
 const stored=JSON.parse(await decryptToken(encrypted,env.TOKEN_ENCRYPTION_KEY));
 assert.equal(stored.text,'How much is a cake?');assert.equal(stored.interaction,'audio_transcribed');assert.equal(stored.audio_url,undefined);
});
