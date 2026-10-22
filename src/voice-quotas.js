import {sha} from './identity.js';
// The existing auth_rate_limits store already has atomic counters: no migration or tenant-wide mutable config.
// Limits are deliberately conservative for an account sharing a 10k-neuron Workers Free allocation.
const LIMITS={transcription:{tenant:20,global:150},ai_reply:{tenant:40,global:250}};
export async function consumeVoiceQuota(env,workspaceId,kind){
  if(!env.DB||typeof workspaceId!=='string'||!workspaceId.trim()||!LIMITS[kind])throw Error('voice_quota_unavailable');
  const day=Math.floor(Date.now()/86400000)*86400;
  const limits=LIMITS[kind];
  for(const [scope,limit] of [['tenant:'+workspaceId,limits.tenant],['global',limits.global]]){
    const key=await sha('flownexa-voice-free:'+kind+':'+scope);
    // Reserve the quota before invoking an external model. Counters include failed attempts.
    // ON CONFLICT increments only inside the current UTC day, atomic across concurrent callers.
    const row=await env.DB.prepare(`INSERT INTO auth_rate_limits(key_hash,window_start,attempts) VALUES (?,?,1)
      ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts`)
      .bind(key,day).first();
    if(!row||row.attempts>limit)throw Error('voice_free_quota_exhausted');
  }
  return true;
}
