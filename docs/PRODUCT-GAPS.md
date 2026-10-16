# Oferta, concorrência e critérios de lançamento

Revisão: 2026-10-16. Escopo: página pública atual do FlowNexa e aplicativo real. Referências de concorrentes são declarações dos próprios fornecedores; não são testes independentes de qualidade. Preços podem mudar, variam por periodicidade e não são recomendações de valores finais.

## Referências comerciais

[Manychat — preços](https://manychat.com/pricing): Essential anunciado a US$14/mês, US$168 cobrados anualmente, 250 contatos ativos mensais incluídos; Pro a US$29/mês, US$348 anuais, 2.500 contatos incluídos. Há cobranças adicionais por contato. A oferta combina automações, canais e organização de conversas; o Pro acrescenta conversas com IA. Não comparar seu preço anual equivalente com uma cobrança mensal sem explicitar a diferença.

[InstantDM — preços](https://instantdm.com/pricing): Legend Pro anunciado a US$9,99/mês na cobrança anual; Trendsetter a US$24,99/mês anual. Free anuncia 500 automações mensais. Declara não cobrar por contato. Funcionalidades anunciadas incluem automações de comentários, Stories, Direct, captura de contatos, agendamento de publicações; o plano avançado acrescenta editor com IA e integrações. Esses recursos exigem implementação própria; não estão automaticamente disponíveis no FlowNexa por usar a mesma API.

[Manychat — Follow to DM](https://help.manychat.com/hc/en-us/articles/23096654243740-Follow-to-DM-on-Instagram-Say-Hi-to-New-Followers-BETA): acesso em beta depende de elegibilidade e conexão específica. Não prometer esse gatilho sem confirmar disponibilidade e autorização para nosso app.

## Inventário da página atual

A página já identifica demonstrações, depoimentos e resultados como ilustrativos; preços estão “Em definição”. Preservar o layout e não transformar esses exemplos em alegações de operação verificada.

| Oferta apresentada | Evidência / situação do produto |
| --- | --- |
| Comentários com palavra-chave → Direct | Runtime implementado; conta própria conectada; teste real de mensagem pendente |
| Palavras-chave no Direct e respostas a Stories | Implementadas e testadas com fronteira Meta simulada; confirmação real pendente |
| Links e catálogos | Texto e link configuráveis; não significa sincronização de estoque nem cartões de produtos |
| Fluxos visuais e painel de atividades | Salvamento, edição, simulação, publicação, pausa e histórico reais |
| Múltiplos perfis / espaços | Isolamento implementado; terceiros ainda dependem de homologação Meta |
| IA para Instagram | Não implementada; requer provedor, orçamento, base de conhecimento, avaliação e encaminhamento humano |
| Organização de contatos / interesses | Deduplicação operacional existe; CRM, tags e exportação ainda não implementados |
| Sequências / acompanhamento | Ações imediatas suportadas; esperas, condições e follow-ups agendados ainda não implementados |
| Shopify, WooCommerce, Make, Zapier, Sheets etc. | Referências de produto; conectores não implementados |
| Stripe | Integração recorrente embedded em implementação; conta, planos e teste real ainda necessários |
| Indicadores | Histórico de execução real; aceitação pela Meta não significa entrega, leitura, clique ou venda |

## Benefícios concretos da primeira versão

- Dez modelos úteis sem código, com detalhes editáveis e prévia antes de salvar.
- Caminhos explícitos para criar do zero ou usar modelo; progresso de conexão, rascunho e publicação.
- Conta conectada pela Meta, sem senha coletada pelo FlowNexa; chave de acesso criptografada no servidor.
- Fila durável, proteção contra duplicatas e resultados de envio incertos que não geram reenvio cego.
- Processamento de até 1.000 atualizações por envelope com recuperação após falha parcial.
- Cadastro, confirmação, recuperação de senha, cobrança recorrente e gestão de assinatura preparados para autoatendimento, conforme configuração de cada provedor.

## Política de preço e operação

Nenhum preço ou cobrança foi ativado nesta revisão. Definir valores, moeda, periodicidade, limites por plano e conta Stripe antes de vender. O cálculo mínimo precisa considerar custo variável por evento, D1, Vercel, e-mail, taxas Stripe, IA se adicionada, impostos aplicáveis, suporte e margem. Usar faixas de volume para evitar “ilimitado” que não seja sustentável. Não afirmar que não há custo ou trabalho operacional.

Priorizar os modelos, facilidade de uso e benefícios incluídos, em vez de anunciar superioridade geral ainda não demonstrada. Rotinas normais devem ser automáticas; expiração de permissões, disputas, falhas de provedores e questões de conta exigem detecção e tratamento de exceções.

## Gates reais ainda abertos

1. Mensagem real de uma segunda conta autorizada → webhook assinado → execução → ID Meta e confirmação do destinatário.
2. Aprovação Meta e acesso adequado para clientes sem papel de teste.
3. Conta Stripe correta reconectada; preços aprovados; Checkout embedded em sandbox completo → webhook → renovação/cancelamento/portal verificados.
4. Plano de cobrança com limites explícitos e critérios de acesso; integração sem gating comercial enquanto preços e política não forem definidos.
