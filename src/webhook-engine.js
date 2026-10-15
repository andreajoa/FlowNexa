// Validated Instagram webhook events are converted to inert, auditable flow executions.
// Outbound Meta API calls are intentionally not made until messaging permissions
// and delivery behavior have been validated in a real test environment.
const string = value => typeof value === "string" ? value : "";
export function parseInstagramEvents(payload) {
  const events=[];
  if (!payload || payload.object !== "instagram" || !Array.isArray(payload.entry)) return events;
  for (const entry of payload.entry) {
    if (!entry || typeof entry !== "object") continue;
    const accountId=String(entry.id || "");
    if (!accountId) continue;
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      if (change?.field !== "comments") continue;
      const v=change.value || {};
      const id=String(v.id || "");
      if (!id || !string(v.text) || !v.media?.id) continue;
      events.push({sourceId:"comment:"+id,accountId,triggerType:"comment",media_id:String(v.media.id),text:v.text});
    }
    for (const message of Array.isArray(entry.messaging) ? entry.messaging : []) {
      const msg=message?.message;
      const id=String(msg?.mid || "");
      if (!id || !string(msg?.text) || msg.is_echo) continue;
      events.push({sourceId:"dm:"+id,accountId,triggerType:"dm",media_id:null,text:msg.text});
    }
  }
  return events;
}
function matches(flow,event,config) {
  if (event.triggerType==="comment" && !["comment_any","comment_keyword"].includes(flow.trigger_type)) return false;
  if (event.triggerType==="dm" && flow.trigger_type!=="dm_keyword") return false;
  if(flow.scope==="selected" && !(Array.isArray(config.media_ids) && config.media_ids.includes(event.media_id)))return false;
  if(flow.scope==="next")return false; // next-post scheduling needs an explicit implementation
  if(flow.trigger_type.endsWith("_keyword")) {
    const normalized=value=>String(value).normalize("NFKC").toLocaleUpperCase("pt-BR");
    if(!Array.isArray(config.keywords)||!config.keywords.some(x=>string(x).trim()&&normalized(event.text).includes(normalized(x))))return false;
  }
  return true;
}
export async function processInstagramWebhook(db,payload) {
  const events=parseInstagramEvents(payload);
  let matched=0, logged=0;
  for(const event of events) {
    const account=await db.prepare("SELECT id,workspace_id FROM instagram_accounts WHERE ig_user_id=? AND status='connected'").bind(event.accountId).first();
    if(!account)continue;
    const flows=await db.prepare("SELECT id,trigger_type,scope,configuration FROM flows WHERE account_id=? AND workspace_id=? AND enabled=1").bind(account.id,account.workspace_id).all();
    for(const flow of flows.results || []) {
      let config;
      try {config=JSON.parse(flow.configuration)} catch {continue}
      if(!matches(flow,event,config))continue;
      matched++;
      const id=crypto.randomUUID();
      const result=await db.prepare("INSERT OR IGNORE INTO execution_log(id,flow_id,event_id,status,error) VALUES (?,?,?,'draft_only',NULL)").bind(id,flow.id,event.sourceId).run();
      if(result.meta?.changes)logged++;
    }
  }
  return {events:events.length,matched,logged,mode:"draft_only"};
}
