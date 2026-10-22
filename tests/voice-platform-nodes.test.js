import test from 'node:test';
import assert from 'node:assert/strict';
import {identityDatabase} from './identity-helper.js';
import {validateGraph} from '../src/conversation-graph.js';
import {validateFlow} from '../src/flow-runtime.js';
import {consumeVoiceQuota} from '../src/voice-quotas.js';
import {zernioSend} from '../src/zernio-client.js';
import {cloudflareWorkspaceReply} from '../src/cloudflare-ai.js';
import {previewConversation} from '../src/app-client.js';
const inbound=(instructions)=>({version:1,start:'hear',nodes:[{id:'hear',type:'transcribe_audio',next:'answer'},{id:'answer',type:'ai_reply',instructions,next:'end'},{id:'end',type:'end'}]});
test('public voice blocks validate and preview without affecting existing flows',()=>{
 const a=inbound('Respond as our shop assistant, in English.');
 assert.equal(validateGraph(a).ok,true);
 assert.equal(validateFlow('story_reply','all',{entry_points:['dm'],graph:a}).ok,true);
 assert.equal(previewConversation(a).at(-1).type,'end');
 assert.equal(validateGraph(inbound(' ')).ok,false);
 assert.equal(validateGraph(inbound('x'.repeat(1201))).ok,false);
 const b={version:1,start:'welcome',nodes:[{id:'welcome',type:'message',text:'Here is our recording',next:'play'},{id:'play',type:'audio',url:'https://cdn.example.com/voice.mp3',next:'end'},{id:'end',type:'end'}]};
 assert.equal(validateGraph(b).ok,true);
 b.nodes[1].url='http://localhost/admin';assert.equal(validateGraph(b).ok,false);
});
test('transcription quotas are per workspace and deny excessive use',async t=>{
 const db=identityDatabase();t.after(()=>db.close());
 for(let n=0;n<20;n++)await consumeVoiceQuota({DB:db},'tenant-1','transcription');
 await assert.rejects(()=>consumeVoiceQuota({DB:db},'tenant-1','transcription'),/voice_free_quota_exhausted/);
 assert.equal(await consumeVoiceQuota({DB:db},'tenant-2','transcription'),true);
});
test('workspace instructions stay isolated and Cloudflare-only',async()=>{
 const prompts=[];
 const env={CLOUDFLARE_AI_ONLY:'true',CLOUDFLARE_AI_ENABLED:'true',CLOUDFLARE_AI_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_AI_TOKEN:'testing-token-only-not-real',OPENAI_API_KEY:'unused',CLOUDFLARE_AI_FETCH:async(url,opts)=>{
  assert.match(String(url),/api.cloudflare.com/);
  const body=JSON.parse(opts.body);prompts.push(body.messages);
  return Response.json({success:true,result:{response:body.messages[0].content.includes('florist')?'Florist response':'Pharmacy response'}});
 }};
 assert.equal(await cloudflareWorkspaceReply(env,'You serve the florist.','When is delivery?'),'Florist response');
 assert.equal(await cloudflareWorkspaceReply(env,'You serve the pharmacy.','Where are you?'),'Pharmacy response');
 assert.equal(prompts.length,2);
 assert(!prompts[0][0].content.includes('pharmacy'));
 assert(!prompts[1][0].content.includes('florist'));
 await assert.rejects(()=>cloudflareWorkspaceReply({...env,CLOUDFLARE_AI_ONLY:'false'},'Answer','Hi'),/workspace_ai_unconfigured/);
});
test('audio attachments are real Zernio sends, without a misleading WhatsApp voice-note flag',async()=>{
 let body;
 const account={ig_user_id:'zernio:acc123',status:'connected'};
 const env={ZERNIO_API_KEY:'test-only-key',ZERNIO_FETCH:async(_url,opts)=>{body=JSON.parse(opts.body);return Response.json({messageId:'sent-id'});}};
 const message={kind:'dm',sender_id:'123',conversation_id:'conv456',at:Date.now()};
 assert.equal(await zernioSend(env,account,message,{type:'audio',url:'https://cdn.example.com/audio.mp3'}),'sent-id');
 assert.equal(body.attachmentType,'audio');
 assert.equal(body.attachmentUrl,'https://cdn.example.com/audio.mp3');
 assert.equal(body.voiceNote,undefined);
});
