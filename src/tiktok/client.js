// All state is tied to a workspace generation, including asynchronous callbacks.
export function createTikTokClient({api,post,getWorkspace,getGeneration,openGraph}){
 const host=document.getElementById('tiktok-channel');let epoch=0;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const messages={tiktok_flow_conflict:'Já existe uma automação publicada para esse tipo de evento nesta conta. Pause a anterior ou inclua novos caminhos nela.',tiktok_timeout_must_end:'No TikTok, o prazo de espera deve levar ao bloco Encerrar.',tiktok_not_configured:'A conexão TikTok ainda precisa ser configurada pelo responsável pelo FlowNexa.',tiktok_permissions_missing:'Autorize as permissões solicitadas pelo TikTok e tente novamente.',tiktok_sends_disabled:'Você pode salvar rascunhos. Os envios ainda aguardam liberação.',tiktok_flow_changed:'Esta automação mudou. Atualize a lista antes de editar.',tiktok_account_already_connected:'Esta conta já pertence a outro espaço.',tiktok_one_message_per_reply:'Use uma mensagem por etapa, seguida de aguardar resposta ou encerrar.',tiktok_unsupported_node:'Neste canal use mensagem de texto, aguardar resposta, condição e encerrar.',tiktok_comment_wait_unsupported:'Comentários recebem uma resposta pública. Use mensagens privadas para conversas com várias etapas.'};
 function reset(){epoch++;host.replaceChildren(el('h2','TikTok'),el('p','Carregando conexão…','muted'));}
 async function load(){
  reset();const ticket=epoch,workspace=getWorkspace(),generation=getGeneration();if(!workspace)return;
  const current=()=>ticket===epoch&&workspace===getWorkspace()&&generation===getGeneration();
  const query='?workspace='+encodeURIComponent(workspace);let status,accounts=[],flows=[];
  const report=el('p',undefined,'status');report.hidden=true;report.setAttribute('role','status');report.setAttribute('aria-live','polite');
  const tell=e=>{if(current()){report.hidden=false;report.textContent=typeof e==='string'?e:messages[e.code]||e.message;}};
  const action=(label,task,write=true)=>{const b=el('button',label,'secondary');b.type='button';b.disabled=write&&!status?.can_manage;b.addEventListener('click',async()=>{if(!current())return;b.disabled=true;try{await task();}catch(e){tell(e);}finally{if(current())b.disabled=write&&!status?.can_manage;}});return b;};
  const request=(path,body={})=>post('/api/tiktok'+path,{...body,workspace_id:workspace});
  try{status=await api('/api/tiktok/status'+query);}catch(e){if(current())host.replaceChildren(el('h2','TikTok'),el('p',e.message));return;}
  if(!current())return;
  host.replaceChildren(el('h2','TikTok · Conversas e comentários'),el('p','Conecte sua conta e prepare respostas para quem entrar em contato com sua empresa.','muted'),report);
  host.append(el('p','Para mensagens privadas, use uma conta TikTok Business elegível, com recebimento de mensagens ativado. Contas criadas no Espaço Econômico Europeu, Reino Unido ou Suíça não têm acesso a mensagens por esta integração.','notice'));
  host.append(el('p','O cliente inicia a conversa. As respostas privadas devem ocorrer em até 48 horas; o FlowNexa limita a dez respostas por conversa nesse período. Comentários recebem respostas públicas. Publique uma automação de mensagens e uma de comentários por conta; organize as variações no editor visual.','muted'));
  if(!status.enabled){tell(messages.tiktok_not_configured);return;}
  if(!status.sends_enabled)host.append(el('p',messages.tiktok_sends_disabled,'notice'));
  const connect=async id=>{const r=await request('/connect',id?{reconnect_id:id}:{});if(!current())return;const url=new URL(r.authorization_url);if(url.protocol!=='https:'||url.username||url.password||!['zernio.com','www.zernio.com','tiktok.com','www.tiktok.com','business-api.tiktok.com','business.tiktok.com'].includes(url.hostname))throw Error('Não foi possível abrir uma autorização segura.');location.assign(url.href);};
  const controls=el('div',undefined,'row');controls.append(action('Conectar TikTok',()=>connect()),action('Atualizar TikTok',load,false));host.append(controls);
  const accountsHost=el('div'),flowsHost=el('div'),editorHost=el('div'),activityHost=el('div');host.append(el('h3','Contas conectadas'),accountsHost,el('h3','Automações do TikTok'),flowsHost,editorHost,el('h3','Atividade'),activityHost);
  const labels={dm_any:'Toda mensagem privada',dm_keyword:'Palavra-chave na mensagem privada',comment_any:'Todo comentário novo',comment_keyword:'Palavra-chave no comentário'};
  function field(parent,label,value='',textarea=false){const l=el('label',label),input=el(textarea?'textarea':'input');input.value=value;l.append(input);parent.append(l);return input;}
  function select(parent,label,options,value){const l=el('label',label),s=el('select');for(const[key,text]of options){const o=el('option',text);o.value=key;s.append(o);}if(value)s.value=value;l.append(s);parent.append(l);return s;}
  function editor(flow){
   editorHost.replaceChildren();if(!status.can_manage||!accounts.some(a=>a.status==='connected'))return;
   const form=el('form',undefined,'flow-item');form.addEventListener('submit',e=>e.preventDefault());form.append(el('h3',flow?'Editar automação':'Nova automação'));
   const name=field(form,'Nome da automação',flow?.name||''),account=select(form,'Conta TikTok',accounts.filter(a=>a.status==='connected'||a.id===flow?.account_id).map(a=>[a.id,a.name]),flow?.account_id),trigger=select(form,'Quando responder',Object.entries(labels),flow?.trigger_type),keywords=field(form,'Palavras-chave, separadas por vírgula',(flow?.keywords||[]).join(', '));
   name.maxLength=100;account.disabled=!!flow;
   const text=field(form,'Resposta de texto',flow?.graph.nodes.find(n=>n.type==='message')?.text||'',true);text.maxLength=1000;
   form.append(el('p','Salvar mantém a automação como rascunho. Depois, publique ou abra o editor visual para montar uma conversa. PARAR, SAIR, CANCELAR e STOP interrompem as respostas privadas.','muted'));
   form.append(action('Salvar rascunho',async()=>{const data={name:name.value,account_id:account.value,trigger_type:trigger.value,keywords:keywords.value.split(',').map(x=>x.trim()).filter(Boolean),graph:{version:1,start:'message',nodes:[{id:'message',type:'message',text:text.value,next:'end'},{id:'end',type:'end'}]},...(flow?{version:flow.version}:{})};await request('/flows'+(flow?'/'+encodeURIComponent(flow.id):''),data);if(current()){await refresh();editor();tell('Rascunho salvo.');}}));editorHost.append(form);
  }
  function graph(flow){
   let latest=flow;
   openGraph({id:flow.id,name:flow.name,trigger_type:flow.trigger_type,configuration:{graph:flow.graph}}, {name:'TikTok',allowedNodes:flow.trigger_type.startsWith('comment')?['message','condition','switch','end']:['message','wait_reply','condition','switch','end'],note:'TikTok: uma mensagem por etapa. Aguardar resposta continua apenas após uma nova mensagem do cliente; o prazo expira sem enviar lembretes. Salvar pausa a publicação.',
    save:async data=>{if(!current())throw Error('O espaço mudou. Reabra a automação.');const r=await request('/flows/'+encodeURIComponent(latest.id),{...latest,name:data.name,graph:data.graph,version:latest.version});latest=r.flow;await refresh();return latest.id;},
    publish:async()=>{if(!current())throw Error('O espaço mudou.');latest=(await request('/flows/'+encodeURIComponent(latest.id)+'/publish',{version:latest.version})).flow;await refresh();},
    pause:async()=>{if(!current())throw Error('O espaço mudou.');latest=(await request('/flows/'+encodeURIComponent(latest.id)+'/pause',{version:latest.version})).flow;await refresh();}
   });
  }
  async function refresh(){
   const [a,f,e]=await Promise.all([api('/api/tiktok/accounts'+query),api('/api/tiktok/flows'+query),api('/api/tiktok/executions'+query)]);if(!current())return;accounts=a.accounts;flows=f.flows;
   accountsHost.replaceChildren();if(!accounts.length)accountsHost.append(el('p','Nenhuma conta TikTok conectada.','muted'));
   for(const a of accounts){const row=el('div',undefined,'flow-item row');row.append(el('strong',a.name),el('span',a.status==='connected'?'Conectada':'Reconexão necessária','badge'));if(status.can_manage){if(a.status!=='connected')row.append(action('Reconectar',()=>connect(a.id)));row.append(action('Desconectar',async()=>{if(!confirm('Desconectar esta conta e pausar suas automações do TikTok?'))return;await request('/accounts/'+encodeURIComponent(a.id)+'/disconnect');await refresh();if(current())editor();}));}accountsHost.append(row);}
   flowsHost.replaceChildren();if(!flows.length)flowsHost.append(el('p','Crie sua primeira resposta abaixo.','muted'));
   for(const flow of flows){const row=el('article',undefined,'flow-item');row.append(el('strong',flow.name),el('p',labels[flow.trigger_type]+' · '+(flow.enabled?'Publicada':'Rascunho / pausada')));if(status.can_manage){row.append(action('Editar conversa',async()=>graph(flow)));if(flow.graph.nodes.length===2)row.append(action('Editar resposta e gatilho',async()=>editor(flow)));const publish=action(flow.enabled?'Pausar':'Publicar',async()=>{await request('/flows/'+encodeURIComponent(flow.id)+(flow.enabled?'/pause':'/publish'),{version:flow.version});await refresh();});publish.disabled=!flow.enabled&&!status.sends_enabled;row.append(publish);}flowsHost.append(row);}
   const states={pending:'Na fila',sending:'Enviando',accepted:'Aceita pelo provedor',unknown:'Entrega a confirmar — confira a conversa no TikTok',failed:'Falha no envio',cancelled:'Cancelada'};
   const reasons={tiktok_reply_limit:'Limite de respostas da conversa atingido.',message_window_expired:'Prazo de 48 horas encerrado.',contact_opted_out:'O cliente pediu para parar.',flow_changed:'Automação alterada ou pausada.',account_disconnected:'Conta desconectada.',provider_rejected:'O provedor recusou o envio. Confira as permissões e a elegibilidade da conta.',account_reconnect_required:'Reconecte sua conta.',rate_limited:'O provedor pediu uma pausa; a fila tentará novamente.',billing_message_limit:'Limite de mensagens do plano atingido.'};
   activityHost.replaceChildren();if(!e.executions.length)activityHost.append(el('p','Nenhuma resposta registrada ainda.','muted'));for(const job of e.executions){const row=el('div',undefined,'flow-item');row.append(el('strong',flows.find(f=>f.id===job.flow_id)?.name||'Automação'),el('p',states[job.status]||job.status));if(job.error)row.append(el('p',reasons[job.error]||'Confira a conexão e a conversa antes de tentar novamente.','muted'));activityHost.append(row);}
  }
  try{await refresh();if(current()){editor();const q=new URLSearchParams(location.search);if(q.has('tiktok_connected'))tell('Conta TikTok conectada. Prepare sua primeira automação.');if(q.has('tiktok_error'))tell(messages[q.get('tiktok_error')]||'Não foi possível conectar. Confira as permissões da conta e tente novamente.');}}catch(e){tell(e);}
 }
 return{load,reset};
}
