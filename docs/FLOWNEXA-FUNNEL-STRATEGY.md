# FlowNexa — estratégia e conteúdo original do funil

Preparado em 16/10/2026. Escopo: vender a ferramenta com uma conversa demonstrável, sem inventar funcionalidades, preços ou resultados. A implementação da campanha pertence ao fluxo `auto1`; este documento não altera nenhuma automação.

## Decisões

- Preservar **a frase inicial inteira que já existe em auto1, literalmente**. Não reescrever, abreviar ou substituir por este documento. Os blocos abaixo começam depois dela e devem respeitar o contexto da resposta recebida.
- Uma automação ativa da campanha: `auto1`. A configuração dos demais fluxos é responsabilidade da implementação operacional, fora deste artefato.
- Entregar primeiro uma explicação útil e o guia prometido. Só depois convidar a conhecer o aplicativo.
- Não pedir e-mail para liberar o guia. Depois de uma resposta real no Direct, entregar um botão de acesso ao PDF público.
- Imagens explicativas devem representar a interface/fluxo e benefícios reais. Não usar gráficos de receita, selos de certificação, depoimentos ou interfaces de IA/CRM inexistentes.

## Referências primárias e limites da pesquisa

A ClickFunnels descreve a organização **Hook, Story, Offer** como uma maneira de estruturar atenção, contexto e oferta. Usamos apenas a ideia de organização, com copy original. [Fonte oficial](https://www.clickfunnels.com/blog/lead-generation-sales-funnel/).

O artigo oficial sobre [lead magnet](https://www.clickfunnels.com/blog/lead-magnet-funnel/) apresenta conteúdo útil antes de uma oferta mais exigente. Adaptamos essa sequência ao Direct e **retiramos o formulário de e-mail**. Isso é uma decisão do FlowNexa; não uma recomendação de que a pessoa deva entregar seus dados.

A [explicação oficial de Value Ladder](https://www.clickfunnels.com/blog/funnel-course/) ajuda a pensar em próximos passos progressivos. Neste projeto, os passos são guia → exemplo → aplicativo. Não criamos planos, valores ou níveis pagos fictícios. São heurísticas de marketing da própria empresa, não prova de conversão nem classificação mundial de especialistas. Russell Brunson/ClickFunnels não endossam o FlowNexa.

Na parte operacional, a [coleção oficial Instagram Login da Meta](https://raw.githubusercontent.com/fbsamples/messenger-platform-samples/main/postman/instagram-platform-api.postman_collection.json) documenta a primeira resposta privada ao comentário, o recebimento de respostas e os formatos de mensagem. Uma resposta privada ao comentário não autoriza uma sequência sem nova interação da pessoa; as continuações precisam respeitar a janela aplicável. Curtidas e novos seguidores não são gatilhos de DM deste produto.

## A oferta e o conteúdo entregue

**Título:** 7 mensagens para transformar comentários em conversas.

**Promessa concreta:** sete textos adaptáveis em português, com contexto de uso, um exemplo de sequência e uma lista de verificação para publicar com clareza. Não promete vendas, crescimento ou renda.

**Arquivo:** `/assets/funnel/flownexa-guia-direct.pdf`.

**URL pública após o deploy:** `https://flownex.online/assets/funnel/flownexa-guia-direct.pdf`.

**Fonte editável:** `docs/funnel-source/build_guide.py`. Gerar com `python3 docs/funnel-source/build_guide.py`; usa ReportLab e fontes Arial do macOS, sem rede ou credenciais. O desenho da marca usa os caminhos do SVG original do projeto.

O PDF tem seis páginas: capa; mensagens 1–2; mensagens 3–4; mensagens 5–6; mensagem 7 e sequência; checklist e convite ao aplicativo. Não contém texto copiado de livros, nem cópia dos artigos citados.

## Copy original sugerida para os blocos após a abertura preservada

### Atenção: uma pergunta específica

“Hoje você responde no braço às mesmas perguntas no Instagram ou já usa algum fluxo?”

Botões de resposta: **Respondo manualmente** → `MANUAL`; **Já uso automação** → `AUTOMACAO`; **Quero só o guia** → `GUIA`.

Se isso alongar a abertura existente, não adicionar duas perguntas ao mesmo tempo: aguardar primeiro a resposta à pergunta que já estiver no bloco original.

### Contexto: mostrar o mecanismo, sem inventar uma história de cliente

**Manual:** “Imagine alguém comentando CATÁLOGO no seu post. O FlowNexa pode iniciar a resposta configurada e, quando a pessoa responder no Direct, continuar pelo caminho escolhido. Você prepara as mensagens e os próximos passos no editor visual.”

**Já usa automação:** “A proposta aqui é deixar o caminho visível: mensagem, espera, escolha e próximo passo. Você pode conectar imagens, vídeos e botões, com os envios condicionados à interação da pessoa e às permissões da Meta.”

**Imagem explicativa 1:** comentário → primeira mensagem → resposta real no Direct. Legenda: “A conversa continua depois da resposta.”

**Imagem explicativa 2:** pergunta → escolha → catálogo/vídeo/agendamento. Legenda: “Uma escolha, um próximo passo relevante.”

**Imagem explicativa 3:** editor com nós e saídas nomeadas. Legenda: “Configure o caminho antes de publicar.” As imagens da campanha são produzidas separadamente; não constituem evidência de resultado comercial.

### Entrega do guia

“Separei um guia original com sete mensagens adaptáveis para você organizar esse primeiro contato. Ele também traz um exemplo de sequência e um checklist de publicação. Pode abrir sem informar seu e-mail.”

Botão **Abrir guia gratuito**: `https://flownex.online/assets/funnel/flownexa-guia-direct.pdf`.

Outro botão de resposta **Ver um exemplo** → `EXEMPLO`. O clique no link do PDF não deve ser interpretado como uma resposta recebida nem como confirmação de leitura.

### Explicação após EXEMPLO

“Um exemplo simples: a pessoa pede o catálogo, você entrega o link, pergunta o que ela procura e conecta a escolha ao próximo bloco. Se não houver resposta, um lembrete só é enviado quando a janela permitida continuar aberta. Uma curtida ou um novo seguidor, por si só, não dispara um Direct.”

### Convite ao produto

“Quer montar esse caminho para o seu Instagram? No FlowNexa você encontra modelos e um editor visual para organizar mensagens, escolhas, mídia e esperas. Confira no aplicativo os recursos e as opções de contratação disponíveis.”

Botão **Conhecer FlowNexa**: `https://flownex.online/app#signup`. Botão de resposta **Tenho uma dúvida** → `DUVIDA`.

O texto não anuncia teste por prazo determinado, preço, pagamento ativo, IA autônoma, CRM ou atendimento humano imediato. Se a configuração comercial mudar, validar antes de atualizar a oferta.

### Dúvida ou encerramento

“Qual parte você quer entender: conexão do Instagram, criação dos fluxos ou funcionamento das mensagens?”

Usar escolhas predefinidas e respostas revisadas; não apresentar isso como um agente de IA capaz de responder qualquer pergunta.

**Sem interesse:** “Tudo certo. Você pode aproveitar o guia e voltar quando fizer sentido. Encerramos por aqui.”

**Sem resposta:** no máximo um lembrete neste desenho: “Quer que eu mostre o exemplo ou prefere ficar só com o guia? Se não for o momento, tudo bem.” Somente dentro da janela permitida e depois de uma resposta real do usuário. Não reiniciar a campanha automaticamente.

## Estrutura dos nós

`Abertura original preservada → Aguardar resposta → Menu → Aguardar resposta → Múltiplos caminhos → Explicação/imagem OU guia → Convite opcional → Encerrar`.

Fluxo iniciado por comentário: primeiro envio privado em texto. Aguardar a resposta real antes de mídia, botões e continuação. Fluxo iniciado por DM: continuar somente na janela válida. Vídeo e cartão com botão são nós/envios separados. `web_url` abre uma página; `postback` envia uma escolha que pode retomar o fluxo.

## Medição e critério de aprovação

Medir com eventos efetivamente registrados: inícios elegíveis; primeira mensagem aceita pela Meta; respostas reais; seleção de `GUIA`, `EXEMPLO` e `DUVIDA`; erros e estados incertos. Botão enviado não significa clicado; clique não significa leitura; visita ao aplicativo não significa cadastro ou pagamento. Não fabricar essas métricas.

Antes da publicação, conferir: primeira frase inalterada; somente `auto1` recebendo os gatilhos da campanha; PDF público abre no celular; links corretos; caminhos GUIA/EXEMPLO/DUVIDA/sem interesse/sem resposta; replay sem duplicatas; limites da janela; pausa; eventos assinados. Publicar só depois da revisão do fluxo operacional. Este documento e o PDF não ativam envios.
