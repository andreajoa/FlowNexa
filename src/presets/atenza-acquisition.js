export const ATENZA_OPENING = 'Oi! Aqui é a Atenza 👋 Vi seu comentário e separei algo pra você: um jeito de organizar o WhatsApp da sua empresa com vários atendentes no mesmo número, IA que responde com as informações do seu negócio e um funil de vendas com o histórico de cada cliente. Quer que eu te mostre em menos de 1 minuto?';

export function buildAtenzaAcquisition({opening = ATENZA_OPENING, assetBase = 'https://flownex.online', site = 'https://www.atenza.online'} = {}) {
  if (typeof opening !== 'string' || !opening.trim() || opening.length > 1000) throw Error('invalid_opening');
  const asset = name => assetBase + '/assets/funnel/atenza/' + name, signup = site + '/signup', pricing = site + '/precos', demo = site + '/demonstracao', video = site + '/media/atenza/atenza-explica.mp4';
  const postback = (title, payload) => ({ type: 'postback', title, payload }), link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({ id, type: 'wait_reply', timeout_seconds: 259200, on_reply, on_timeout, on_timeout_without_window: on_timeout, ...extra });
  const followUp = (id, on_reply) => wait(id, on_reply, 'last_call', { timeout_seconds: 79200, on_timeout_without_window: 'finish' });
  const nodes = [
    { id: 'welcome', type: 'message', text: opening, next: 'first_wait' },
    wait('first_wait', 'hook', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'silent_wait', deadline_seconds_from_start: 259200 }),
    { id: 'reminder', type: 'message', text: 'Passando só mais uma vez 🙂 Se quiser ver a Atenza funcionando em menos de 1 minuto, responda VER. Para não receber mais mensagens, escreva PARAR.', next: 'silent_wait' },
    wait('silent_wait', 'hook', 'finish', { timeout_seconds: 255600, deadline_seconds_from_start: 259200 }),
    { id: 'hook', type: 'image', url: asset('atenza-atendimento.png'), next: 'menu' },
    { id: 'menu', type: 'buttons', text: 'Pra eu te mostrar o que importa: o que mais pesa hoje no seu WhatsApp?', buttons: [postback('Demoro a responder', 'DEMORA'), postback('Cliente some', 'SOME'), postback('Time bagunçado', 'TIME')], next: 'menu_wait' },
    wait('menu_wait', 'route'),
    { id: 'route', type: 'switch', operator: 'equals', cases: [{ id: 'slow', label: 'Demora para responder', value: 'DEMORA', next: 'ai_image' }, { id: 'lost', label: 'Cliente some', value: 'SOME', next: 'crm_image' }, { id: 'team', label: 'Time desorganizado', value: 'TIME', next: 'team_copy' }], default: 'ai_image' },
    { id: 'ai_image', type: 'image', url: asset('atenza-agentes-ia-whatsapp.png'), next: 'ai_copy' },
    { id: 'ai_copy', type: 'message', text: 'Na Atenza, um atendente de IA responde 24 horas usando a base de conhecimento que você cadastra: preços, horários, políticas, dúvidas frequentes. Quando a conversa precisa de uma pessoa, ela passa para o seu time com todo o histórico. E os limites do que a IA pode fazer são definidos por você.', next: 'demo_offer' },
    { id: 'crm_image', type: 'image', url: asset('atenza-crm-whatsapp.png'), next: 'crm_copy' },
    { id: 'crm_copy', type: 'message', text: 'Na Atenza, cada conversa vira uma negociação no funil de vendas, com o histórico do cliente sempre à mão. E o follow-up automático volta a falar com quem parou de responder, sem depender da memória de ninguém (follow-up e campanhas estão a partir do plano Pro).', next: 'demo_offer' },
    { id: 'team_copy', type: 'message', text: 'Na Atenza, vários atendentes usam o mesmo número de WhatsApp numa caixa de entrada compartilhada: cada conversa tem responsável e histórico, e ninguém responde por cima de ninguém. Seu número continua o mesmo.', next: 'demo_offer' },
    { id: 'demo_offer', type: 'buttons', text: 'Quer ver o sistema funcionando? O vídeo tem menos de 1 minuto.', buttons: [postback('Ver o vídeo', 'VIDEO'), postback('Ver os planos', 'PLANOS'), postback('Tenho dúvidas', 'DUVIDA')], next: 'demo_wait' },
    wait('demo_wait', 'demo_route'),
    { id: 'demo_route', type: 'switch', operator: 'equals', cases: [{ id: 'video', label: 'Ver o vídeo', value: 'VIDEO', next: 'video' }, { id: 'plans', label: 'Ver os planos', value: 'PLANOS', next: 'plans' }, { id: 'faq', label: 'Tenho dúvidas', value: 'DUVIDA', next: 'faq' }], default: 'video' },
    { id: 'video', type: 'video', url: video, next: 'offer' },
    { id: 'offer', type: 'buttons', text: 'Dá pra testar 7 dias sem cobrança e cancelar em um clique.', buttons: [link('Testar 7 dias', signup), postback('Ver os planos', 'PLANOS'), postback('Tenho dúvidas', 'DUVIDA')], next: 'offer_wait' },
    followUp('offer_wait', 'offer_route'),
    { id: 'offer_route', type: 'switch', operator: 'equals', cases: [{ id: 'plans', label: 'Ver os planos', value: 'PLANOS', next: 'plans' }, { id: 'faq', label: 'Tenho dúvidas', value: 'DUVIDA', next: 'faq' }], default: 'faq' },
    { id: 'plans', type: 'message', text: 'Planos da Atenza (por mês):\n\n• Essencial — R$ 97: 1 número, até 3 pessoas, atendente de IA com a sua base, funil e histórico.\n• Pro — R$ 197: até 3 números, até 10 pessoas, follow-up automático, campanhas e relatórios.\n• Ilimitado — R$ 397: números e time sem limite, API e webhooks, suporte prioritário.\n\nTodos com 7 dias sem cobrança (cartão necessário, cancele quando quiser). A IA usa a chave do provedor que você escolher, e o uso é pago direto a ele, sem taxa nossa por cima.', next: 'plans_cta' },
    { id: 'plans_cta', type: 'buttons', text: 'Qual o próximo passo pra você?', buttons: [link('Começar o teste', signup), link('Comparar planos', pricing), postback('Tenho dúvidas', 'DUVIDA')], next: 'plans_wait' },
    followUp('plans_wait', 'faq'),
    { id: 'faq', type: 'message', text: 'Respostas rápidas:\n\n• Meu número muda? Não. Você continua atendendo pelo mesmo número.\n• Preciso de cartão? Sim, mas nada é cobrado nos 7 primeiros dias. Cancelou antes, não paga.\n• A IA está inclusa? Você conecta a chave do provedor (OpenAI, Anthropic, Google ou OpenRouter) e paga o uso direto a ele.\n• Serve pro meu negócio? A Atenza é usada por lojas, clínicas, escolas, imobiliárias, escritórios, restaurantes, agências e prestadores de serviço.\n\nOutra dúvida? Escreva aqui ou mande para suporte@atenza.online.', next: 'faq_cta' },
    { id: 'faq_cta', type: 'buttons', text: 'Quando quiser, é só começar:', buttons: [link('Testar 7 dias', signup), link('Ver demonstração', demo)], next: 'finish' },
    { id: 'last_call', type: 'message', text: 'Oi! Ficou alguma dúvida sobre a Atenza? O teste de 7 dias sem cobrança continua disponível em ' + signup + ' 🙂 Se preferir não receber mais mensagens, escreva PARAR.', next: 'finish' },
    { id: 'finish', type: 'end' }
  ];
  const labels = { welcome: 'Abertura Atenza', first_wait: 'Resposta ou 1 hora', reminder: 'Único lembrete', silent_wait: 'Esperar até 3 dias', hook: 'Imagem: atendimento', menu: 'Qual a maior dor?', menu_wait: 'Esperar escolha', route: 'Bifurcação por dor', ai_image: 'Imagem: agentes de IA', ai_copy: 'IA que responde 24h', crm_image: 'Imagem: CRM', crm_copy: 'Funil e follow-up', team_copy: 'Multiatendimento', demo_offer: 'Oferecer demonstração', demo_wait: 'Esperar escolha', demo_route: 'Vídeo, planos ou dúvidas', video: 'Vídeo de 1 minuto', offer: 'Teste de 7 dias', offer_wait: 'Esperar até 22h', offer_route: 'Planos ou dúvidas', plans: 'Planos e preços', plans_cta: 'Começar ou comparar', plans_wait: 'Esperar até 22h', faq: 'Dúvidas frequentes', faq_cta: 'Teste ou demonstração', last_call: 'Último lembrete (24h)', finish: 'Encerramento' };
  const positions = { welcome: [40, 60], first_wait: [370, 60], reminder: [370, 360], silent_wait: [700, 360], hook: [1030, 60], menu: [1360, 60], menu_wait: [1690, 60], route: [2020, 60], ai_image: [2350, -200], ai_copy: [2680, -200], crm_image: [2350, 100], crm_copy: [2680, 100], team_copy: [2680, 400], demo_offer: [3010, 100], demo_wait: [3340, 100], demo_route: [3670, 100], video: [4000, -100], offer: [4330, -100], offer_wait: [4660, -100], offer_route: [4990, -100], plans: [4330, 300], plans_cta: [4660, 300], plans_wait: [4990, 300], faq: [5320, 100], faq_cta: [5650, 100], last_call: [5320, 500], finish: [5980, 300] };
  return { name: 'automacao 1', trigger_type: 'comment_any', scope: 'all', configuration: { keywords: [], media_ids: [], once_per_contact: true, opt_out_keywords: ['PARAR', 'STOP', 'SAIR', 'CANCELAR'], graph: { version: 1, start: 'welcome', nodes }, graph_layout: Object.fromEntries(nodes.map(n => [n.id, { x: positions[n.id][0], y: positions[n.id][1] + 260, label: labels[n.id] }])) } };
}

