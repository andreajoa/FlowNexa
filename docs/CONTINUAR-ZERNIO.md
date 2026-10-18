# Retomada FlowNexa — Zernio

Atualizado em 2026-10-18. Não há segredos neste arquivo. Continuar a tarefa autorizada, sem reiniciar a auditoria.

## Objetivo e autorizações

Conectar Instagram de clientes ao FlowNexa, começando por gilberto.rebuild. Proprietário CPF, rejeita convites de tester. Usuário autorizou usar Zernio e forneceu chave; chave validada HTTP 200. Não contratar planos pagos, nem declarar entrega real sem comprovação. Contas Meta atuais devem permanecer funcionando. A nova mensagem sobre limite do Codex pede retomada automática, sem cancelar esta integração.

## Repositório e produção

- Worktree de trabalho: `/Users/andrealmeida/flownexa-instagram-audit`, branch `fix/instagram-profile-connection`.
- PR existente https://github.com/andreajoa/FlowNexa/pull/15 . Integração commitada e enviada em `2965da9` (commit anterior: `79b1f23`).
- Produção atualizada para `087d5a8` (código de integração `2965da9`), domínio `https://flownex.online`. Deployment `dpl_Ct5KpZfp6ytNJUbNNwRypf9a1vvW`, URL `https://flownexa-ilyes5qot-flownexa3.vercel.app`, promovido com sucesso. Health HTTP 200; callback Zernio sem sessão retorna 401; webhook GET retorna 405.
- Projeto Vercel `flownexa3/flownexa`, project `prj_DWVerljQapY4ZRnHI93CRAhI4kTS`, team `team_RpoiNmmSvkiuCGlBgP8WyAdI`. Link `.vercel/project.json` já copiado, ignorado no git.
- ZERNIO_API_KEY e ZERNIO_WEBHOOK_SECRET guardados como segredos Production na Vercel; INSTAGRAM_CONNECTION_PROVIDER=zernio guardado como Config Production. Não imprimir, exportar ou recriar esses valores. Um segredo já foi gerado; NÃO gerar outro sem alinhar o webhook remoto.
- Zernio inicialmente consultada: perfil Default e zero contas. Webhook Production registrado e ativo: `6ad50e963b4b31b29df7bfe4`, três eventos configurados. Teste real POST /v1/webhooks/test retornou HTTP 200, success=true. Conta Instagram ainda não conectada. A API usa https://zernio.com/api/v1/ .

## Alterações locais ainda em andamento

Arquivos já commitados: src/zernio-client.js, src/zernio-connection.js, src/zernio-webhook.js, tests/zernio.test.js e docs/ZERNIO-INSTAGRAM.md. Alterados roteamento, gateway de assinatura, transportes, publicação de fluxos, readiness, mídia/desconexão, fila, UI e documentação. Não perder arquivos não rastreados.

Provider separado por identificador interno `zernio:<remoteId>`, sem fingir token/expiração Meta. Três tabelas aditivas bootstrapadas no primeiro connect autorizado. Perfil por workspace e callback com state/sessão/RBAC/consumo único e verificação remota. Webhooks HMAC brutos, ignora amostras/echo/replies/standby, queue durável existente. Escritas incertas nunca são reenviadas automaticamente. Contas Meta existentes continuam no transporte original.

## Verificações já realizadas

- Primeira suíte com integração: 159 testes aprovados, `/tmp/flownexa-zernio-tests.log`.
- Testes Zernio ampliados: 14 aprovados, `/tmp/flownexa-zernio-specific.log`. Houve um teste rich com URL .test corretamente recusada; corrigida a fixture para example.com.
- Sintaxe e parsing de appClient aprovados, diff check aprovado.
- Browser rich: 3 checks aprovados, zero envios reais; `/tmp/flownexa-zernio-rich.log`.
- Nova suíte completa concluída `/tmp/flownexa-zernio-tests-final.log`: 163 testes aprovados.
- Browser smoke antigo falhou no seletor antigo "Aceito pela Meta". Após atualizar para "Aceito pelo serviço", a nova execução passou 22 checks (`/tmp/flownexa-zernio-browser-final.log`). Novo `scripts/browser-zernio-smoke.mjs` passou 4 checks do botão/login/callback/conta, sem rede nem envios reais.

## Próximas ações

