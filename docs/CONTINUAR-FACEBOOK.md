# Facebook Pages — implementação isolada em andamento

Pedido atual do proprietário: conectar a Página AMB Boutique no MESMO espaço FlowNexa que já contém o Instagram `ambb.outique`. Um perfil/espaço da empresa, abas Instagram/Facebook/TikTok/YouTube; não criar outro espaço por canal. O proprietário autorizou o agente a conduzir OAuth e escolher AMB Boutique; se pedir senha/2FA pessoal, aguardar o titular. Não contratar plano pago, não imprimir segredos.

## Implementado

Branch `feat/facebook-pages-isolated`, baseada em `ed6af27`, worktree `/Users/andrealmeida/flownexa-instagram-audit`.

- `src/facebook-api.js`: conexão de Páginas, perfil Zernio próprio por espaço/canal, estado OAuth de uso único vinculado à sessão, validação do perfil/plataforma/ID da Página, bloqueio de troca silenciosa; listas, rascunhos, publicar/pausar e desconexão local.
- `migrations/0010_facebook.sql` / `src/facebook-schema.js`: armazenamento aditivo Facebook, sem alterar tabelas/IDs/FKs do Instagram. Bootstrap idempotente, migração formal disponível.
- `src/facebook-runtime.js` / `src/facebook-webhook.js`: normalização Facebook, fila criptografada, Messenger 24h, resposta privada sete dias/uma por comentário, resposta pública, deduplicação, STOP/START, controle da conversa, quota mensal atômica, leases e estado incerto sem reenvio.
- Dispatcher usa a assinatura Zernio já validada antes de separar Facebook/Instagram. Scheduler mantém processamento Instagram e orçamento próprio de até oito segundos para Facebook, com erro isolado.
- UI: abas no MESMO espaço, Instagram padrão; Facebook mostra apenas seus recursos; TikTok/YouTube desativados “Em breve”. Rascunho/publicação/pausa, histórico e permissões owner/admin; retorno OAuth mantém o workspace autorizado.
- Flags `FACEBOOK_CHANNEL_ENABLED`, `FACEBOOK_SENDS_ENABLED`, `FACEBOOK_PILOT_WORKSPACES` (lista explícita), `FACEBOOK_MONTHLY_MESSAGE_LIMIT=1000`. Padrão desligado. Billing existente continua valendo; nenhuma isenção de Stripe adicionada.

## Verificação

Baseline 180 testes passou; revisão independente executou suite217/217 e testes Facebook atualizados. Browser Facebook com backend real/SQLite passou owner/viewer, rascunho/edição/publicação/pausa/desconexão, troca de canal no mesmo espaço, workspace sem piloto, retorno OAuth e celular390px. Browser Gilberto passou29nós/preview/publicar/mobile sem envios reais.

Dois problemas MAJOR foram reproduzidos pelo crítico e corrigidos: retry429 após standby e sobrescrita de entrega aceita por outro trabalhador. Agora estado de thread é persistido e transições são condicionadas ao lease/estado. Crítico confirmou zero BLOCKER/MAJOR restantes. Teste focado final API+runtime em andamento no log `/tmp/flownexa-facebook-final-focused.log`.

## Estado externo e próximo passo

Facebook ainda não publicado/conectado nesta anotação. Nenhuma mensagem real enviada, nenhum plano contratado e nenhuma conta/espaço criada.

A sessão Chrome de FlowNexa atualmente está autenticada num usuário que só vê o espaço GILBERT.REBUILD `878a9e78-44a1-42ca-8cce-e454ce36da22`. NÃO conectar AMB nesse espaço. Localizar a sessão/espaço existente da AMB; se depender de login pessoal pedir ao proprietário que abra o FlowNexa da AMB no Chrome. Ele está abrindo a aba correta da Zernio.

API Zernio fornecida pelo proprietário foi auditada em leitura: somente Instagram Gilberto está conectado na Zernio; os outros Instagram existentes podem usar Meta direto. Dois perfis Zernio atuais: Default e Gilberto. Plano Usage ativo; conectar uma Página como segunda conta fica na faixa gratuita pública (primeiras duas contas), sem contratar plano. Validar estado novamente antes de conectar.

Webhook Zernio `6ad50e963b4b31b29df7bfe4`, URL `https://flownex.online/webhooks/zernio`, eventos existentes `comment.received`, `message.received`, `account.disconnected`. Adicionar apenas `conversation.control_changed` com PUT /webhooks/settings {webhookId,events:união}; preservar segredo, destino, filtros e eventos existentes. Fonte oficial docs.zernio.com/webhooks/update-webhook-settings. Não recriar webhook nem rotacionar segredo.

Helpers temporários com credenciais só em memória: Vercel getpass `/tmp/flownexa-vercel-session.py`, sessão75215; Zernio getpass `/tmp/flownexa-zernio-session.py`, sessão13100. Não imprimir ambiente/token. Para tarefas: JSON {args:[...],cwd:...}; resultados redigidos. Ao finalizar encerrar sessões. Scripts de auditoria em /tmp imprimem somente nomes/IDs/estado, nunca segredos.

Produção atual ainda Stripe `dpl_Euw1dSJEGfV12YD8mqtub51Hy6Hf`, `https://flownexa-fo9lyb9ua-flownexa3.vercel.app`, código `aed9016`, site `https://flownex.online`. Pro USD mensal990centavos, demais preços preservados; espaços existentes com acesso legado. PR16 de cobrança pronta para revisão, não mesclada. Preservar também PR15.

Antes de publicar: salvar em commit/PR separados, criar release com flags sem enviar até Página validada, conferir saúde/JS/Stripe/Gilberto; promover só após verificação. Depois OAuth da Página AMB no seu workspace e uma interação real autorizada para validar entrega. Não declarar canal entregue ou testado com mensagem real antes disso.

## Release e sessão correta confirmados

Implementação commitada `7afe8c2`, branch enviada, PR https://github.com/andreajoa/FlowNexa/pull/17 (base PR16, rascunho até OAuth real). Release preparado READY `dpl_Hzu5Y7i5BqcND44Q6GZs6Yq813ea`, https://flownexa-hcvku5m22-flownexa3.vercel.app. Flags configuradas somente para workspace AMB `b83bd3c3-0897-4bd1-8a50-2cc5933418fb`, envios habilitados mas nenhuma Página/fluxo FB ainda existe. Stripe/Instagram env intactos.

Proprietário abriu a aba certa e trocou a sessão. Conferência atual: workspace AMB BOUTIQUE `b83bd3c3-0897-4bd1-8a50-2cc5933418fb`, conta Instagram `ambb.outique` conectada. NÃO pedir login novamente. Próximo: terminar verificação remota do release, promover domínio e OAuth Facebook dessa sessão para AMB Boutique.

API Zernio e sessão Chrome Zernio conferem: uma conta Instagram Gilberto; mesmo projeto correto. Atualização do webhook em andamento para adicionar só `conversation.control_changed` à união dos eventos existentes, sem segredo/destino alterado.
