# Diagnóstico da conexão Facebook — 18/10/2026

Status: investigação sem novas tentativas OAuth, sem cliques de consentimento, sem alterações nas contas. Não foi identificada uma causa única comprovada. O Instagram não precisa ser desconectado para investigar este erro.

## Evidência observada na sessão

O callback do provedor retornou:

```json
{"error":"no_facebook_pages","error_reason":"no_pages_granted","stage":"callback","request_id":"f32142d5-c8b3-47fa-b490-c7834b29c557"}
```

O seletor de Páginas não apareceu e nenhuma conta remota Facebook foi criada. A identidade Meta utilizada foi Andre Almeida. O perfil Zernio destinado à AMB Boutique é separado do Instagram existente. Esses fatos foram fornecidos pela captura da sessão; esta investigação documental não repetiu a autorização.

## Significado documentado

A documentação atual do próprio Zernio distingue:

- `pages_permission_declined`: a permissão de listar Páginas foi recusada.
- `no_pages_granted`: permissão concedida sem nenhuma Página selecionada; um usuário sem Páginas gerenciáveis produz o mesmo diagnóstico.
- `granted_pages_not_listed`: havia Páginas selecionadas, mas a consulta e a leitura direta não produziram um token de Página.

`stage=callback` significa que o provedor processou o código retornado. O identificador da requisição permite consultar o diagnóstico do provedor. Isso descreve a classificação feita pelo Zernio; não equivale à inspeção independente do token da Meta. [Referência oficial do callback](https://docs.zernio.com/connect/get-connect-url).

O serviço exige uma Página e acesso de administrador ou editor. `business_management` participa da descoberta de Páginas vinculadas ao Business Manager e pertence à área `ads`. A solicitação atual reduz as áreas para `comments,messaging`. [Requisitos e permissões Facebook](https://docs.zernio.com/platforms/facebook).

## O delimitador de permissões

A captura recebeu um `authUrl` cujo parâmetro Meta `scope` usa espaços. O SDK PHP oficial arquivado do Facebook usa `implode(',', $scope)` ao construir a URL. Isso demonstra uma serialização oficial histórica com vírgulas; não prova que a Meta atual rejeite espaços. [Código oficial, método getAuthorizationUrl](https://raw.githubusercontent.com/facebookarchive/php-graph-sdk/5.x/src/Facebook/Authentication/OAuth2Client.php).

O OAuth 2.0 define escopos separados por espaços, mas a norma geral também não prova qual variante a implementação atual do Facebook aceita. [RFC 6749, seção 3.3](https://www.rfc-editor.org/rfc/rfc6749#section-3.3).

A documentação atual de login da Meta não pôde ser recuperada nesta consulta: retornou HTTP 429 ou indisponibilidade. Portanto, não há confirmação primária atual de que o espaço seja inválido. Não normalizar a URL do provedor como correção comprovada, nem alterar delimitador e consentimento simultaneamente: isso impediria isolar a causa.

## Hipóteses, em ordem de evidência

| Ordem | Hipótese | Evidência e limite |
|---|---|---|
| 1 | O grant existente de SocialMediaConnector não inclui a Página AMB Boutique | Compatível diretamente com `no_pages_granted`; falta conferir os ativos concedidos nas integrações empresariais. |
| 2 | Andre Almeida não possui o tipo de acesso à Página que a API consegue enumerar, ou o ativo depende da descoberta do Business Manager | O mesmo erro cobre ausência de Páginas gerenciáveis. Ver a Página na interface, ter uma conta Instagram ou administrar anúncios não demonstra, isoladamente, o grant correto para esta aplicação. |
| 3 | O provedor não enumerou corretamente um ativo ou grant que está válido | Torna-se prioritária se Página, papel e grant forem comprovados. Exige diagnóstico correlacionado do Zernio; não recriar a aplicação nem trocar de provedor com base apenas no erro. |
| 4 | A serialização de `scope` com espaços causou a falha | Anomalia ainda não comprovada; o erro não identifica separador inválido e há distinção explícita para permissão recusada. |
| 5 | Limite de plano impediu a conexão | Não corresponde ao erro capturado, que é de descoberta/concessão de Páginas. Os dados de uso observados também não demonstram esgotamento; não contratar plano para testar esta hipótese. |

## Contrato local do FlowNexa

`src/facebook-api.js` solicita a URL ao provedor com `scopes=comments,messaging` e preserva o `authUrl`. O callback consome o estado de uso único, identifica o erro do provedor e retorna uma mensagem local. A exigência de `connected=facebook`, `profileId` e `accountId` só é avaliada depois do ramo de erro. Assim, o diagnóstico capturado é anterior à persistência da conta local; não é causado pela validação local do ID da Página ou pelo runtime de automações.

O fluxo padrão usa o seletor hospedado pelo Zernio. Trocar para headless somente para contornar a ausência do seletor não cria um grant de Página inexistente. [Contrato do fluxo padrão e headless](https://docs.zernio.com/guides/connecting-accounts).

## Próxima validação única

Antes de qualquer nova autorização, inspecionar apenas a configuração existente de **SocialMediaConnector**, os ativos concedidos e o acesso de **Andre Almeida** à Página **AMB Boutique**. Registrar apenas nome/ID da Página, tipo de acesso e se a Página aparece como concedida. Não remover a integração nem alterar acesso.

Critério: se a Página não estiver concedida ou o acesso não for elegível, há um pré-requisito concreto a corrigir com o proprietário antes de uma única tentativa posterior. Se ambos estiverem corretos, suspender novos OAuth e usar o request_id acima para exigir a distinção entre ausência de alvo no token e falha de enumeração do provedor. Não enviar suporte sem autorização para a mensagem externa.

Somente depois de resolver esse ponto, a prova completa será: Página aparecendo no seletor → callback com conta Facebook remota → conta local no workspace correto. A conexão Instagram e seus fluxos devem permanecer com os mesmos IDs e estados.
