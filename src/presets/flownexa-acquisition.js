// Original FlowNexa acquisition conversation. No provider credentials or invented claims.
export function buildFlowNexaAcquisition({opening,baseUrl='https://flownex.online'}={}){
 if(typeof opening!=='string'||!opening.trim()||opening.length>1000)throw Error('original_opening_required');
 const asset=name=>baseUrl+'/assets/funnel/'+name,app=baseUrl+'/app#signup',pdf=asset('flownexa-guia-direct.pdf');
 const button=(title,payload)=>({type:'postback',title,payload});
 const wait=(id,on_reply,on_timeout='finish',extra={})=>({id,type:'wait_reply',timeout_seconds:259200,on_reply,on_timeout,on_timeout_without_window:on_timeout,...extra});
 const choiceCases=()=>[{id:'demo',label:'Conhecer a FlowNexa',value:'DEMO',next:'mechanism'},{id:'guide',label:'Receber o guia',value:'GUIA',next:'guide'},{id:'migration',label:'Já usa automação',value:'MIGRAR',next:'migration'}];
 const menuButtons=()=>[button('Como funciona','DEMO'),button('Quero o guia','GUIA'),button('Já uso automação','MIGRAR')];
 const nodes=[
  {id:'welcome',type:'message',text:opening,next:'first_wait'},
  wait('first_wait','attention','reminder',{timeout_seconds:3600,on_timeout_without_window:'silent_wait',deadline_seconds_from_start:259200}),
  {id:'reminder',type:'message',text:'Passando só mais uma vez 🙂 Quer ver como um comentário pode virar uma conversa com a FlowNexa? Responda QUERO e eu mostro um exemplo. Se preferir encerrar, escreva PARAR.',next:'silent_wait'},
  wait('silent_wait','attention','finish',{timeout_seconds:255600,deadline_seconds_from_start:259200}),
  {id:'attention',type:'image',url:asset('flownexa-conversa.png'),next:'menu'},
  {id:'menu',type:'buttons',text:'Quer ver na prática ou receber um guia com mensagens prontas?',buttons:menuButtons(),next:'menu_wait'},
  wait('menu_wait','route'),
  {id:'route',type:'switch',operator:'equals',cases:choiceCases(),default:'clarify'},
  {id:'mechanism',type:'image',url:asset('flownexa-como-funciona.png'),next:'demo_copy'},
  {id:'demo_copy',type:'message',text:'A oportunidade não termina no comentário. Ela continua quando você faz a pergunta certa. Na FlowNexa, você monta a sequência em nós: mensagem, espera pela resposta, opções, imagem e próximo passo. Você escolhe as frases e testa o caminho antes de publicar.',next:'qualify'},
  {id:'migration',type:'message',text:'Se você já usa automação, vale comparar o que acontece depois da primeira mensagem: como o fluxo entende a escolha, entrega o conteúdo e continua a conversa. Na FlowNexa, esses caminhos ficam visíveis em nós, com modelos que você pode adaptar ao seu negócio.',next:'qualify'},
  {id:'guide',type:'buttons',text:'Seu guia: 7 mensagens para transformar comentários em conversas',buttons:[{type:'web_url',title:'Abrir guia PDF',url:pdf},button('Quero aplicar','APLICAR')],next:'guide_wait'},
  wait('guide_wait','qualify'),
  {id:'qualify',type:'buttons',text:'Qual conversa você quer organizar primeiro no seu Instagram?',buttons:[button('Comentários','COMENTARIOS'),button('Direct','DIRECT'),button('Os dois','AMBOS')],next:'qualify_wait'},
  wait('qualify_wait','offer_visual'),
  {id:'offer_visual',type:'image',url:asset('flownexa-modelos.png'),next:'offer'},
  {id:'offer',type:'buttons',text:'Comece com um modelo e adapte o funil ao seu negócio.',buttons:[{type:'web_url',title:'Abrir FlowNexa',url:app},button('Como começar','COMECAR'),button('Receber o guia','GUIA')],next:'offer_wait'},
  wait('offer_wait','offer_route'),
  {id:'offer_route',type:'switch',operator:'equals',cases:[{id:'start',label:'Passo a passo',value:'COMECAR',next:'start_steps'},{id:'guide',label:'Guia prático',value:'GUIA',next:'final_guide'}],default:'start_steps'},
  {id:'start_steps',type:'message',text:'Seu próximo passo é simples:\n1. Abra a FlowNexa e crie sua conta.\n2. Conecte seu Instagram profissional pela Meta.\n3. Escolha um modelo ou abra Criar do zero.\n4. Personalize as mensagens e conecte os nós.\n5. Teste com outra conta antes de publicar.\n\nA FlowNexa organiza a conversa. A oferta, as mensagens e a decisão de compra continuam sendo do seu negócio.',next:'start_links'},
  {id:'start_links',type:'buttons',text:'Escolha seu próximo passo',buttons:[{type:'web_url',title:'Montar meu funil',url:app},{type:'web_url',title:'Ler o guia PDF',url:pdf}],next:'finish'},
  {id:'final_guide',type:'buttons',text:'Guarde o guia e adapte as mensagens ao seu negócio',buttons:[{type:'web_url',title:'Abrir guia PDF',url:pdf},{type:'web_url',title:'Abrir FlowNexa',url:app}],next:'finish'},
  {id:'clarify',type:'buttons',text:'Escolha o que mais ajuda você agora:',buttons:menuButtons(),next:'clarify_wait'},
  wait('clarify_wait','clarify_route'),
  {id:'clarify_route',type:'switch',operator:'equals',cases:choiceCases(),default:'close_help'},
  {id:'close_help',type:'message',text:'Tudo bem. Você pode conhecer a FlowNexa em https://flownex.online ou guardar o guia para quando precisar. Esta sequência termina aqui. Para não receber novas automações deste funil, escreva PARAR.',next:'finish'},
  {id:'finish',type:'end'}
 ];
 const labels={welcome:'Abertura original',first_wait:'Resposta ou 1 hora',reminder:'Único lembrete permitido',silent_wait:'Esperar até 3 dias',attention:'Atenção: imagem',menu:'Escolher objetivo',menu_wait:'Esperar escolha',route:'Bifurcação por objetivo',mechanism:'Como funciona: imagem',demo_copy:'Demonstração e benefício',migration:'Para quem já automatiza',guide:'Entregar guia PDF',guide_wait:'Aplicar o guia',qualify:'Qualificar interesse',qualify_wait:'Esperar preferência',offer_visual:'Modelos: imagem',offer:'Próximo passo',offer_wait:'Esperar decisão',offer_route:'Guia ou passo a passo',start_steps:'Começar em 5 passos',start_links:'Criar conta ou ler guia',final_guide:'Guia e ferramenta',clarify:'Esclarecer opção',clarify_wait:'Esperar nova escolha',clarify_route:'Identificar opção',close_help:'Encerrar com orientação',finish:'Encerramento'};
 const positions={welcome:[40,60],first_wait:[370,60],reminder:[700,330],silent_wait:[1030,330],attention:[1360,60],menu:[1690,60],menu_wait:[2020,60],route:[2350,60],mechanism:[2680,20],demo_copy:[3010,20],migration:[2680,600],guide:[2680,300],guide_wait:[3010,300],qualify:[3340,120],qualify_wait:[3670,120],offer_visual:[4000,120],offer:[4330,120],offer_wait:[4660,120],offer_route:[4990,120],start_steps:[5320,20],start_links:[5650,20],final_guide:[5320,330],clarify:[2680,900],clarify_wait:[3010,900],clarify_route:[3340,900],close_help:[3670,900],finish:[5980,600]};
 return {name:'automacao 1',trigger_type:'comment_any',scope:'all',configuration:{entry_points:['comment','dm','story'],keywords:[],media_ids:[],once_per_contact:false,opt_out_keywords:['PARAR','STOP','SAIR','CANCELAR'],graph:{version:1,start:'welcome',nodes},graph_layout:Object.fromEntries(nodes.map((n,i)=>[n.id,{x:positions[n.id]?.[0]??40+(i%6)*330,y:positions[n.id]?.[1]??60+Math.floor(i/6)*300,label:labels[n.id]}]))}};
}