1. Conferir testes em andamento e resolver falhas reais. Revisar nova integração; garantir isolamento, webhook real e preservar conexões Meta.
2. Concluir validação de navegador, incluindo novo fluxo Zernio. Acrescentar prova de login por botão se necessário.
3. Commitar, enviar branch e atualizar PR em torno da integração final.
4. Deploy, inspeção, health e promoção já concluídos para o domínio canônico. Primeiro deploy foi bloqueado por autor Git não associado. Corrigida a atribuição futura para o noreply da conta GitHub autenticada andreajoa, confirmada pela API; nenhum commit antigo foi reescrito nem permissão da equipe alterada.
5. CONCLUÍDO: registrar webhook remoto `https://flownex.online/webhooks/zernio` com mesmo ZERNIO_WEBHOOK_SECRET já salvo, eventos comment.received, message.received, account.disconnected. Secret pode ser usado por processo autenticado mas não deve ser exibido.
6. CONCLUÍDO com HTTP 200/success=true: testar webhook pelo endpoint Zernio de teste; amostras devem dar 200 sem disparar automações. Nenhuma mensagem Instagram real sem confirmação específica do teste.
7. Validar botão Conectar Instagram em sessão FlowNexa do Chrome do usuário; deixar login de gilberto.rebuild para o proprietário quando houver senha/consentimento. Confirmar conta local apenas após callback real válido. Não declarar conta conectada só porque a chave ou webhook funciona.
8. Atualizar este checkpoint e documentação com deploy/commit/evidências finais.

## Ferramentas e credenciais

Existe processo interativo em memória `/tmp/flownexa-provider-session.py`, sessão exec `98813`, com Zernio/Vercel e segredo webhook. Aceita tarefas JSON: `http` (caminho API Zernio), `method`, `body`; `_use_webhook_secret:true` injeta o segredo sem mostrá-lo. Também executa `args` com subprocess, env seguros e saída redigida. Não há segredo no arquivo; se sessão morrer, recuperar credenciais pelas integrações já autorizadas/configuradas, sem pedir que o proprietário replique chaves no chat. Variáveis Vercel são secretas e podem não ser exportáveis.

Scripts auxiliares sem segredos em /tmp: flownexa-configure-zernio.mjs (já executado; NÃO repetir), flownexa-tab.py e flownexa-chrome.py. Estes dois últimos executam JS por AppleScript no Chrome já autenticado. Encapsular JS com const/let em IIFE para evitar colisões globais. Não fechar o Chrome ou seus perfis.

O Chrome tem aba FlowNexa e Meta autenticadas. Sessões clonadas/agent-browser não estão logadas. Não imprimir cookies nem URLs OAuth completas.

## Retomada automática configurada

Monitor local em `/Users/andrealmeida/.local/share/flownexa-codex-resume/watch.py`, LaunchAgent `com.flownexa.codex-usage-resume`, intervalo 180 segundos. A primeira execução efetiva retornou `waiting_for_usage_stop`, sem mensagens enfileiradas. Cinco testes de decisão passaram. Usa `codex app-server` para ler o erro da última execução e o limite oficial; só tenta `codex queue` nesta conversa após erro usageLimitExceeded/rateLimitExceeded e prazo de reset vencido. Não compra créditos, troca conta/modelo nem tenta contornar limites. Máximo cinco retomadas em sete dias e reserva antes de enfileirar para evitar duplicação. Requer Mac ligado e sessão do usuário disponível. O acionamento real de uma retomada ainda não foi observado.

**Ao concluir o objetivo ou receber cancelamento do proprietário, criar `/Users/andrealmeida/.local/share/flownexa-codex-resume/complete` para encerrar o monitor. Aguardar login/2FA/consentimento não é erro de quota e não dispara mensagens automáticas.** Estado e logs não contêm conversas nem segredos. Para desativar completamente: `launchctl bootout gui/501/com.flownexa.codex-usage-resume`.

Documentação oficial consultada: https://learn.chatgpt.com/docs/app-server e https://learn.chatgpt.com/docs/developer-commands?surface=cli . O CLI não fornece a interface de tarefas agendadas; o monitor é uma automação local específica, não uma função nativa de renovação automática.


## Último estado da conexão real

O botão real do FlowNexa foi acionado na sessão autenticada do proprietário, workspace GILBERT.REBUILD (`878a9e78-44a1-42ca-8cce-e454ce36da22`). O backend criou o perfil remoto `6ad50efa216931630f8e293b`, gerou state e URL OAuth reais e levou a aba Chrome `1773772452` (janela `1773771909`) ao login oficial em `https://www.instagram.com/accounts/login/`. Nenhuma senha foi consultada/preenchida e nenhum consentimento foi confirmado pelo agente. A conta ainda precisa da autenticação do proprietário. Se o state expirar (10 minutos desde o início), iniciar novamente pelo botão Conectar Instagram no FlowNexa. Não reutilizar URL antiga nem imprimir sua query.

O usuário foi informado em comentário de que deve concluir login e autorização diretamente nessa aba. Próximo trabalho depende dessa autenticação: consultar contas Zernio, verificar callback e conta local no workspace certo, depois validar interações reais apenas no escopo autorizado. Não declarar conta conectada com base apenas na criação do perfil ou no teste de webhook.
