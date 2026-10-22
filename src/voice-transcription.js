// Convert an authorized voice note into text before routing the conversation.
const LIMIT=12*1024*1024;
export async function transcribeIncomingVoice(event, env) {
  if (!event?.audio_url) throw Error('audio_missing');
  if (env.VOICE_TRANSCRIPTION_ENABLED!=='true'||!env.OPENAI_API_KEY) throw Error('transcription_unconfigured');
  const url=new URL(event.audio_url);
  const host=url.hostname.toLowerCase();
  const allow=['fbcdn.net','fbsbx.com','cdninstagram.com'];
  if(url.protocol!=='https:'||url.username||url.password||url.port||!allow.some(d=>host===d||host.endsWith('.'+d))) throw Error('unsafe_audio_url');
  const response=await (env.VOICE_MEDIA_FETCH||fetch)(url,{redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok||Number(response.headers.get('content-length'))>LIMIT) throw Error('audio_download_failed');
  const reader=response.body?.getReader();if(!reader)throw Error('audio_invalid');
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();throw Error('audio_too_large');}chunks.push(value);}
  if(size<128)throw Error('audio_empty');
  const bytes=new Uint8Array(size);let offset=0;
  for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  const mime=event.audio_mime_type||response.headers.get('content-type')||'application/octet-stream';
  const ext=mime.includes('webm')?'webm':mime.includes('wav')?'wav':mime.includes('mpeg')?'mp3':mime.includes('mp4')?'m4a':'ogg';
  const form=new FormData();form.set('model','gpt-transcribe');form.set('file',new Blob([bytes],{type:mime}), 'voice-note.'+ext);
  const result=await (env.OPENAI_FETCH||fetch)('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+env.OPENAI_API_KEY},body:form,redirect:'error',signal:AbortSignal.timeout(14000)});
  if(!result.ok)throw Error('transcription_failed');
  const data=await result.json();
  if(typeof data.text!=='string'||!data.text.trim()||data.text.length>8000)throw Error('transcription_empty');
  return data.text.trim();
}
