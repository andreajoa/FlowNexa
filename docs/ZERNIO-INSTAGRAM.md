# Instagram pela Zernio

O botão de conexão usa Zernio quando `INSTAGRAM_CONNECTION_PROVIDER=zernio` estiver definido. `ZERNIO_API_KEY` e `ZERNIO_WEBHOOK_SECRET` são segredos exclusivos do servidor. `MESSAGING_ENABLED=true` e a chave de criptografia existente continuam necessários. O proprietário autorizou o uso da Zernio e forneceu a chave; nenhum plano pago foi contratado pela integração.

## Conexão e separação de clientes

Cada workspace recebe um perfil remoto com `externalId=flownexa:<origin>:<workspace>`. O callback `/api/instagram/zernio/callback` exige sessão, vínculo administrativo, state vinculado ao navegador e ainda válido, consumo único e consulta autenticada à lista de contas remotas do perfil. Parâmetros do navegador não comprovam identidade ou propriedade. O login solicita comentários e mensagens e exige nova autenticação para quem gerencia várias contas.

As tabelas adicionais `zernio_profiles`, `zernio_oauth_states` e `zernio_accounts` são criadas de maneira idempotente no primeiro início de conexão autorizado. O esquema está centralizado em `src/zernio-connection.js`. Não há alteração de tabelas nem regravação de contas Meta existentes. A aplicação não recebe o token Meta do cliente: o identificador interno `zernio:<accountId>` identifica o transporte, sem inventar data de expiração ou armazenar a chave compartilhada na conta. A Zernio mantém o token e sua renovação.

Contas Meta atuais continuam no transporte original. Uma conta já conectada pelo transporte Meta não pode ser duplicada silenciosamente pelo username. Para uma futura migração, desconectar explicitamente a conta antiga e definir como preservar seus fluxos antes de executá-la. Esta entrega destina a nova conexão a `gilberto.rebuild`.

## Recebimento e envio

Registrar um webhook em `https://flownex.online/webhooks/zernio` com segredo próprio e eventos `comment.received`, `message.received` e `account.disconnected`. O gateway preserva `X-Zernio-Signature`; o handler verifica HMAC-SHA256 do corpo bruto, limita o corpo a 1 MiB e ignora amostras de teste antes de qualquer efeito. O roteamento usa a conta remota previamente vinculada no servidor. A criação da conexão local só ocorre no callback autenticado; `account.connected` não concede acesso por si só.

Comentários e mensagens entram na mesma fila durável, com deduplicação, isolamento por conta, pausa, permissões comerciais e reserva de efeito existentes. O cron existente processa a fila; o recebimento do webhook não espera envio ao Instagram. São preservados o horário original da plataforma, o post e o comentário para resposta privada, e o identificador opaco da conversa para Direct. Eventos enviados pela própria conta, comentários de resposta, lives e conversas em standby são ignorados. Live e menções sem mensagem não são funcionalidades adicionadas por esta integração.

Resposta privada respeita sete dias; Direct respeita 24 horas. Texto, respostas rápidas, imagens, vídeos e cards com botões passam pela API de inbox. Erro de rede, JSON inválido de escrita ou erro 5xx resulta em entrega incerta e não causa reenvio automático. IDs de aceitação são exigidos para registrar sucesso. A desconexão pausa os fluxos localmente antes de remover a conexão remota. Se a remoção remota falhar, o painel informa que ela não foi confirmada, inclusive para que a conexão faturável possa ser revista na Zernio. Um webhook antigo de desconexão consulta o estado remoto atual antes de invalidar uma reconexão.

## Validação e limites da entrega

Testes automatizados usam o contrato documentado e a fila real em SQLite, com provedor simulado. Não comprovam aceitação do perfil pela Meta, renderização no aplicativo Instagram nem entrega real. A chave fornecida foi validada contra a API real de perfis e contas: HTTP 200, ainda sem contas sociais conectadas nesse momento. Testar o webhook pelo endpoint de testes da Zernio não envia uma mensagem Instagram.

Após publicar e registrar o webhook, conectar `gilberto.rebuild` no FlowNexa e concluir a autorização no Instagram. Validar a conta persistida, um comentário real e uma resposta real de Direct antes de declarar operação ponta a ponta. Respostas rápidas, postbacks e identificação de resposta a story precisam ser conferidos com os payloads reais recebidos: a documentação de `metadata` é aberta, e o adaptador aceita os formatos nomeados que reconhece sem tratar campos arbitrários como respostas de botões. Não é prometido suporte a conta pessoal: a conexão oficial continua sendo Empresa/Criador.

Fontes: [conectar contas](https://docs.zernio.com/guides/connecting-accounts), [Instagram](https://docs.zernio.com/platforms/instagram), [webhooks](https://docs.zernio.com/webhooks), [eventos inbox](https://docs.zernio.com/webhooks/inbox), [resposta privada](https://docs.zernio.com/comments/send-private-reply-to-comment), [Direct](https://docs.zernio.com/messages/send-inbox-message) e [preços](https://docs.zernio.com/pricing).

Verificação anterior à publicação: 163 testes Node aprovados; 14 testes específicos Zernio; navegador com 22 checks da aplicação, 3 checks de fluxos ricos e 4 checks do login Zernio, todos sem conexão social nem envio real. Sintaxe e parsing do script do navegador aprovados. O teste de navegador antigo falhou no seletor de texto alterado, foi atualizado e passou integralmente na nova execução.
