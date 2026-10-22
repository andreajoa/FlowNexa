import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeIncomingVoice} from '../src/voice-transcription.js';
import {generatePaulReply,shouldUsePaul} from '../src/paul-replies.js';
import {normalizeZernio} from '../src/zernio-webhook.js';
import {normalizeWebhook} from '../src/flow-runtime.js';
const now=new Date().toISOString();
test('Zernio inbound audio retains signed media reference for secure transcription',()=>{
  const item=normalizeZernio({event:'message.received',account:{platform:'instagram'},conversation:{id:'conv1'},message:{platform:'instagram',direction:'incoming',sender:{id:'123'},platformMessageId:'message123',sentAt:now,text:null,attachments:[{type:'audio',url:'https://lookaside.fbsbx.com/file.m4a',mimeType:'audio/mp4'}]}},{ig_user_id:'zernio:abc',platform_user_id:'999'});
  assert.equal(item.length,1);assert.equal(item[0].audio_url,'https://lookaside.fbsbx.com/file.m4a');
  assert.equal(item[0].text,'');
});
test('Meta inbound voice note is recognized instead of discarded',()=>{
  const item=normalizeWebhook({object:'instagram',entry:[{id:'999',messaging:[{sender:{id:'123'},timestamp:Date.now(),message:{mid:'m1',attachments:[{type:'audio',payload:{url:'https://lookaside.fbsbx.com/a.ogg'}}]}}]}]});
  assert.equal(item[0]?.audio_url,'https://lookaside.fbsbx.com/a.ogg');
});
test('voice transcription sends bounded file to speech service and returns transcript',async()=>{
  let calls=0;
  const text=await transcribeIncomingVoice({audio_url:'https://lookaside.fbsbx.com/voice.m4a',audio_mime_type:'audio/mp4'},{
    VOICE_TRANSCRIPTION_ENABLED:'true',OPENAI_API_KEY:'fake-for-test',
    VOICE_MEDIA_FETCH:async(url)=>{calls++;assert.match(String(url),/fbsbx/);return new Response(new Uint8Array(256),{status:200,headers:{'content-type':'audio/mp4'}});},
    OPENAI_FETCH:async(url,options)=>{calls++;assert.match(String(url),/audio\/transcriptions/);assert.equal(options.body.get('model'),'gpt-transcribe');assert.equal(options.body.get('file').name,'voice-note.m4a');return Response.json({text:'I am having trouble sleeping after my breakup.'});}
  });
  assert.equal(calls,2);assert.match(text,/trouble sleeping/);
});
test('reject unsafe URLs and disabled transcriptions',async()=>{
  await assert.rejects(transcribeIncomingVoice({audio_url:'https://example.com/private.ogg'},{VOICE_TRANSCRIPTION_ENABLED:'true',OPENAI_API_KEY:'fake'}),/unsafe_audio_url/);
  await assert.rejects(transcribeIncomingVoice({audio_url:'https://lookaside.fbsbx.com/file.ogg'},{VOICE_TRANSCRIPTION_ENABLED:'false'}),/transcription_unconfigured/);
});
test('Paul responds to content, without making up a menu',async()=>{
  assert.equal(shouldUsePaul('paul_en',{kind:'dm',text:'Hi'},'hello'),true);
  assert.equal(shouldUsePaul('paul_en',{kind:'dm',text:'help'},'crisis'),false);
  const reply=await generatePaulReply({OPENAI_API_KEY:'fake-for-test',PAUL_ASSISTANT_ENABLED:'true',OPENAI_FETCH:async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.match(body.input[1].content,/sleep/i);return Response.json({output:[{content:[{type:'output_text',text:'That sounds difficult. What tends to keep you awake?'}]}]});}},{text:'I cannot sleep.'});
  assert.match(reply,/awake/);
});

test('Vercel AI Gateway can transcribe voice without an external API key',async()=>{
  const env={
    VOICE_TRANSCRIPTION_ENABLED:'true',AI_GATEWAY_ENABLED:'true',
    VOICE_MEDIA_FETCH:async()=>new Response(new Uint8Array(256),{status:200,headers:{'content-type':'audio/webm'}}),
    VOICE_GATEWAY_TRANSCRIBE:async args=>{
      assert.equal(args.model.modelId,'xai/grok-stt');
      assert.equal(args.audio.byteLength,256);
      return {text:'I would like to know more about Gilberto.'};
    }
  };
  const {voiceReady}=await import('../src/voice-transcription.js');
  assert.equal(voiceReady(env),true);
  const transcript=await transcribeIncomingVoice({audio_url:'https://scontent.cdninstagram.com/recording.webm'},env);
  assert.match(transcript,/Gilberto/);
});
test('Vercel AI Gateway can respond as Paul without an external provider key',async()=>{
  const {paulReady}=await import('../src/paul-replies.js');
  const env={AI_GATEWAY_ENABLED:'true',PAUL_ASSISTANT_ENABLED:'true',PAUL_GATEWAY_GENERATE:async args=>{
    assert.equal(args.model,'openai/gpt-5-mini');
    assert.match(args.prompt,/book/);
    assert.match(args.system,/assistant for Gilberto/);
    return {text:"Hey, I'm Paul. Gilberto's book is about rebuilding after betrayal. What would you like to know?"};
  }};
  assert.equal(paulReady(env),true);
  const answer=await generatePaulReply(env,{text:'Can you tell me about the book?'});
  assert.match(answer,/Gilberto/);
});

