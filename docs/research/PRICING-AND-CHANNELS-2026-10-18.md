# FlowNexa — preços, Stripe e expansão de canais

Investigação em 18/10/2026. Preços podem mudar; os valores abaixo são referências das páginas oficiais, não uma promessa de equivalência entre produtos.

## Concorrentes

| Referência | Valor observado | Diferenças relevantes |
|---|---|---|
| [Manychat global](https://manychat.com/pricing) | Essential US$168/ano (US$14/mês equivalente); Pro US$348/ano (US$29/mês equivalente) | Precificação por contatos ativos, vários canais e recursos de IA em planos superiores. |
| [Manychat Pro, ajuda oficial](https://help.manychat.com/hc/en-us/articles/25800228332572-Pro-plan) | US$39/mês ou US$29/mês no anual; 2.500 contatos ativos incluídos | A documentação confirma migração regional do modelo 2026. |
| [Manychat Brasil](https://manychat.com/pt/pricing) | Pro anunciado a partir de R$149/mês | A página portuguesa usa uma tabela diferente da global; o valor final depende da região/conta. |
| [Chatfuel](https://chatfuel.com/pricing) | Business US$216/ano (US$18/mês equivalente) | Oferta inclui IA e uma estrutura de créditos; limites e escopo diferem do FlowNexa. |
| [Respond.io](https://respond.io/pricing) | Starter US$948/ano; Growth US$1.908/ano | Growth oferece workflows; seu preço não deve ser comparado ao plano sem automações como se fossem iguais. |

O Pro do FlowNexa fica abaixo dessas referências pagas, inclusive quando comparado pelo compromisso anual equivalente. Isso não significa ser mais barato que todo concorrente: há planos gratuitos, recursos diferentes e ofertas regionais.

## Catálogo implementado

| Plano por espaço de trabalho | Contas Instagram | Envios por mês calendário | BRL mensal / anual | USD mensal / anual |
|---|---:|---:|---|---|
| Pro |1|10.000|R$59,90 / R$599|US$9,90 / US$129|
| Equipes / Teams |2|20.000|R$119,90 / R$1.199|US$24,90 / US$249|

O anual é pago integralmente e renova anualmente. Por solicitação do proprietário, o Pro USD mensal passou para US$9,90 e o anual foi mantido em US$129: nesse caso o anual custa mais que doze mensalidades (US$118,80) e não deve ser anunciado como desconto. Os demais anuais custam dez mensalidades. O equivalente mensal é apenas informativo. São preços locais fixos, não conversão cambial ao vivo. Português seleciona BRL e outros idiomas, incluindo inglês, selecionam USD; a escolha manual fica salva no navegador. O servidor decide o Price real e valida valor, moeda e recorrência contra o catálogo. Não há cobrança de excedentes automática: o limite interrompe novos envios. Cada chamada de envio reservada conta, inclusive resultado incerto; rejeições não contam. A franquia é mensal em UTC mesmo na assinatura anual.

## Custos e limites da comparação

[Zernio](https://docs.zernio.com/pricing): as duas primeiras contas do time são gratuitas; contas 3–10 custam US$6 cada/mês,11–100 US$3 cada. Os degraus são graduais, não um desconto retroativo para todas as contas. Após 10.000 DMs/mês compartilhadas pelo time, o custo anunciado é US$0,0001 por mensagem. Na pior faixa inicial, provisione aproximadamente US$7/mês por cliente Pro no teto e US$14/mês por cliente Equipes no teto, antes de infraestrutura, impostos, Stripe e câmbio. Não se deve atribuir a gratuidade global a cada cliente.

[Stripe Brasil](https://stripe.com/br/pricing): a página anuncia 3,99%+R$0,39 para cartões nacionais e um adicional para internacionais. Billing, conversão e condições da conta podem acrescentar custos. O preço brasileiro anual tem margem mais apertada e deve ser revisto com dados reais de câmbio e uso; esta análise não promete lucro garantido.

## Atenza como referência, sem alterações

Repositório: [andreajoa/SaaS-whatsapp](https://github.com/andreajoa/SaaS-whatsapp), `origin/main` d009daa6f29ea6c97fbbf479a1ace75c53a9e652 lido nesta investigação. Foram examinados o cliente Stripe, checkout, portal, sincronização, tabela de planos e mercados. O Atenza usa checkout embutido, preço resolvido no servidor por mercado/período, metadados da organização, idempotência e sincronização de assinatura. O cartão é preenchido na Stripe. Não foram copiados segredos nem alterados seus produtos, código, assinaturas ou portal padrão.

O FlowNexa conserva sua implementação existente e a amplia: oito Prices permitidos no servidor, checkout com idioma, troca segura de checkout não pago, webhook assinado e deduplicado, assinatura consultada diretamente na Stripe, portal exclusivo do aplicativo e limites. A credencial foi preparada na conta CoreUnit que contém os três produtos Atenza; a verificação de titular foi concluída e os recursos exclusivos foram provisionados. Nenhuma cobrança real foi criada.

## Canais: recursos reais e implementação necessária

| Canal | Capacidade confirmada no provedor | Limites para o FlowNexa |
|---|---|---|
| [Facebook](https://docs.zernio.com/platforms/facebook) | Páginas, Messenger, comentários e comentário para resposta privada | Não é integração de perfil pessoal. Exige autorização da Página, callback por plataforma e controle de janela de mensagem. |
| [TikTok](https://docs.zernio.com/platforms/tiktok) | Comentários e respostas por DM para contas Business elegíveis | Não tem os botões e respostas rápidas do Instagram. Comentário não abre DM privada; sua automação pode responder publicamente. Exige adaptação dos tipos de mídia e permissões. |
| [YouTube](https://docs.zernio.com/platforms/youtube) | Ler e responder publicamente a comentários | A API usada não oferece DM. A chegada dos comentários pode depender de polling, sem presumir webhook instantâneo. |

O Manychat e o Chatfuel apresentam múltiplos canais; faz sentido expandir. A prioridade técnica recomendada é Facebook, por compartilhar recursos de mensagens mais próximos aos do Instagram. Depois, TikTok Business com grafo adaptado e YouTube com automações públicas de comentários. Eles ainda não estão implementados nem incluídos como canais ativos nos planos publicados nesta mudança.

Para implementar de verdade:

1. Acrescentar plataforma tipada à identidade da conexão e ao estado OAuth, preservando contas Instagram existentes. Usar prefixo de plataforma nos identificadores e manter a vinculação ao perfil Zernio e ao workspace.
2. Adicionar endpoints e callbacks OAuth por canal. No Facebook, manter a etapa de escolha da Página; no TikTok, verificar a via Business; no YouTube, validar o canal Google autorizado.
3. Normalizar eventos conforme o canal, sem presumir IDs numéricos do Instagram para todos. Verificar HMAC, perfil, conta, remetente, ecos e standby antes da fila.
4. Validar o grafo por capacidades: recusar respostas privadas a comentários e botões onde não existem. O primeiro comentário no YouTube deve produzir resposta pública, nunca uma DM inventada.
5. Adaptar envio e janela permitida por plataforma. Manter opt-out, deduplicação, resultados incertos e limites financeiros por workspace.
6. Para YouTube, usar polling com cursor e deduplicação. Mostrar o atraso esperado sem anunciar entrega instantânea.
7. Testar OAuth, isolamento entre clientes, replay, desconexão e uma interação real por canal antes de disponibilizá-lo comercialmente. A conexão externa requer consentimento do titular; não conectar recursos que o usuário não selecionou.

## Validação e ativação

Passaram 180 testes Node e navegador com português/inglês, troca manual, anual integral, preservação do plano escolhido, checkout embutido com provedor simulado e renderização móvel. Os testes de provisionamento garantem separação do catálogo Atenza e nenhum endpoint de cobrança direta. Não houve pagamento real de teste.

Produção ativada após verificação do titular: credencial restrita, dois produtos/oito Prices e webhook/portal exclusivos do FlowNexa configurados na Vercel; release publicado. Checkout real criado, montado e expirado sem pagamento. A confirmação financeira por webhook aguarda uma transação real. O script de provisionamento mantém o segredo do webhook no servidor e não o imprime. Não se deve inventar IDs nem reutilizar/rotacionar o webhook de outro aplicativo.

O corte `BILLING_LEGACY_BEFORE` preserva os espaços criados antes do lançamento. Com `BILLING_ENFORCED=true`, novos espaços precisam de assinatura ativa para conectar canais, publicar e executar automações. O portal permite gerenciar pagamento e cancelamento no fim do período; upgrade e troca de ciclo podem gerar pró-rata informada pela Stripe. A ativação deve ocorrer com credenciais e webhook verificados, sem interromper os fluxos já publicados do Gilberto.
