# Conversas com nós

O editor visual em `/app` mantém os fluxos simples e adiciona conversas com mapa SVG, edição de blocos, conexões explícitas, posição dos blocos, zoom e uso por teclado. O modelo inicial começa com uma mensagem no Direct contendo INICIAR; não substitui automações já publicadas.

Nós suportados: mensagem; aguardar resposta com caminho de resposta e de tempo esgotado; condição de texto igual ou contendo um valor; esperar tempo; encerrar. Grafos finitos sem ciclos, com até30nós. Esperas de1minuto a23horas; condições e ligações validadas no servidor. Campos de texto e volume total seguem os limites do runtime. Não há execução arbitrária de código, conectores HTTP ou agente de IA nesta versão.

O estado e as respostas ficam criptografados no banco. Cada contato tem no máximo uma conversa ativa por conta do Instagram. Mensagens assinadas novas retomam a conversa antes de iniciar outro fluxo. Respostas atrasadas não respondem perguntas futuras; a resposta usada por uma condição não é sobrescrita por outra mensagem no mesmo lote. Jobs persistem a reserva antes de enviar e o ID retornado pela Meta depois. Um resultado incerto pausa a conversa, sem reenvio cego.

A execução imediata é agendada pelo webhook e os temporizadores são recuperados pelo scheduler de minuto. Esperas não exigem uma função Vercel aberta durante horas. O tempo real de retomada depende do scheduler e da fila. Pausar, editar a versão, desconectar a conta ou perder o acesso ao plano invalida os próximos envios.

Regras de mensagens: comentários permitem a primeira resposta privada no prazo da Meta. Essa resposta não abre automaticamente uma conversa de24horas. Um caminho de ausência de resposta não envia uma segunda mensagem privada até haver uma interação real da pessoa no Direct. Para Direct/Stories, apenas uma nova mensagem real da pessoa renova a janela de24horas; mensagens do bot e temporizadores não renovam a janela.

Salvar e simular não enviam mensagens. Publicar habilita eventos futuros. O mapa de prévia é uma simulação determinística, não comprovação de entrega. O histórico distingue aceitação pela Meta e resultado sem confirmação.

Verificação local:91testes automatizados, revisão independente das falhas de causalidade e19caminhos Chromium com banco/runtime reais e provedores externos simulados. Nenhum desses testes substitui um comentário/Direct real com confirmação no destinatário. Migração0008 aplicada na base dedicada antes do deploy.


Atualização de navegação: menu lateral no desktop e navegação horizontal no celular, com acessos a automações, modelos com nós, Instagram, atividade e assinatura. Automações salvas aparecem antes da configuração inicial, com publicadas primeiro. Fluxos simples de uma única mensagem privada/Direct podem abrir a mensagem original no mapa por “Abrir nós”; abrir não modifica o banco. Salvar converte a configuração em grafo e pausa até publicar novamente.

Seis modelos editáveis: interesse, qualificação, catálogo, agendamento, material gratuito e atendimento de pedidos. Links exigem HTTPS sem credenciais. Mensagens, gatilhos e destinos podem ser personalizados. Nós movem por alça com mouse/toque ou setas; saídas conectam por arraste até outro nó ou pelos seletores acessíveis. Conexões para o próprio nó e ciclos são rejeitadas no mapa; o servidor continua validando a configuração completa antes de salvar/publicar.
