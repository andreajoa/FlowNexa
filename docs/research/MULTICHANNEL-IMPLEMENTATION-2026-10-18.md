# FlowNexa — expansão segura para Facebook, TikTok e YouTube

Pesquisa em 18/10/2026. Este documento é um projeto de implementação: nenhum canal novo foi conectado, nenhuma mensagem foi enviada e nenhum serviço pago foi contratado. Os módulos e tabelas sugeridos abaixo ainda não existem. A documentação de APIs muda; validar novamente antes da implementação e do lançamento.

## Decisão recomendada

Implementar Facebook Pages primeiro, depois TikTok com comentários e DMs elegíveis e, por último, comentários do YouTube. Facebook é o mais próximo do Instagram atual. YouTube precisa de um fluxo público separado. TikTok exige condições de conta, região e orçamento por conversa que o runtime atual não representa. Manter Instagram na rota e no armazenamento existentes durante todo o piloto. Essa ordem é uma recomendação de engenharia baseada nas diferenças abaixo, não uma exigência dos provedores.

Não anunciar os canais como disponíveis enquanto não houver OAuth, isolamento, envio, revogação, limites e uma interação real autorizada aprovados para cada canal. Os planos atuais continuam descrevendo contas Instagram; a pesquisa não altera franquias, contratos ou preços.

## O que cada canal permite

| Canal | Escopo inicial viável | Condições que precisam aparecer na conexão |
|---|---|---|
| Facebook Pages | Messenger, comentários públicos e uma resposta privada a comentário | Página autorizada, não perfil pessoal; janela padrão de 24 horas; resposta privada em até sete dias, uma por comentário. Outros apps podem ser donos da conversa. |
| TikTok | Comentários públicos; DMs apenas para conta elegível | Conexão pela Business app. DM exige Business Account, cadastro fora EEE/Suíça/Reino Unido e recebimento de DMs habilitado. Até dez respostas em 48 horas após mensagem do usuário. |
| YouTube | Ler comentários e responder publicamente | Identidade Google proprietária do canal ou proprietária/gerente de Brand Account. Acesso delegado apenas no YouTube Studio não basta. Não há envio de DM nesta integração. |

