# Auditoria FlowNexa — conexão Instagram

Data: 2026-10-18. Base: `origin/main` em `616b41a`.

## Escopo e evidências

Revisão da aplicação Vercel (`api/index.js`), autenticação e espaços de trabalho, OAuth, cliente Meta, ciclo de tokens, webhooks, filas, executor de conversas, editor, API de agentes/MCP, cobrança, migrations, scheduler, CI e documentação. Revisão estática e testes locais não certificam aprovação Meta, operação comercial ou ausência de outras vulnerabilidades.

O relato foi `{"error":"instagram_profile_failed","detail":"Unsupported request - method type: get"}`. Um teste do callback real, com SQLite e somente o provedor simulado, reproduziu exatamente esse JSON ao rejeitar o `/me` sem versão. Isso prova a reprodução controlada do caminho de falha, não que o provedor rejeitou a rota por esse motivo na tentativa original. O código original não registrava diagnóstico suficiente e o código de autorização é descartável.

Comandos de reprodução: `node --test tests/instagram-oauth.test.js` (três falhas antes da correção); `node --test tests/health.test.js` (uma falha antes da correção).

## Arquitetura

- Landing e `/app` servidos na Vercel; JavaScript do painel gerado por `src/app-client.js`.
- Usuários, sessões, memberships, contas, fluxos, filas e faturamento no Cloudflare D1, por um adaptador REST exclusivamente no servidor.
- OAuth Instagram Login, não Facebook Login: permissões `instagram_business_*`, token criptografado com AES-GCM e conta profissional identificada por `user_id`.
- Eventos Instagram autenticados por HMAC, persistidos antes da confirmação e executados com leases e reservas de efeitos. Resultados de envio incertos não são reenviados automaticamente.
- Worker Cloudflare chama o tick autenticado. Conversas retomam por resposta, condição, botão e espera, respeitando a janela de mensagens.
- Stripe concede acesso por estado confirmado pelo webhook, não pelo retorno do navegador. Agentes têm tokens limitados ao workspace e às rotas de fluxos.

## Achados e correções

| Prioridade | Achado | Evidência e tratamento |
| --- | --- | --- |
| Alta | Consulta OAuth de perfil usava `/me` sem versão, diferente do restante da integração | Corrigida para `GET /{META_API_VERSION}/me?fields=user_id,username`, com Bearer no cabeçalho; teste reproduz o erro informado. A causa exata da tentativa original continua sujeita a validação real. |
| Alta | Troca duradoura falhava e o callback continuava com token curto, inventando validade de até 24h | Removidos fallback silencioso e tentativas especulativas de troca; exige sucesso da troca oficial GET e validade inteira plausível antes de salvar. Não se grava conta duradoura com credencial curta. |
| Média | Resposta OAuth aceita apenas no formato plano | Aceita também exatamente um item em `data`; respostas ambíguas são rejeitadas. |
| Média | Erros de callback deixavam a pessoa em JSON e devolviam mensagens brutas do provedor/exceções | Navegações HTML voltam ao painel com um código fixo e instruções em português. Chamadas JSON mantêm status de erro. Não há tokens, mensagens brutas ou código de autorização no redirecionamento. |
| Média | Cancelamento não validava/consumia state | Valida sessão, expiração e papel administrativo e consome state atomicamente antes de tratar recusa. |
| Média | Adicionar outro perfil dependia da sessão Instagram já aberta | Incluído `force_authentication=1` para permitir selecionar a conta na autorização. Sem restrição a um username no aplicativo. |
| Alta | `/api/health` público expunha nomes/status de todas as contas e executava manutenção de fluxos | Confirmado no endpoint público: HTTP 200 com lista de duas contas. Removida a lista e toda mutação. Removidas as sincronizações implícitas de presets de health, webhook e tick; fluxos existentes preservados. Testes impedem regressão. |
| Média | Havia testes de OAuth, mas mocks antigos aceitavam a chamada sem versão e não cobriam o relato | Acrescentados testes do erro informado, formatos, durabilidade, replay, sessões, expiração, RBAC, cancelamento, permissões, namespace de ID, reconexão e isolamento; mocks existentes atualizados. |

O identificador `id` de outros namespaces nunca substitui `user_id`. Uma conta vinculada a outro workspace continua protegida contra transferência por OAuth. A reconexão no mesmo workspace conserva o ID local para preservar os fluxos.

## Pontos positivos verificados no código e nos testes

Sessões HttpOnly/Secure/SameSite=Lax, e-mail verificado, PBKDF2 versionado, recuperação descartável, limitação persistente de tentativas, checagem de origem em escritas, SQL com parâmetros e RBAC. Tokens e eventos criptografados, assinatura de webhook obrigatória e separada do segredo OAuth, deduplicação, leases e reserva antes do envio. Pausa, alteração de versão, revogação, expiração e assinatura comercial são reavaliadas antes de ações. Webhook Stripe assinado e protegido contra replay e eventos fora de ordem.

Esses controles são evidências específicas; não equivalem a uma certificação de segurança completa.

## Pendências identificadas fora da correção

