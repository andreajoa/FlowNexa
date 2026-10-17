export function buildAtenzaMaster({assetBase="https://flownex.online/assets/funnel/atenza", site="https://www.atenza.online"} = {}) {
  const signup = site + '/signup';
  const pricing = site + '/precos';
  const demo = site + '/demonstracao';
  const postback = (title, payload) => ({ type: 'postback', title, payload });
  const link = (title, url) => ({ type: 'web_url', title, url });
  const wait = (id, on_reply, on_timeout = 'finish', extra = {}) => ({
    id, type: 'wait_reply', timeout_seconds: 259200, on_reply, on_timeout, on_timeout_without_window: on_timeout, ...extra
  });

  const nodes = [
    // 1. Abertura humana
    { id: 'welcome', type: 'message', text: 'Oi! Aqui é a equipe da Atenza 👋\n\nVi seu comentário e quis te responder pessoalmente por aqui. A gente ajuda empresas a organizar o WhatsApp com múltiplos atendentes no mesmo número, agentes de IA e CRM com funil.\n\nVocê já conhece a Atenza ou é seu primeiro contato?', next: 'first_wait' },
    
    wait('first_wait', 'first_route', 'reminder', { timeout_seconds: 3600, on_timeout_without_window: 'silent_wait', deadline_seconds_from_start: 259200 }),
    
    { id: 'reminder', type: 'message', text: 'Passando só pra não te deixar sem retorno 🙂\nSe quiser ver como funciona em 1 minuto, me dá um alô por aqui. Se preferir não receber mais nada, digite PARAR.', next: 'silent_wait' },
    
    wait('silent_wait', 'first_route', 'finish', { timeout_seconds: 255600, deadline_seconds_from_start: 259200 }),

    // 2. Reconhecimento inteligente (Cliente ativo, Preço, Demo ou Novos)
    { id: 'first_route', type: 'switch', operator: 'contains', cases: [
      { id: 'tem_plano_txt', label: 'Cliente ativo / pós-venda', value: 'CLIENT', next: 'pos_venda' },
      { id: 'tem_plano_txt2', label: 'Já assinou / pago', value: 'ASSIN', next: 'pos_venda' },
      { id: 'retomada_txt', label: 'Já conhece', value: 'JA', next: 'retomada' },
      { id: 'p_direct', label: 'Preço direto', value: 'PRECO', next: 'plans' },
      { id: 'd_direct', label: 'Vídeo / Demo', value: 'VIDEO', next: 'demo_offer' }
    ], default: 'hook' },

    // 3. Suporte VIP Pós-Venda para Retenção de Clientes Pagos
    { id: 'pos_venda', type: 'buttons', text: 'Que bom ter você aqui! O que você precisa configurar hoje?', buttons: [
      postback('Configurar minha IA', 'CONFIG_IA'),
      postback('Criar automação', 'CONFIG_AUTO'),
      link('Acessar meu painel', 'https://www.atenza.online/login')
    ], next: 'pos_venda_wait' },
    wait('pos_venda_wait', 'pos_venda_route'),

    { id: 'pos_venda_route', type: 'switch', operator: 'contains', cases: [
      { id: 'pv_ia', label: 'Configurar IA', value: 'IA', next: 'pos_ia' },
      { id: 'pv_auto', label: 'Configurar automação', value: 'AUTO', next: 'pos_auto' }
    ], default: 'pos_ia' },

    { id: 'pos_ia', type: 'message', text: 'Para sua IA atender perfeitamente:\n\n1. No painel, abra "Agentes de IA" e cadastre sua Base de Conhecimento (preços, horários, regras e dúvidas).\n2. Insira a chave da sua IA favorita (OpenAI ou Anthropic) a preço de custo.\n3. Defina os limites de transbordo.\n\nMe conte aqui o que você vende que te ajudo a calibrar!', next: 'finish' },

    { id: 'pos_auto', type: 'message', text: 'Para criar automações e funis:\n\n1. Acesse "Funil de Vendas" e vá em "Automações".\n2. Crie gatilhos por palavras-chave ou tempo sem resposta (Follow-up automático).\n3. O lead é movido de coluna no Kanban sozinho.\n\nMe conte aqui o seu nicho para eu te passar a sequência recomendada!', next: 'finish' },

    // 4. Retomada para quem já conhece
    { id: 'retomada', type: 'buttons', text: 'Que ótimo te ver de novo por aqui! Como posso te ajudar hoje?', buttons: [
      postback('Já sou cliente', 'CLIENT'),
      link('Ver os planos', pricing),
      link('Testar 7 dias grátis', signup)
    ], next: 'retomada_wait' },
    wait('retomada_wait', 'retomada_route'),

    { id: 'retomada_route', type: 'switch', operator: 'contains', cases: [
      { id: 'ret_client', label: 'Já sou cliente', value: 'CLIENT', next: 'pos_venda' },
      { id: 'ret_humano', label: 'Atendente humano', value: 'HUMANO', next: 'delay_humano' }
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
      { id: 'h_txt', label: 'Humano', value: 'HUMANO', next: 'delay_humano' }
    ], default: 'plans' },

    // Efeito de transbordo realista com delay e retomada total pela IA
    { id: 'delay_humano', type: 'message', text: 'Em instantes um de nós vai te responder por aqui mesmo 🙂', next: 'delay_node' },
    { id: 'delay_node', type: 'delay', seconds: 60, next: 'retomada_ia' },
    { id: 'retomada_ia', type: 'message', text: 'Oi de novo! Tá super corrido por aqui hoje e todos os atendentes estão ocupados agora.\n\nMas eu tenho acesso a todo o sistema da Atenza! Consigo te passar os planos, como criar automações ou tirar dúvidas do seu negócio. Podemos continuar por aqui?', next: 'plans' },

    // 6. Planos Transparentes + FAQ Completo Integrado
    { id: 'plans', type: 'message', text: 'Valores da Atenza (mensalidade sem taxa extra por mensagem):\n\n• Essencial — R$ 97: 1 número, até 3 pessoas, IA personalizada, funil e histórico.\n• Pro — R$ 197: até 3 números, até 10 pessoas, follow-up automático e campanhas.\n• Ilimitado — R$ 397: números e equipe sem limite, API e suporte prioritário.\n\n7 dias sem cobrança pra testar. O número não muda e o custo de IA é a preço de custo!', next: 'plans_cta' },
    
    { id: 'plans_cta', type: 'buttons', text: 'Qual o melhor próximo passo pra você?', buttons: [
      link('Começar o teste', signup),
      link('Comparar planos', pricing),
      link('Ver demonstração', demo)
    ], next: 'finish' },

    { id: 'finish', type: 'end' }
  ];

  const labels = {
    welcome: 'Abertura Humanizada', first_wait: 'Resposta ou 1 hora', reminder: 'Lembrete amigável', silent_wait: 'Aguardar até 3 dias',
    first_route: 'Intenção inicial',
    pos_venda: 'Menu Cliente Ativo', pos_venda_wait: 'Aguardar escolha pós-venda', pos_venda_route: 'Roteamento pós-venda',
    pos_ia: 'Configurar IA', pos_auto: 'Configurar automação',
    retomada: 'Menu de Retomada', retomada_wait: 'Aguardar escolha', retomada_route: 'Destino da retomada',
    hook: 'Prévia da tela', menu: 'Desafio atual', menu_wait: 'Aguardar resposta', menu_route: 'Roteamento semântico',
    ai_copy: 'Explicação IA', crm_copy: 'Explicação CRM', team_copy: 'Multiatendimento',
    demo_offer: 'Demonstração ou planos', demo_wait: 'Aguardar decisão', demo_route: 'Encaminhar decisão',
    delay_humano: 'Aviso de transbordo', delay_node: 'Pausa de 60s', retomada_ia: 'Desculpa e Retomada IA',
    plans: 'Planos detalhados', plans_cta: 'Opções de adesão', finish: 'Encerramento'
  };

  const positions = {
    welcome: [40, 320], first_wait: [370, 320], reminder: [370, 620], silent_wait: [700, 620],
    first_route: [700, 320],
    pos_venda: [1030, -100], pos_venda_wait: [1360, -100], pos_venda_route: [1690, -100],
    pos_ia: [2020, -200], pos_auto: [2020, 0],
    retomada: [1030, 100], retomada_wait: [1360, 100], retomada_route: [1690, 100],
    hook: [1030, 320], menu: [1360, 320], menu_wait: [1690, 320], menu_route: [2020, 320],
    ai_copy: [2350, 60], crm_copy: [2350, 360], team_copy: [2350, 660],
    demo_offer: [2680, 360], demo_wait: [3010, 360], demo_route: [3340, 360],
    delay_humano: [3670, 80], delay_node: [4000, 80], retomada_ia: [4330, 80],
    plans: [3670, 360], plans_cta: [4000, 360], finish: [4330, 360]
  };

  const layout = Object.fromEntries(nodes.map(n => [n.id, { x: positions[n.id][0], y: positions[n.id][1], label: labels[n.id] }]));

  return {
    name: 'automacao 1',
    trigger_type: 'comment_any',
    scope: 'all',
    configuration: {
      keywords: [],
      media_ids: [],
      once_per_contact: false,
      opt_out_keywords: ['PARAR', 'STOP', 'SAIR', 'CANCELAR'],
      graph: { version: 1, start: 'welcome', nodes },
      graph_layout: layout
    }
  };
}
