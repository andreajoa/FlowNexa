# Integrações de lojas FlowNexa

Implementação: Shopify Admin GraphQL 2026-10, WooCommerce REST v3, Nuvemshop API 2025-03 e WordPress REST v2. Pesquisa e fontes oficiais em [COMMERCE-APIS-2026-10-20.md](research/COMMERCE-APIS-2026-10-20.md).

## Conectar e usar

No painel, abra **Lojas**, selecione a plataforma e preencha as credenciais. Somente proprietários e administradores podem conectar, consultar dados privados pelo painel e configurar regras. O servidor valida a conexão antes de salvar as credenciais criptografadas. Cada conexão pertence a um único workspace.

- **Shopify:** para um app próprio instalado em loja da mesma organização, informe domínio permanente `https://nome.myshopify.com`, Client ID e Client Secret do Dev Dashboard. O servidor obtém e renova o token de 24 horas. Tokens Admin API de apps existentes também são aceitos. Solicite `read_products` e `read_orders`; dados pessoais e histórico além de 60 dias dependem das aprovações/permissões da Shopify. Carrinhos também exigem a permissão `manage_abandoned_checkouts` do usuário. A autorização de instalação de um app público aparece quando o operador configura `SHOPIFY_CLIENT_ID` e `SHOPIFY_CLIENT_SECRET`; distribuir esse app para terceiros depende da configuração/aprovação da Shopify.
- **WooCommerce:** em Configurações → Avançado → REST API, gere Consumer Key/Secret. Leitura permite consulta; Leitura/Gravação permite cadastrar webhooks. Rastreio é detectado nas extensões Shipment Tracking ou nos metadados `_wc_shipment_tracking_items`. O número usado na consulta é o ID nativo do pedido; extensões que substituem a numeração precisam de adaptação.
- **Nuvemshop:** autorize um app do Portal de Parceiros e use Store ID e access token. Para instalar o app FlowNexa via autorização, configure `NUVEMSHOP_CLIENT_ID` e `NUVEMSHOP_CLIENT_SECRET` no servidor. A disponibilidade dos dados depende das permissões do app. Carrinhos da API podem aparecer com atraso de até seis horas e têm janela de consulta de 30 dias.
- **WordPress:** informe usuário e Senha de Aplicativo. A conexão lê posts publicados. Para dados de vendas, conecte o WooCommerce da mesma instalação.

Para OAuth, registre `https://SEU-DOMINIO/api/commerce/oauth/callback` no app da plataforma. Nunca coloque secrets em JavaScript público ou no repositório.

Após conectar, **Testar leitura da loja** consulta a API real. **Consultar pedido**, **Consultar rastreio**, **Recuperar carrinho** e **Automação de catálogo** abrem modelos editáveis no editor de nós. Revise o modelo e publique a automação. O canal implementado nesta entrega é Instagram; os nós de loja não são aceitos no executor Facebook.

O cliente informa seu e-mail na conversa e recebe um código por e-mail. O código expira em dez minutos, permite cinco tentativas e fica vinculado à loja, conta e destinatário. A identidade verificada vale por uma hora. Consultas de pedido exigem correspondência exata do número e e-mail. Não são retornados endereços de cobrança/entrega.

## Novidades, pedidos e carrinhos

Clique em **Ativar eventos da loja** e configure uma regra em **Novidades e lembretes automáticos**. Os eventos são assinados, armazenados criptografados e processados pelo agendador existente `/api/internal/tick`.

Novidades e lembretes exigem autorização explícita pelo modelo **Obter autorização para novidades**. O cliente responde `AUTORIZO NOVIDADES E LEMBRETES`. `SAIR`, `PARAR`, `CANCELAR`, `STOP` e `UNSUBSCRIBE` suspendem envios. Alterar o e-mail verificado não transfere consentimento. O atendimento transacional continua disponível após cancelar novidades.

Não é possível transformar todo comprador da loja em destinatário de Instagram: ele precisa ter conversado com a conta e vinculado o e-mail. Os disparos respeitam a janela de 24 horas, elegibilidade da conta, consentimento e faturamento. Fora da janela, são ignorados. Links de recuperação e detalhes privados são obtidos na conversa verificada; o evento envia apenas a mensagem configurada. Carrinhos são conferidos novamente antes do lembrete. Resultado incerto de envio não é reenviado automaticamente.

O processamento também consulta carrinhos dos contatos elegíveis. Shopify pesquisa até 250 registros não recuperados por consulta e sinaliza `partial` quando há mais páginas; Nuvemshop consulta até 200 registros por busca. Isso não é uma exportação completa nem um mecanismo de disparo para todos os compradores da loja.

## FlowNexa Bridge para WooCommerce

Instale `public/integrations/flownexa-bridge.zip` em Plugins → Adicionar plugin. Requer PHP 8 e OpenSSL AES-256-GCM. Em Configurações → FlowNexa Bridge, salve para gerar a chave e cadastre a chave no campo Bridge da conexão WooCommerce. Depois copie o endereço de webhook exibido no FlowNexa para o plugin.

O plugin captura carrinhos identificados após o preenchimento/sincronização de e-mail no checkout clássico e Checkout Blocks. Não captura visitantes anônimos sem e-mail. Marca abandono após uma hora de inatividade; o WP-Cron horário depende de visitas ou cron real configurado no servidor. Os dados expiram em sete dias. Recuperação usa token aleatório, itens do catálogo e preço calculado pelo WooCommerce; não reutiliza preços enviados pelo navegador. Os dados locais são criptografados usando o salt de autenticação do WordPress.

A captura Blocks usa os hooks oficiais `woocommerce_store_api_cart_update_customer_from_request` e `woocommerce_store_api_checkout_update_customer_from_request`. Versões e customizações de checkout precisam ser verificadas na loja de destino.

## Operação e validação

Aplique `migrations/0013_commerce.sql` pelo processo de migração existente. O módulo também cria suas tabelas de forma idempotente no primeiro uso. Configure `TOKEN_ENCRYPTION_KEY` (64 caracteres hex), remetente e API Resend já usados pelo aplicativo; a verificação por e-mail falha de forma explícita sem o serviço configurado. Preserve a chave de criptografia existente ao atualizar.

Desconectar elimina credenciais e identidades locais, desativa regras e cancela pendências. A remoção remota dos webhooks é tentada; se falhar, o painel orienta a remoção no provedor. Instalar apps públicos também exige os requisitos da plataforma, inclusive callbacks de privacidade/aprovação; esta implementação não representa aprovação de marketplace.

Testes reproduzíveis:

```sh
npm test
PUPPETEER_PATH=/caminho/puppeteer-core/lib/puppeteer/puppeteer-core.js node review/commerce/browser-check.mjs
```

Os testes locais usam SQLite real, API FlowNexa real e respostas simuladas das plataformas. Não comprovam homologação em lojas reais. O plugin recebeu verificação de sintaxe PHP; instalação, checkout clássico/Blocks, WP-Cron, recuperação e conclusão devem ser exercitados em staging WordPress/WooCommerce antes da liberação comercial. A homologação de cada provedor deve incluir conexão, pedido de teste, e-mail incorreto, rastreio, produto publicado, carrinho recuperado, revogação do app e falha/repetição de webhook. Nenhuma credencial de loja real foi fornecida nesta tarefa.