1. **Acesso Meta para terceiros — bloqueante comercial.** Publicar o app na Meta não comprova Advanced Access nem aprovação de todas as permissões. Confirmar no painel Meta `instagram_business_basic`, `instagram_business_manage_messages` e `instagram_business_manage_comments`, acesso aplicável e uso por cliente sem papel de administrador/desenvolvedor/tester. Sem isso não se pode garantir conexão de qualquer cliente.
2. **Conta pessoal — restrição da plataforma.** Instagram Login atende Empresa e Criador; não permite automações de uma conta pessoal. A conversão precisa acontecer no Instagram. Não exige uma Página Facebook nesse fluxo.
3. **Observabilidade — parcialmente corrigida.** O callback agora registra etapa, código HTTP, código/subcódigo Meta, trace ID validado e uma referência de suporte. Não registra mensagens brutas, URLs, cookies, tokens ou payloads privados. Métricas e alertas agregados continuam pendentes. O erro original não permite distinguir conclusivamente rota, credencial e permissões.
4. **Retenção e privacidade — média.** Estados OAuth expirados, eventos e histórico precisam de política explícita de limpeza; revisar processos de exportação/exclusão de dados além da desautorização de conta.
5. **API de agentes — média.** Inicialização dinâmica de tabela usa flag global e ignora erro de DDL; preferir apenas migrations e falha explícita. As chaves têm escopos fixos amplos de fluxos; escopos configuráveis exigiriam enforcement por operação. Não é acesso a segredos/faturamento.
6. **MCP — média.** O cliente executável usa por padrão `https://app.flownexa.online`, enquanto o app documentado é `https://flownex.online`. Fornecer `--base-url https://flownex.online`; alinhar o padrão em uma alteração própria.
7. **Presets reativavam fluxos pausados — corrigido, alta.** Os sincronizadores específicos de clientes escreviam `enabled=1` e substituíam a configuração. A invocação automática por health/webhook/tick foi removida. Um teste com o ID real do preset confirma que esses três caminhos preservam a pausa e a configuração. Os construtores de modelos continuam disponíveis; atualizações de conteúdo precisam de uma operação explícita.
8. **Operação comercial — pendente.** Rever documentação de readiness contraditória, política/limites de cobrança e testes reais de pagamento, renovação e cancelamento. Nenhuma configuração comercial foi alterada nesta correção.

## Verificação

- `npm ci --ignore-scripts`: concluído; auditoria de dependências sem vulnerabilidades reportadas.
- `npm test`: 146 testes passando na revisão final da correção (144 na primeira rodada, antes dos testes adicionais de diagnóstico e preservação de pausas).
- `npm run check` e parsing do script gerado do navegador: aprovados.
- `PLAYWRIGHT_MODULE=/usr/local/lib/python3.14/site-packages/playwright/driver/package node scripts/browser-smoke.mjs`: 22 verificações aprovadas, sem e-mails ou mensagens Instagram reais. Inclui retorno legível de erro e limpeza da query do navegador.
- Landing, assets públicos, billing e migrations preservados.

## Validação real necessária para gilberto.rebuild

Após publicar, iniciar **uma nova** tentativa por Conectar Instagram, selecionar `gilberto.rebuild` e autorizar as três permissões. Não reutilizar o callback anterior. Confirmar conta persistida com token duradouro e assinatura de eventos; depois, com autorização para o envio, uma interação real deve produzir webhook válido e ID de resposta Meta. Não declarar a conta conectada ou entrega validada apenas com mocks ou saúde HTTP.

## Fontes primárias

- Meta: [Instagram API with Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).
- Meta: [Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/).
- Meta: [Webhook setup](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup).

## Consulta real no ambiente Vercel

O projeto e a equipe foram confirmados como `flownexa3/flownexa`, usando o token fornecido pelo proprietário apenas no ambiente do processo. Os nove segredos sensíveis não são exportáveis pela Vercel; nenhum valor foi copiado para o repositório.

Um deploy temporário com ambiente de produção, domínio principal preservado, Vercel Authentication e diagnóstico protegido por credencial aleatória permitiu consultas estritamente de leitura. Resultado:

- Duas contas registradas; `gilberto.rebuild` ausente. Não foi criada uma conexão artificial.
- Redirect URI correto; ID do produto Instagram distinto do ID do aplicativo pai.
- Na conta autorizada já conectada, tanto `/me` quanto `/v24.0/me` retornaram HTTP 200, username e `user_id` consistentes com o banco.
- Portanto, a rota sem versão **não é uma causa universal comprovada** do erro relatado. O conjunto anterior de fallbacks mascarava falhas da troca duradoura; a nova tentativa precisa ser avaliada por etapa.
- Nenhum envio real, alteração de conta ou chamada de assinatura foi executado pelo diagnóstico. O diagnóstico é temporário e não faz parte do código final.

O segundo teste de navegador (`scripts/browser-rich-smoke.mjs`) também passou: 3 verificações de caminhos com imagem, vídeo, botões e deduplicação, com 8 envios simulados e zero envios reais.