export function buildAtenzaMaster({assetBase = "https://flownex.online/assets/funnel/atenza", site = "https://www.atenza.online"} = {}) {
  const signup = site + '/signup';
  const pricing = site + '/precos';
  const demo = site + '/demonstracao';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 259200, on_reply, on_timeout, on_timeout_without_window: on_timeout, ...extra
  });

  const nodes = [
    // 1. Abertura adaptável
    { 
      id: 'welcome', 
      type: 'message', 
      text: 'Oi! Aqui é a equipe da Atenza 👋\n\nVi seu comentário e quis te responder pessoalmente por aqui. A gente ajuda empresas a organizar o WhatsApp com múltiplos atendentes no mesmo número, agentes de IA e CRM com funil.\n\nVocê já conhece a Atenza ou é seu primeiro contato?',
      text_dm: 'Oi! Aqui é a equipe da Atenza 👋\n\nQue bom ter você por aqui! A gente ajuda empresas a organizar o WhatsApp com múltiplos atendentes no mesmo número, agentes de IA e CRM com funil.\n\nVocê já conhece a Atenza ou é seu primeiro contato por aqui?',
      text_returning: 'Oi de novo! Que bom falar com você por aqui 🙂\n\nVi que já conversamos antes por aqui. Como posso te ajudar hoje? Quer ver os planos, continuar de onde paramos ou precisa de suporte com a sua conta?',
      next: 'first_wait' 
    },
    
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'finish', deadline_seconds_from_start: 259200 }),
    
    { id: 'reminder', type: 'message', text: 'Passando só pra não te deixar sem retorno 🙂\nSe quiser ver como funciona em 1 minuto, me dá um alô por aqui. Se preferir não receber mais nada, digite PARAR.', next: 'finish' },

    // 2. Reconhecimento inteligente (Cliente ativo, Preço, Demo ou Novos)
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'tem_plano_txt', label: 'Cliente ativo / pós-venda', value: 'CLIENT', next: 'pos_venda' },
      { id: 'tem_plano_txt2', label: 'Já assinou / pago', value: 'ASSIN', next: 'pos_venda' },
      { id: 'retomada_txt', label: 'Já conhece', value: 'JA', next: 'retomada' },
      { id: 'p_direct', label: 'Preço direto', value: 'PRECO', next: 'plans' },
      { id: 'd_direct', label: 'Vídeo / Demo', value: 'VIDEO', next: 'plans_demo_msg' },
      { id: 'd_direct2', label: 'Ver funcionando', value: 'FUNCIONA', next: 'plans_demo_msg' },
      { id: 'd_direct3', label: 'Ver vídeo', value: 'VER', next: 'plans_demo_msg' }
    ], default: 'hook' },

    // 3. Suporte VIP Pós-Venda para Retenção de Clientes Pagos
    { id: 'pos_venda', type: 'buttons', text: 'Que bom ter você aqui! O que você precisa configurar hoje?', buttons: [
      postback('Configurar minha IA', 'CONFIG_IA'),
      postback('Criar automação', 'CONFIG_AUTO'),
      link('Acessar meu painel', 'https://www.atenza.online/login')
    ], next: 'pos_venda_wait' },
    wait('pos_venda_wait', 'pos_suporte'),

    { id: 'pos_suporte', type: 'message', text: 'Para sua IA e automações atenderem perfeitamente:\n\n1. No painel, abra "Agentes de IA" e cadastre sua Base de Conhecimento (preços, horários, regras e dúvidas).\n2. Insira a chave da sua IA favorita (OpenAI ou Anthropic) a preço de custo.\n3. Em "Funil de Vendas", crie gatilhos por tempo sem resposta (Follow-up automático) no Kanban.\n\nMe conte aqui o que você vende que te ajudo a calibrar!', next: 'finish' },

    // 4. Retomada para quem já conhece
    { id: 'retomada', type: 'buttons', text: 'Que ótimo te ver de novo por aqui! Como posso te ajudar hoje?', buttons: [
      postback('Já sou cliente', 'CLIENT'),
      link('Ver os planos', pricing),
      link('Testar 7 dias grátis', signup)
    ], next: 'retomada_wait' },
    wait('retomada_wait', 'retomada_route'),

    { id: 'retomada_route', type: 'switch', operator: 'contains', cases: [
      { id: 'ret_client', label: 'Já sou cliente', value: 'CLIENT', next: 'pos_venda' },
      { id: 'ret_humano', label: 'Atendente humano', value: 'HUMANO', next: 'delay_humano' },
      { id: 'ret_demo1', label: 'Ver funcionando', value: 'FUNCIONA', next: 'plans_demo_msg' },
      { id: 'ret_demo2', label: 'Ver vídeo', value: 'VER', next: 'plans_demo_msg' }
    ], default: 'plans' },

    // 5. Apresentação visual da interface
    { id: 'hook', type: 'image', url: assetBase + '/atenza-atendimento.png', next: 'menu' },
    
    { id: 'menu', type: 'buttons', text: 'Pra eu te direcionar pro que mais te ajuda: qual o maior desafio hoje?', buttons: [
      postback('Demoro a responder', 'DEMORA'),
      postback('Cliente some', 'SOME'),
      postback('Time bagunçado', 'TIME')
    ], next: 'menu_wait' },
    wait('menu_wait', 'menu_route'),

    { id: 'menu_route', type: 'switch', operator: 'contains', cases: [
      { id: 'slow_btn', label: 'Demora', value: 'DEMORA', next: 'ai_copy' },
      { id: 'lost_btn', label: 'Cliente some', value: 'SOME', next: 'crm_copy' },
      { id: 'team_btn', label: 'Time', value: 'TIME', next: 'team_copy' }
    ], default: 'ai_copy' },

    { id: 'ai_copy', type: 'message', text: 'Na Atenza, a IA responde 24 horas usando as informações que você cadastrar (tabela de preços, horários, dúvidas e políticas). Se a conversa precisar de alguém da equipe, ela passa o contato com todo o histórico.', next: 'demo_offer' },
    
    { id: 'crm_copy', type: 'message', text: 'Na Atenza, cada conversa vira uma oportunidade no funil de vendas, e o follow-up automático reativa quem parou de responder, sem depender de ninguém lembrar de mandar mensagem.', next: 'demo_offer' },
    
    { id: 'team_copy', type: 'message', text: 'Na Atenza, sua equipe inteira atende usando o mesmo número de WhatsApp numa caixa de entrada compartilhada, com cada conversa atribuída a um responsável e sem ninguém responder por cima.', next: 'demo_offer' },

    { id: 'demo_offer', type: 'buttons', text: 'Veja o sistema funcionando ou conheça os planos:', buttons: [
      link('Ver vídeo (1 min)', demo),
      postback('Ver os planos', 'PLANOS'),
      postback('Falar com equipe', 'HUMANO')
    ], next: 'demo_wait' },
    wait('demo_wait', 'demo_route'),

    { id: 'demo_route', type: 'switch', operator: 'contains', cases: [
      { id: 'p_btn', label: 'Planos', value: 'PLANOS', next: 'plans' },
      { id: 'p_preco', label: 'Preço', value: 'PRECO', next: 'plans' },
      { id: 'h_txt', label: 'Humano', value: 'HUMANO', next: 'delay_humano' },
      { id: 'v_txt1', label: 'Ver funcionando', value: 'FUNCIONA', next: 'plans_demo_msg' },
      { id: 'v_txt2', label: 'Ver vídeo', value: 'VER', next: 'plans_demo_msg' },
      { id: 'v_txt3', label: 'Demonstração', value: 'DEMO', next: 'plans_demo_msg' }
    ], default: 'plans_demo_msg' },

    // Efeito de transbordo realista com delay e retomada total pela IA
    { id: 'delay_humano', type: 'message', text: 'Em instantes um de nós vai te responder por aqui mesmo 🙂', next: 'delay_node' },
    { id: 'delay_node', type: 'delay', seconds: 60, next: 'retomada_ia' },
    { id: 'retomada_ia', type: 'message', text: 'Oi de novo! Tá super corrido por aqui hoje e todos os atendentes estão ocupados agora.\n\nMas eu tenho acesso a todo o sistema da Atenza! Consigo te passar os planos, como criar automações ou tirar dúvidas do seu negócio. Podemos continuar por aqui?', next: 'plans' },

    // 6. Planos Transparentes + Continuidade
    { id: 'plans', type: 'message', text: 'Valores da Atenza (mensalidade sem taxa extra por mensagem):\n\n• Essencial — R$ 97: 1 número, até 3 pessoas, IA personalizada, funil e histórico.\n• Pro — R$ 197: até 3 números, até 10 pessoas, follow-up automático e campanhas.\n• Ilimitado — R$ 397: números e equipe sem limite, API e suporte prioritário.\n\n7 dias sem cobrança pra testar. O número não muda e o custo de IA é a preço de custo!', next: 'plans_cta' },
    
    { id: 'plans_cta', type: 'buttons', text: 'Qual o melhor próximo passo pra você?', buttons: [
      link('Começar o teste', signup),
      link('Comparar planos', pricing),
      link('Ver demonstração', demo)
    ], next: 'plans_wait' },

    wait('plans_wait', 'plans_route', 'finish', { timeout_seconds: 86400 }),

    { id: 'plans_route', type: 'switch', operator: 'contains', cases: [
      { id: 'pr_vid1', label: 'Ver funcionando', value: 'FUNCIONA', next: 'plans_demo_msg' },
      { id: 'pr_vid2', label: 'Ver vídeo', value: 'VER', next: 'plans_demo_msg' },
      { id: 'pr_vid3', label: 'Demo', value: 'DEMO', next: 'plans_demo_msg' },
      { id: 'pr_client', label: 'Cliente ativo', value: 'CLIENT', next: 'pos_venda' }
    ], default: 'plans_demo_msg' },

    { id: 'plans_demo_msg', type: 'buttons', text: 'Veja a demonstração de 1 min da Atenza na prática:', buttons: [
      link('Assistir vídeo', demo),
      link('Testar 7 dias', signup),
      link('Comparar planos', pricing)
    ], next: 'finish' },

    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Abertura Humanizada', first_wait: 'Resposta ou 1 hora', reminder: 'Lembrete amigável',
    first_route: 'Intenção inicial',
    pos_venda: 'Menu Cliente Ativo', pos_venda_wait: 'Aguardar pós-venda', pos_suporte: 'Dicas de Suporte',
    retomada: 'Menu de Retomada', retomada_wait: 'Aguardar escolha', retomada_route: 'Destino da retomada',
    hook: 'Prévia da tela', menu: 'Desafio atual', menu_wait: 'Aguardar resposta', menu_route: 'Roteamento semântico',
    ai_copy: 'Explicação IA', crm_copy: 'Explicação CRM', team_copy: 'Multiatendimento',
    demo_offer: 'Demonstração ou planos', demo_wait: 'Aguardar decisão', demo_route: 'Encaminhar decisão',
    delay_humano: 'Aviso de transbordo', delay_node: 'Pausa de 60s', retomada_ia: 'Desculpa e Retomada IA',
    plans: 'Planos detalhados', plans_cta: 'Opções de adesão', plans_wait: 'Aguardar após planos', plans_route: 'Roteamento planos',
    plans_demo_msg: 'Demonstração prática', finish: 'Encerramento'
  };

  const positions = {
    welcome: [40, 320], first_wait: [370, 320], reminder: [370, 620],
    first_route: [700, 320],
    pos_venda: [1030, -100], pos_venda_wait: [1360, -100], pos_suporte: [1690, -100],
    retomada: [1030, 100], retomada_wait: [1360, 100], retomada_route: [1690, 100],
    hook: [1030, 320], menu: [1360, 320], menu_wait: [1690, 320], menu_route: [2020, 320],
    ai_copy: [2350, 60], crm_copy: [2350, 360], team_copy: [2350, 660],
    demo_offer: [2680, 360], demo_wait: [3010, 360], demo_route: [3340, 360],
    delay_humano: [3670, 80], delay_node: [4000, 80], retomada_ia: [4330, 80],
    plans: [3670, 360], plans_cta: [4000, 360], plans_wait: [4330, 360], plans_route: [4660, 360],
    plans_demo_msg: [4990, 200], finish: [4990, 500]
  };

  const layout = Object.fromEntries(nodes.map(n => [n.id, { x: positions[n.id][0], y: positions[n.id][1], label: labels[n.id] }]));

  return {
    name: 'automacao 1',
    trigger_type: 'comment_any',
    scope: 'all',
    configuration: {
      keywords: [],
      media_ids: [],
      entry_points: ['comment', 'dm', 'story'],
      once_per_contact: false,
      opt_out_keywords: ['PARAR', 'STOP', 'SAIR', 'CANCELAR'],
      graph: { version: 1, start: 'welcome', nodes },
      graph_layout: layout
    }
  };
}
