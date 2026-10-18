# Retomada FlowNexa — Zernio

Atualizado em 2026-10-18. Não há segredos neste arquivo. Continuar a tarefa autorizada, sem reiniciar a auditoria.

## Objetivo e autorizações

Conectar Instagram de clientes ao FlowNexa, começando por gilberto.rebuild. Proprietário CPF, rejeita convites de tester. Usuário autorizou usar Zernio e forneceu chave; chave validada HTTP 200. Não contratar planos pagos, nem declarar entrega real sem comprovação. Contas Meta atuais devem permanecer funcionando. A nova mensagem sobre limite do Codex pede retomada automática, sem cancelar esta integração.

## Repositório e produção

- Worktree de trabalho: `/Users/andrealmeida/flownexa-instagram-audit`, branch `fix/instagram-profile-connection`.
- PR existente https://github.com/andreajoa/FlowNexa/pull/15 . Último commit anterior à integração: `79b1f23`.
- Produção ainda no código `91267b3`, domínio `https://flownex.online`. **Zernio ainda não publicada no momento deste registro.**
- Projeto Vercel `flownexa3/flownexa`, project `prj_DWVerljQapY4ZRnHI93CRAhI4kTS`, team `team_RpoiNmmSvkiuCGlBgP8WyAdI`. Link `.vercel/project.json` já copiado, ignorado no git.
- ZERNIO_API_KEY e ZERNIO_WEBHOOK_SECRET guardados como segredos Production na Vercel; INSTAGRAM_CONNECTION_PROVIDER=zernio guardado como Config Production. Não imprimir, exportar ou recriar esses valores. Um segredo já foi gerado; NÃO gerar outro sem alinhar o webhook remoto.
- Zernio consultada: perfil Default e zero contas; nenhum webhook registrado ainda. A API usa https://zernio.com/api/v1/ .

## Alterações locais ainda em andamento

Novos src/zernio-client.js, src/zernio-connection.js, src/zernio-webhook.js, tests/zernio.test.js e docs/ZERNIO-INSTAGRAM.md. Alterados roteamento, gateway de assinatura, transportes, publicação de fluxos, readiness, mídia/desconexão, fila, UI e documentação. Não perder arquivos não rastreados.

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
4. Preparar deploy de produção sem domínio (`vercel deploy --prod --skip-domain`) no projeto/equipe confirmados. Inspecionar, depois promover para domínio canônico. Nenhuma nova liberação foi feita ainda.
5. Registrar webhook remoto `https://flownex.online/webhooks/zernio` com mesmo ZERNIO_WEBHOOK_SECRET já salvo, eventos comment.received, message.received, account.disconnected. Secret pode ser usado por processo autenticado mas não deve ser exibido.
6. Testar webhook pelo endpoint Zernio de teste; amostras devem dar 200 sem disparar automações. Nenhuma mensagem Instagram real sem confirmação específica do teste.
7. Validar botão Conectar Instagram em sessão FlowNexa do Chrome do usuário; deixar login de gilberto.rebuild para o proprietário quando houver senha/consentimento. Confirmar conta local apenas após callback real válido. Não declarar conta conectada só porque a chave ou webhook funciona.
8. Atualizar este checkpoint e documentação com deploy/commit/evidências finais.

## Ferramentas e credenciais

Existe processo interativo em memória `/tmp/flownexa-provider-session.py`, sessão exec `98813`, com Zernio/Vercel e segredo webhook. Aceita tarefas JSON: `http` (caminho API Zernio), `method`, `body`; `_use_webhook_secret:true` injeta o segredo sem mostrá-lo. Também executa `args` com subprocess, env seguros e saída redigida. Não há segredo no arquivo; se sessão morrer, recuperar credenciais pelas integrações já autorizadas/configuradas, sem pedir que o proprietário replique chaves no chat. Variáveis Vercel são secretas e podem não ser exportáveis.

Scripts auxiliares sem segredos em /tmp: flownexa-configure-zernio.mjs (já executado; NÃO repetir), flownexa-tab.py e flownexa-chrome.py. Estes dois últimos executam JS por AppleScript no Chrome já autenticado. Encapsular JS com const/let em IIFE para evitar colisões globais. Não fechar o Chrome ou seus perfis.

O Chrome tem aba FlowNexa e Meta autenticadas. Sessões clonadas/agent-browser não estão logadas. Não imprimir cookies nem URLs OAuth completas.

## Pedido de retomada automática

Usuário quer continuação automática quando limite renovar, sem outra mensagem. É preciso distinguir preservar este checkpoint de programar um executor real. Não afirmar agendamento/reativação automática sem recurso confirmado e configuração efetiva. Não usar loops que tentem contornar limites. Não armazenar credenciais em automações.
