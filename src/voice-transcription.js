// Voice-note transcription: never answer an attachment until its speech is understood.
import {transcribe} from 'ai';
import {gateway} from '@ai-sdk/gateway';
const LIMIT=12*1024*1024;
const CDN=['fbcdn.net','fbsbx.com','cdninstagram.com'];
export const voiceReady=env=>env.VOICE_TRANSCRIPTION_ENABLED==='true'&&Boolean(env.OPENAI_API_KEY||env.AI_GATEWAY_ENABLED==='true');
function mediaURL(raw){
  let url;try{url=new URL(raw);}catch{throw Error('unsafe_audio_url');}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port||!CDN.some(d=>host===d||host.endsWith('.'+d)))throw Error('unsafe_audio_url');
  return url;
}
async function downloadAudio(url,env){
  const resp=await(env.VOICE_MEDIA_FETCH||fetch)(url,{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!resp.ok||Number(resp.headers.get('content-length'))>LIMIT)throw Error('audio_download_failed');
  const reader=resp.body?.getReader();if(!reader)throw Error('audio_invalid');
  let count=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>LIMIT){await reader.cancel();throw Error('audio_too_large');}chunks.push(value);}
  if(count<128)throw Error('audio_empty');
  const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return {bytes,mime:resp.headers.get('content-type')};
}
export async function transcribeIncomingVoice(event,env){
  if(!event?.audio_url)throw Error('audio_missing');
  if(!voiceReady(env))throw Error('transcription_unconfigured');
  const {bytes,mime}=await downloadAudio(mediaURL(event.audio_url),env);
  let text;
  if(env.OPENAI_API_KEY){
    const type=event.audio_mime_type||mime||'application/octet-stream';
    const ext=type.includes('webm')?'webm':type.includes('wav')?'wav':type.includes('mpeg')?'mp3':type.includes('mp4')?'m4a':'ogg';
    const form=new FormData();form.set('model','gpt-transcribe');form.set('file',new Blob([bytes],{type}), 'voice-note.'+ext);
    const result=await(env.OPENAI_FETCH||fetch)('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+env.OPENAI_API_KEY},body:form,redirect:'error',signal:AbortSignal.timeout(16000)});
    if(!result.ok)throw Error('transcription_failed');
    text=(await result.json().catch(()=>null))?.text;
  }else{
    // On Vercel the AI Gateway uses a short-lived OIDC token, not a provider API key.
    const result=await(env.VOICE_GATEWAY_TRANSCRIBE||transcribe)({
      model:gateway.transcriptionModel(env.VOICE_GATEWAY_MODEL||'xai/grok-stt'),
      audio:bytes,maxRetries:0,abortSignal:AbortSignal.timeout(16000),
      telemetry:{isEnabled:false}
    });
    text=result?.text;
  }
  if(typeof text!=='string'||!text.trim()||text.length>8000)throw Error('transcription_empty');
  return text.trim();
}