test('Workers AI Whisper and Llama operate in strict zero-paid-fallback mode',async()=>{
  const {voiceReady}=await import('../src/voice-transcription.js');
  const {paulReady}=await import('../src/paul-replies.js');
  const urls=[];
  const env={
    CLOUDFLARE_AI_ONLY:'true',CLOUDFLARE_AI_ENABLED:'true',
    CLOUDFLARE_AI_ACCOUNT_ID:'7ef2450965811249288bc35188f7cbf9',
    CLOUDFLARE_AI_TOKEN:'fake-cloudflare-token-1234567',
    VOICE_TRANSCRIPTION_ENABLED:'true',PAUL_ASSISTANT_ENABLED:'true',
    OPENAI_API_KEY:'must-not-call-paid-provider',AI_GATEWAY_ENABLED:'true',
    VOICE_MEDIA_FETCH:async()=>new Response(new Uint8Array(384),{status:200,headers:{'content-type':'audio/ogg'}}),
    CLOUDFLARE_AI_FETCH:async(url,req)=>{
      urls.push(url);
      assert.equal(req.headers.authorization,'Bearer fake-cloudflare-token-1234567');
      if(url.endsWith('/@cf/openai/whisper')){
        assert.equal(req.headers['content-type'],'application/octet-stream');
        assert.equal(req.body.byteLength,384);
        return Response.json({success:true,result:{text:'I am looking for the book'}});
      }
      if(url.endsWith('/@cf/meta/llama-3.1-8b-instruct-fp8')){
        const data=JSON.parse(req.body);
        assert.match(data.messages[0].content,/assistant for Gilberto/);
        assert.match(data.messages[1].content,/book/);
        return Response.json({success:true,result:{response:"Hi, I'm Paul. What would you like to know about Gilberto's book?"}});
      }
      assert.fail('unexpected external model');
    }
  };
  assert.equal(voiceReady(env),true);
  assert.equal(paulReady(env),true);
  const transcript=await transcribeIncomingVoice({audio_url:'https://lookaside.fbsbx.com/voice.ogg'},env);
  const reply=await generatePaulReply(env,{text:transcript});
  assert.match(reply,/Gilberto/);
  assert.equal(urls.length,2);
  assert(urls.every(url=>url.startsWith('https://api.cloudflare.com/')));
});

test('free-only mode blocks both AI services without a Cloudflare credential even with paid keys set',async()=>{
  const {voiceReady}=await import('../src/voice-transcription.js');
  const {paulReady}=await import('../src/paul-replies.js');
  const env={CLOUDFLARE_AI_ONLY:'true',VOICE_TRANSCRIPTION_ENABLED:'true',PAUL_ASSISTANT_ENABLED:'true',OPENAI_API_KEY:'dont-use-me'};
  assert.equal(voiceReady(env),false);
  assert.equal(paulReady(env),false);
  await assert.rejects(transcribeIncomingVoice({audio_url:'https://lookaside.fbsbx.com/voice.ogg'},env),/transcription_unconfigured/);
  await assert.rejects(generatePaulReply(env,{text:'Hello'}),/paul_unconfigured/);
});

test('Workers AI over-limit response never falls back to a billable provider',async()=>{
  const env={CLOUDFLARE_AI_ONLY:'true',CLOUDFLARE_AI_ENABLED:'true',CLOUDFLARE_AI_ACCOUNT_ID:'7ef2450965811249288bc35188f7cbf9',CLOUDFLARE_AI_TOKEN:'fake-cloudflare-token-1234567',PAUL_ASSISTANT_ENABLED:'true',OPENAI_API_KEY:'should-not-be-used',CLOUDFLARE_AI_FETCH:async()=>new Response('{}',{status:429})};
  await assert.rejects(generatePaulReply(env,{text:'Hello'}),/cloudflare_ai_request_failed_429/);
});