Fontes por linha: [Facebook](https://docs.zernio.com/platforms/facebook), [resposta privada](https://docs.zernio.com/comments/send-private-reply-to-comment), [TikTok](https://docs.zernio.com/platforms/tiktok), [YouTube](https://docs.zernio.com/platforms/youtube). A documentação oficial do [TikTok Business Messaging](https://business-api.tiktok.com/portal/bm-api/education-hub) também descreve acesso por Business Accounts autorizadas. A ausência de DM na integração YouTube não é uma afirmação sobre todos os recursos presentes ou futuros do aplicativo YouTube.

Facebook aceita texto, anexos e interações. No piloto, limitar ao subconjunto já testado; não implementar tags para marketing fora da janela. A coleção oficial da [Meta para Messenger](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api) exige mensagem recente do destinatário ou uma permissão aplicável fora da janela. O suporte técnico a uma tag não torna uma campanha promocional elegível para usá-la.

TikTok envia texto de até 6.000 caracteres OU uma imagem JPG/PNG até 3 MB, não ambos no mesmo envio. Não iniciar conversas, oferecer botões/quick replies ou transformar comentário em DM por esta API. Comentários não exigem Business Account, mas a conexão precisa estar na Business app. A documentação alerta que autorizar outra conta em uma reconexão pode substituir a anterior e apagar seu histórico; não tentar essa operação silenciosamente. [Fonte](https://docs.zernio.com/platforms/tiktok).

YouTube conecta um canal por perfil Zernio. Um segundo canal exige outro perfil. Isso impede reutilizar sem mudanças o modelo atual de um único perfil por workspace. O seletor de identidade do Google determina o canal; não existe um seletor de canal posterior na Zernio. [Fonte](https://docs.zernio.com/platforms/youtube).

## Contratos de conexão documentados

Base do provedor: `https://zernio.com/api/v1`. Usar a chave apenas no servidor.

| Canal | Iniciar OAuth | Áreas solicitadas no piloto |
|---|---|---|
| Facebook | `GET /connect/facebook?profileId=…&redirect_url=…&scopes=comments,messaging` | Comentários e mensagens |
| TikTok | `GET /connect/tiktok?profileId=…&redirect_url=…&scopes=comments,messaging` | Comentários e mensagens; os escopos de vídeo obrigatórios da plataforma continuam presentes |
| YouTube | `GET /connect/youtube?profileId=…&redirect_url=…&scopes=comments` | Comentários; o escopo de gerenciamento sempre requerido também permanece |

Enviar o usuário ao `authUrl` retornado, sem fabricar URL OAuth da plataforma. No piloto, preferir a seleção hospedada da Zernio, preservando seu consentimento de Página. `loginMethod` é exclusivo do Instagram e não deve ser copiado para os outros canais. `headless=true` é opcional, não necessário para a primeira fase. A API pode responder com erros de permissão, limite ou cobrança; nenhum deles autoriza contratar um plano. [Get OAuth connect URL](https://docs.zernio.com/connect/get-connect-url).

O mapeamento de áreas é relevante: Facebook `comments` pede `pages_manage_engagement` e `pages_read_user_content`; `messaging` pede `pages_messaging`; há também permissões de listagem/leitura/metadados sempre requeridas. TikTok `comments` inclui `comment.list`, `comment.list.manage`, `video.list`; `messaging` inclui `message.list.read`, `message.list.send`, `message.list.manage`. YouTube usa `https://www.googleapis.com/auth/youtube.force-ssl` para comentários e `https://www.googleapis.com/auth/youtube` sempre. Não pedir analytics/ads/posting opcional sem uma função de produto que necessite deles. [Conexão e escopos](https://docs.zernio.com/guides/connecting-accounts).

Se futuramente houver seletor próprio do Facebook: `GET /connect/facebook/select-page` lista e `POST /connect/facebook/select-page` completa a conexão. O fluxo clássico usa `profileId`, `tempToken`, `pageId` e `userProfile`; headless também usa `X-Connect-Token`. Preferir `X-Temp-Token` à query quando aplicável e nunca registrar o token. Não misturar isso com o grant `selectionToken` do fluxo de anúncios. Não renderizar `access_token` retornado pela listagem. [Listar Páginas](https://docs.zernio.com/connect/list-facebook-pages), [selecionar Página](https://docs.zernio.com/connect/select-facebook-page).

O callback próprio deve vincular estado de uso único e curta duração a usuário, workspace, plataforma, perfil e intenção de adicionar/reconectar. Reconsultar `GET /accounts?profileId=…&platform=…` e verificar o vínculo completo antes de salvar. Consultar `GET /accounts/{accountId}/health` para permissões/estado, sem desconectar uma conta apenas porque uma sondagem foi inconclusiva. [Saúde da conta](https://docs.zernio.com/accounts/get-account-health).

## Recebimento e envio

| Operação | Endpoint documentado e corpo mínimo relevante |
|---|---|
| Responder DM Facebook/TikTok existente | `POST /inbox/conversations/{conversationId}/messages`, `{accountId,message}`; anexos em campos próprios quando suportados |
| Ler comentários | `GET /inbox/comments/{postId}?accountId=…&limit=…&cursor=…` |
| Responder publicamente | `POST /inbox/comments/{postId}`, `{accountId,message,commentId}` |
| Resposta privada Facebook | `POST /inbox/comments/{postId}/{commentId}/private-reply`, `{accountId,message}` |

Fontes: [enviar mensagem](https://docs.zernio.com/messages/send-inbox-message), [ler comentários](https://docs.zernio.com/comments/get-inbox-post-comments), [responder comentário](https://docs.zernio.com/comments/reply-to-inbox-post), [resposta privada](https://docs.zernio.com/comments/send-private-reply-to-comment). IDs e cursores devem ser tratados como opacos e codificados em componentes de URL. YouTube usa ID de vídeo em `postId`; o parâmetro `commentId` na leitura de replies não é suportado ali.

Assinar `message.received`, `comment.received` e `account.disconnected` conforme o canal e acesso concedido. `message.sent` e eventos de entrega são observação, não gatilhos de conversa. `conversation.control_changed` pode atualizar controle de thread do Facebook; `metadata.standby:true` deve impedir envio automático. Reações em mensagem chegam como `reaction.received`, não como nova DM nem como curtida de publicação. Replays do histórico anterior à conexão não geram eventos de mensagem. O payload inclui identidade do perfil/conta e ID estável do evento. [Inbox webhooks](https://docs.zernio.com/webhooks/inbox).

YouTube não deve ser anunciado como instantâneo: a automação pública do provedor usa polling; o prazo documentado é até dez minutos para posts recentes e maior nos antigos. Essa promessa pertence às automações do provedor, não garante o mesmo prazo para um polling próprio do FlowNexa. Não criar uma automação Zernio e outra FlowNexa para responder à mesma interação. [Automações de comentário](https://docs.zernio.com/comment-automations/create-comment-automation).

A API de leitura Zernio tem cache de até dez minutos. Testar se `comment.received` chega para vídeos existentes e nativos do canal antes de escolher a arquitetura final de ingestão. Se necessário, construir polling próprio com cursor por conta/vídeo, sobreposição temporal e deduplicação; não sondar a cada segundo. A documentação geral recomenda webhook, mas não comprova entrega imediata de todo comentário YouTube. [Leitura e cache](https://docs.zernio.com/comments/get-inbox-post-comments).

Na API nativa Google, `commentThreads.list` lê threads e `comments.insert` responde usando `snippet.parentId`; comentários desabilitados/permissão insuficiente são estados que precisam encerrar ou pausar o trabalho, sem repetição infinita. As notificações push documentadas pelo Google cobrem vídeos e alterações de título/descrição, não novos comentários. Portanto elas não substituem polling de comentários. [Threads](https://developers.google.com/youtube/v3/docs/commentThreads/list), [resposta](https://developers.google.com/youtube/v3/docs/comments/insert), [push](https://developers.google.com/youtube/v3/guides/push_notifications).

## Custos e elegibilidade

O plano corrente Zernio inclui plataformas, inbox e API; duas contas gratuitas são uma franquia global do time, não duas por cliente. Cada canal adicional pode representar outra conta faturável. Planos legados AppSumo podem não ter inbox até liberação pelo suporte; um `403 feature_not_available` precisa aparecer claramente. Não adicionar cartão ou adquirir planos automaticamente. [Preços](https://docs.zernio.com/pricing), [restrição de inbox](https://docs.zernio.com/webhooks/inbox).

DMs têm franquia global de 10.000/mês e US$0,0001 por mensagem excedente; comentários públicos não entram no medidor de DMs. O FlowNexa pode conservar sua regra própria mais conservadora de contar todo envio automatizado, mas precisa explicar isso ao expandir canais. Nenhuma dessas cobranças deve virar excedente automático para o assinante sem implementação e contrato próprios. [Medidor de mensagens](https://docs.zernio.com/pricing/messages).

## Onde o código atual exige isolamento

| Arquivo real | Acoplamento observado | Limite de mudança recomendado |
|---|---|---|
| `src/zernio-connection.js` | Callback Instagram fixo; perfil único por workspace; IDs numéricos e username Instagram; FK de `zernio_accounts` para `instagram_accounts` | Manter íntegro. Criar conexão multicanal separada com estado contendo plataforma e intenção. |
| `src/zernio-webhook.js` | Rejeita plataforma diferente de Instagram; normaliza IDs numéricos; verifica HMAC/perfil | Preservar parser Instagram. Novo dispatcher só desvia canais habilitados após HMAC e vínculo confirmados. |
| `src/zernio-client.js` | `isZernioAccount` usa `ig_user_id`; `zernioSend` valida números e janelas Instagram | Não afrouxar validadores globalmente. Novos adapters Facebook/TikTok/YouTube, com capacidades explícitas. |
| `src/flow-runtime.js` | Mídias selecionadas precisam ser numéricas; gatilhos e ações presumem Instagram | Validador novo por canal; evitar aceitar grafos inválidos apenas porque o editor permite montá-los. |
| `src/conversation-runtime.js` | Primeira saída de comentário vira `private_reply`; janela fixa 24h; sessões lidas em tabelas Instagram | Não reutilizar esse caminho para YouTube/TikTok comentário. Novo executor público terminal; política própria para DM. |
| `src/automation-engine.js` | Conta resolvida em `instagram_accounts`; efeitos já isolados pelo ID local da conta | Preservar esse isolamento e idempotência; não confundir ID de remetente entre contas/canais. |
| `src/runtime-api.js`, `src/meta-client.js`, `src/account-lifecycle.js` | Consultas e ciclo de vida Instagram | Endpoints novos e roteamento explícito; desconexão de um canal não pode desativar contas de outro. |
| `src/billing.js`, `src/commercial-plans.js` | Limites e texto comercial de contas Instagram | Não incluir canais novos na franquia automaticamente. Decidir semântica antes do piloto pago. |

A inspeção de `migrations/0001_initial.sql`, `0005_runtime.sql` e `0008_conversations.sql` mostra FKs de fluxos, eventos, jobs e sessões para `instagram_accounts`. Renomear essa tabela ou inserir YouTube com `ig_user_id` fictício seria uma migração arriscada e semanticamente incorreta.

### Migração aditiva proposta

Criar, em migração nova e ainda não aplicada, tabelas `channel_accounts`, `channel_oauth_states`, `channel_flows`, `channel_events`, `channel_jobs`, `channel_contacts`, `channel_sessions` e `channel_poll_cursors`. Manter as tabelas Instagram, IDs de contas, IDs dos fluxos publicados, versões, configurações e suas linhas sem alteração. O armazenamento paralelo torna o rollback do piloto independente; extração posterior de um núcleo comum só depois de testes de equivalência.

`channel_accounts`: UUID local, workspace FK, plataforma tipada, provedor, remote account ID, provider profile ID, native account ID opaco, display name, status e capabilities verificadas. Unicidade de `(provider,remote_account_id)` e de `(platform,native_account_id)` precisa impedir ligação simultânea a clientes diferentes. Não usar username como identidade estável.

Perfis: criar vínculos próprios por workspace/canal/slot, sem mover o perfil Instagram existente. Em especial, um canal YouTube por perfil. Usar `externalId` determinístico para criar/recuperar apenas o perfil desse vínculo; nunca migrar uma conta existente silenciosamente para satisfazer uma conexão.

Eventos/jobs/sessões referenciam apenas `channel_accounts`, com workspace verificado no servidor. Unicidade do evento inclui provedor, plataforma, conta e ID do evento; efeito inclui a conta e a operação. Contatos e opt-out são isolados por conta. Dados de mensagem continuam criptografados. Cursor inclui conta e recurso; não compartilhar tokens ou cursores entre clientes. Não copiar dados de clientes reais para fixtures.

### Módulos e flags propostos

- `src/channels/capabilities.js`: catálogo somente de capacidades; negado por padrão.
- `src/channels/connection.js`: OAuth e perfil vinculados; senha, 2FA e consentimento permanecem com o titular.
- `src/channels/webhook.js`: normalização por plataforma, vínculo e deduplicação.
- `src/channels/adapters/{facebook,tiktok,youtube}.js`: métodos de leitura/envio e política do canal.
- `src/channels/public-runtime.js`: comentário → resposta pública, sem transição implícita para DM.
- `src/channels/dm-policy.js`: Facebook 24h; TikTok 48h + reserva atômica de até dez saídas na conversa, baseada em mensagem real recebida.
- `src/channels/store.js`: armazenamento novo; o runtime Instagram continua com sua implementação atual.

Flags novas sugeridas, todas desligadas por padrão: `FACEBOOK_CHANNEL_ENABLED`, `TIKTOK_CHANNEL_ENABLED`, `YOUTUBE_CHANNEL_ENABLED`. Adicionar allowlist de workspaces piloto e `CHANNEL_SENDS_ENABLED` separada. Desligar flag bloqueia conexões/execução novas daquele canal e mantém Instagram funcionando; jobs daquele canal ficam suspensos, sem reenvio automático quando a flag voltar.

O dispatcher não deve exigir flags para o Instagram atual. O scheduler precisa de orçamento e leases separados para impedir que polling, falha ou rate limit de um novo canal consuma toda a execução de Instagram.

## Riscos que os testes devem capturar

1. Mesma conta remota em outro workspace, troca de `profileId`, callback de plataforma incorreta, estado reutilizado/expirado e tentativa de reconectar outra identidade: rejeitar antes de gravar ou enviar.
2. Eventos repetidos, assinaturas inválidas, amostras `test:true`, mensagens enviadas pelo próprio negócio, replies do próprio bot e standby: zero envios adicionais.
3. IDs como `page_post`, IDs YouTube e cursores opacos: aceitos apenas no adapter certo; validação numérica Instagram continua intacta.
4. Grafo de comentário YouTube/TikTok com DM, botões, delay de conversa ou `wait_reply`: bloquear publicação. Comentário público não abre janela privada.
5. Facebook: janela 24h, resposta privada única em sete dias, thread de outro app e erro de desconexão. Não repetir resultado incerto.
6. TikTok: conta pessoal/região não elegível, imagem+texto, botão, envio 11 e envio após 48h: bloquear. Reserva das dez mensagens precisa resistir a concorrência e contar saída incerta conservadoramente.
7. YouTube: comentários desabilitados, canal/Brand Account incorretos, vídeo com comentários bloqueados, paginação interrompida e polling repetido: nenhum envio duplicado nem reinício sem limite.
8. Regressão: suite Instagram existente, `tests/zernio.test.js`, `tests/runtime.test.js`, `tests/billing.test.js`, `tests/gilberto-campaigns.test.js` e `scripts/browser-gilberto-smoke.mjs`. Asserções devem provar que desligar todos os novos canais preserva o comportamento atual.

A documentação atual tem divergência: a página TikTok diz que o comentário não inclui flag de autor próprio, enquanto o schema de `comment.received` descreve inferência de `isOwnAccount`. Até fixtures reais autorizadas confirmarem, ausência significa desconhecido. Comparar identidade, registrar IDs das próprias saídas e impedir loops; nunca tratar campo ausente como prova de autor externo. [TikTok](https://docs.zernio.com/platforms/tiktok), [schema do evento](https://docs.zernio.com/webhooks/inbox).

A API de mensagem aceita `Idempotency-Key`, mas só preserva respostas 2xx por 24h. Erros 5xx/timeouts podem ter enviado a mensagem e liberado a chave; reconciliar antes de qualquer repetição. Não substituir o estado conservador `delivery_unknown` já existente por retry irrestrito. [Contrato de envio](https://docs.zernio.com/messages/send-inbox-message).

## Sequência de entrega

1. **Contratos e fixtures:** congelar payloads simulados por canal, implementar capabilities e store novo com flags desligadas. Sem migração destrutiva nem conta externa.
2. **Facebook piloto:** OAuth com picker hospedado, uma Página escolhida pelo proprietário, saúde e ingestão em observação; depois um fluxo simples público e um Messenger simples com interação de teste consentida. Só então habilitar nós adicionais.
3. **TikTok piloto:** confirmar elegibilidade antes do consentimento; comentários públicos primeiro. DM só após orçamento de dez envios em 48h, mídia e recusa de recursos não suportados estarem testados.
4. **YouTube piloto:** identidade/canal correto, ingestão com prazo visível, uma resposta pública terminal e deduplicação. Não criar automação paralela no provedor para o mesmo comentário.
5. **Lançamento:** critérios de isolamento, revogação, custo, billing e regressão aprovados por canal. Abrir gradualmente sem desconectar ou republicar os fluxos Instagram existentes. Revisar textos comerciais e termos somente quando cada canal estiver de fato ativo.

O próximo passo executável é a fase 1 em uma mudança isolada. Este relatório não declara essa implementação concluída e não remove a verificação de titular ainda pendente da Stripe.
