# Onde o trabalho parou

Atualizado em 27/08/2026.

Este arquivo existe para uma sessão nova saber exatamente onde pegar, sem
reler a conversa anterior. **Mantenha-o ao fim de cada fase.**

---

## Fases

| Fase  | O quê                                                 | Situação                       |
| ----- | ----------------------------------------------------- | ------------------------------ |
| 0     | Fundação, `/health`, esteira                          | ✅ concluída                   |
| 1     | Design system, navegação de 5 abas                    | ✅ concluída                   |
| 2     | Fly ID: convite, onboarding, perfil, consentimento    | ✅ concluída                   |
| 3     | Home dinâmica, eventos, notificações, push, analytics | ✅ concluída                   |
| 4     | Minha Viagem: roteiro, cofre, QR, presença            | ✅ concluída                   |
| **5** | **Passeios, carrinho e pedidos**                      | 🟢 **entregue — uma ressalva** |
| 6     | Carteira e fidelidade (§41)                           | não iniciada                   |

Prova: `npm run verify` (**310 testes**) e a suíte pgTAP na esteira (**262
asserções**, 10 arquivos). A esteira agora também roda `deno check` nas Edge
Functions — elas não são workspace do npm e ficavam fora do `typecheck`.

---

## ⚠️ LEIA ISTO PRIMEIRO — por que o redesenho não ficou idêntico

Atualizado em 28/08/2026, no fim de uma sessão longa. **Este bloco é o handoff.**

### O erro, nomeado

O handoff do Claude Design tem dois arquivos, e eles não valem a mesma coisa:

| Arquivo                                    | O que é                                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `design_handoff_fly_app/README.md`         | Resumo **em prosa**. Descreve as medidas por escrito                                                                        |
| `design_handoff_fly_app/Fly Phone.dc.html` | **A especificação.** 118 KB, **636 blocos de `style=`** com o valor exato de cada elemento, e os caminhos SVG de cada ícone |

**Construí a tab bar, os flutuantes e a Início a partir do README.** Nunca abri
o HTML. O resultado tem as medidas certas e a estrutura errada — e ícones que
não são os do design, porque reaproveitei os antigos do projeto.

Exemplo medido: o ícone de Passeios do design é `<circle r="8.5">` mais o
ponteiro `M15.4 8.6l-2.1 4.7-4.7 2.1 2.1-4.7z`. O do app é outro desenho. A asa
do botão central é `fly-wing-gold.png`, não a branca tingida de dourado.

O `ESTADO.md` já avisava disso em 27/08: _"Antes de mexer em tela, leia o
canvas. Não implemente de memória nem do print."_ Repeti o erro que o próprio
projeto tinha documentado.

### O que fazer na sessão nova

**1. A verdade está extraída, tela por tela, em `docs/design/extracao/`.**
Oito arquivos, um por tela, sem base64 e com os estilos legíveis:

```
01-home.html  02-passeios.html  03-meus-passeios.html  04-minha-viagem.html
05-carteira.html  06-perfil.html  08-meus-passeios-sheet.html
```

Abra o da tela que for construir e **copie os valores de lá**. O README serve
para entender a intenção; o HTML é o que manda.

**2. Compare lado a lado, não de memória.** O protótipo roda: sirva
`design_handoff_fly_app/` por HTTP e abra `Fly Phone.dc.html` a 393×852 ao lado
do app no mesmo tamanho. Sem isso, "parecido" é opinião.

**3. Capture no Simulador, não no navegador.** A plataforma é iOS (registrado
em `apps/fly-mobile/PRODUCT.md`). Toda a verificação desta sessão foi feita na
web do Expo, que esconde diferença de fonte, de blur e de sombra.

**4. Um componente por vez, não uma tela por vez.** Ícones, chips, cards e
badges se repetem entre as telas. Acertar o átomo conserta cinco telas.

### O que já está certo e não precisa refazer

Infraestrutura, dados e as decisões de produto. O que precisa de revisão contra
o HTML é **só o visual** de: tab bar, flutuantes, banner e blocos da Início.

---

## Infraestrutura — trocada em 27/08/2026, e é a atual

O Fly App saiu de uma infraestrutura compartilhada para uma dedicada. Nada de
funcionalidade mudou; o código foi transplantado inteiro. Detalhe e motivo em
[ADR 0010](architecture/adr/0010-infraestrutura-dedicada.md).

|                      | Agora                                                     |
| -------------------- | --------------------------------------------------------- |
| Repositório          | `flydubaicompany-coder/FLYAPP` — **público**, `main`      |
| Supabase             | `ptmifjnfskwipjjxauns`, ca-central-1, Postgres 17.6.1.166 |
| Organização Supabase | `hwvwzmukubznorgbkkwn` — Supabase nativa, **não** Vercel  |
| Conta                | `flydubaicompany@gmail.com`                               |
| Vercel               | time **`app fly`** — 3 projetos no ar (abaixo)            |
| Expo / EAS           | **não vinculado** — sem `owner`, sem `eas.json`           |
| Cloudinary           | **não existe** — nenhuma referência no monorepo           |

| Aplicação | URL                                  |
| --------- | ------------------------------------ |
| Fly Ops   | `https://flyapp-fly-ops.vercel.app`  |
| Fly App   | `https://flyapp-cliente.vercel.app`  |
| Fly Crew  | `https://flyapp-fly-crew.vercel.app` |

**O projeto antigo (`ewgbseesocekvhiiscnb`) não foi tocado** e continua no ar
servindo o site IMMORTALS FLY. A P39 está fechada — não por alteração naquele
projeto, mas por saída dele.

**Não houve migração de dados, porque não havia dado:** 2 usuários de teste,
1 viagem, e 0 pedidos, 0 pagamentos, 0 passaportes, 0 documentos. Tudo é
reproduzível pelos seeds versionados.

O que foi comprovado no ambiente novo, em 27/08/2026:

| Verificação                               | Resultado                                    |
| ----------------------------------------- | -------------------------------------------- |
| 19 migrations aplicadas do zero           | todas, em ordem, sem erro                    |
| Tabelas em `public`                       | 70, **zero `immortals_*`**                   |
| Seeds                                     | os três, aplicados                           |
| Buckets                                   | `documentos` (privado), `passeios`           |
| Edge Functions                            | as 4, publicadas e ACTIVE                    |
| Tipos do banco novo × versionados         | **zero diferença de schema**                 |
| `npm run verify`                          | exit 0, **310 testes**                       |
| Esteira no repositório novo               | verde, **262 asserções pgTAP** (10 arquivos) |
| RLS de amostra (`app_config` para `anon`) | recusado com `42501`                         |

---

## ⚠️ Leia isto antes de tudo — redesenho em curso

Em 27/08/2026 o dono do produto disse, sobre o app que estava construído:
**"tá horrível de feio, segue exatamente esse design que fiz no Claude
Design"**. Isso reordena a prioridade: **fidelidade ao canvas vem antes de
funcionalidade nova.** Não abra a Fase 6 antes de as telas estarem como o
design.

### De onde vem o design

O projeto é **"Fly App mobile premium"**, `8687d656-962d-4c07-a041-d985666c3d1d`,
arquivo `Fly App.dc.html`. O `docs/design/canvas/Fly App.dc.html` versionado
aqui é de **24/08 e está velho** — não tem Perfil nem Carteira.

O dono exportou o atual para `~/Downloads/Fly App (offline).html` (6 MB). Como
ler, porque não é óbvio:

```
linha 381  -> JSON com 4 recursos gzip+base64
             `e56397ec…` (5,7 MB) é o HTML das telas
linha 393  -> a capa do canvas (título, notas, SISTEMA, próximos passos)
```

98% do peso são as fotos em base64. Descontadas, **o markup útil são 91 KB** —
perfeitamente legível. Extraia com um script, troque cada `data:` por um
marcador e leia o que sobra.

### O que o design especifica, e que o código não cumpria

|                     | Canvas                                                     | Estava                            |
| ------------------- | ---------------------------------------------------------- | --------------------------------- |
| Card de passeio     | foto sangrando, 244 px, raio 30, degradê no terço de baixo | bloco de texto com preço no canto |
| Prateleira          | empilha na vertical, largura toda                          | trilho horizontal de 260 px       |
| Barra Meus Passeios | três capas empilhadas + contador dourado                   | linha de texto                    |
| Busca               | campo de 44 px com lupa                                    | `TextInput` solto                 |
| Seção               | título + "Ver tudo" dourado                                | só título                         |

**Já feito:** a tela Passeios (`(tabs)/passeios.tsx`), o `CardPasseio.tsx` e o
`useMeusPasseios.ts`.

**Falta:** Início, Meus Passeios, Carteira e Perfil.

### O que trava a aparência agora

`tour_media` está **vazio** — sem foto, o card cai no formato compacto, que é
exatamente o que o dono achou feio. As cinco fotos do canvas estão extraídas em
`docs/design/fotos/`:

| Passeio                | Foto               |
| ---------------------- | ------------------ |
| Topo do Burj Khalifa   | `burj-khalifa.jpg` |
| Barco pela Marina      | `marina-yacht.jpg` |
| Voo de helicóptero     | `helicoptero.jpg`  |
| Jantar no Souk Madinat | `burj-al-arab.jpg` |
| Iate privativo         | `dubai-frame.jpg`  |

**Subir exige o dono**: o Storage precisa de credencial que o agente não tem, e
o painel exige senha, que o agente não digita. Caminho: `npm run dev:ops` →
Catálogo → abrir o passeio → bloco Mídia.

### Pacote ≠ nível — correção do dono, já aplicada

- **Standard / Black / Billionaire** = o **pacote** que o cliente adquiriu
- **basic / prime / elite** = o **nível de Fly Points**

Estavam misturados: o canvas rotula as três cores como "FLY STATUS", a spec
fala em nível na §851 e em pacote na §694, e o token chamava `flyStatus`. Já
renomeado para `flyPackage`, com `FLY_POINTS_LEVELS` ao lado. Os níveis **não
ganharam paleta** — o canvas não os desenhou e a §33 proíbe inventar. Ver D95 e
D96.

Falta propagar para o banco e para as telas de Carteira e Perfil.

---

---

## Fase 5 — o que já está pronto

**Motor comercial, com todos os critérios da §40 provados em pgTAP**
(`supabase/tests/passeios.test.sql`, 42 asserções):

- catálogo, variantes, horários, favoritos, pedido de proposta
- carrinho persistente com reserva temporária
- `select … for update` no slot: concorrência não fura estoque
- preço recalculado no servidor em `criar_pedido()`
- moeda única por pedido; carrinho com moedas misturadas é **recusado**
- idempotência do pedido por chave e do webhook por `(provider, provider_event_id)`
- política de cancelamento copiada para dentro do pedido, com versão
- reembolso total e parcial, sem apagar histórico

**Telas do cliente:** `(tabs)/passeios.tsx`, `passeios/[slug].tsx`,
`carrinho.tsx`, `passeios/pedido/[id].tsx`, `passeios/meus.tsx`,
`passeios/proposta.tsx`.

**Telas do Fly Ops:** `Catalogo.tsx` (publicar, inventário) e `Pedidos.tsx`
(pedido, reembolso).

**Checkout em sandbox (§40.9 e §40.10)** — entregue em 27/08/2026:

- `packages/payments`: interface `ProvedorDePagamento`, `ProvedorSandbox`,
  `ProvedorDesligado` e `escolherProvedor` (timeout, log, fallback, flag).
- `supabase/functions/pagamento-sandbox`: o PSP falso. Chama
  `iniciar_pagamento()` com o JWT do usuário e entrega um evento assinado ao
  webhook, pela rede — como um provedor real faria.
- `supabase/functions/pagamento-webhook`: confere HMAC-SHA256 sobre o corpo
  cru e chama `registrar_evento_pagamento()` com `service_role`.
- `supabase/functions/_shared/assinatura.ts`: assinar, conferir, janela de
  replay, comparação em tempo constante. Testado pelo vitest **importando o
  próprio arquivo**, não uma cópia.
- Migration `20260827000000`: flag `payments.checkout` (nasce **desligada**) e
  `app_config['payments.provider']` (nasce `PENDENTE`).
- Tela do pedido: botão "Pagar agora" quando há provedor, aviso de ambiente de
  teste quando não é produção, e o antigo "a Fly entra em contato" como
  fallback quando o adapter devolve `indisponivel`.

**Participantes do pedido (§40.5, §6.5 passo 5)** — entregue em 27/08/2026:
`definir_participantes()` grava a lista inteira de uma vez, recusando mais
nomes do que vagas compradas, e a tela `passeios/participantes/[pedido]` abre
um campo por vaga. Só nome: o passaporte fica no cofre, com consentimento e
registro de quem leu, e copiá-lo para dentro do pedido criaria uma segunda
cópia fora daquele controle.

**Seções da vitrine (§40.1)** — entregue em 27/08/2026. Seis prateleiras, três
fontes: `selo` (Trend e Fly Exclusives saem de `tours.badge`), `curada` (lista
a dedo do painel) e `destino_da_viagem` (o slot "perto de você", pelo destino
da viagem ativa — **sem GPS**). `vitrine_de_passeios()` resolve no servidor,
`passeios/useVitrine.ts` agrupa, e a página **Vitrine** no Fly Ops publica e
cura. Seção vazia não aparece, nem publicada.

**Não existe algoritmo de recomendação, e não foi inventado um.** As
preferências do onboarding são texto livre e nada liga "gosta de rock" a um
passeio. Por isso a seção se chama "A Fly recomenda", e não "recomendados para
você" — a diferença é entre uma promessa que o sistema cumpre e uma que não
cumpre. Ver P40.

**Inclusão na viagem (§40.11)** — entregue em 27/08/2026.
`incluir_pedido_na_viagem()` liga e desliga (omitir a viagem desliga), o botão
está em Meus Passeios, e o roteiro mostra a compra num bloco **"Você comprou"**,
separado das atividades.

A compra **não vira `activities`**: aquela tabela é território da operação — só
`can_operate_trip` escreve — e uma cópia ficaria no roteiro dizendo que o
passeio acontece depois de o pedido ser cancelado. O roteiro lê os pedidos
ligados e mostra ao lado. A separação também é honesta na tela: atividade é o
que a Fly organizou e responde por; compra é escolha da pessoa, e a diferença
importa no dia em que algo atrasa.

**Mídia e fornecedor no Fly Ops (§40.13)** — entregue em 27/08/2026. Bucket
`passeios` **público**, ao contrário de `documentos`: foto de passeio é
material de vitrine, e assinar URL por card custaria uma ida ao servidor por
imagem para esconder o que a Fly quer que circule. Escrita restrita a operador.
O componente `MidiaEFornecedor` envia, descreve e remove; o card do cliente
finalmente **mostra a foto** — `imagem` existia no tipo e nunca era renderizada.

O fornecedor tem identificação e contato, e **nada de comercial**: sem
comissão, prazo, vigência ou SLA. Isso é regra comercial, e campo vazio para
esses valores convida um palpite a virar acordo (§33). `on delete set null`:
perder o fornecedor não apaga o passeio do catálogo.

⚠️ **Construído e não demonstrado.** As duas funções passam no `deno check`,
mas nunca rodaram: falta publicá-las e definir o segredo. Ver "O que fazer
agora", abaixo.

---

## O que só o dono pode fazer

Atualizado em 27/08/2026, depois da troca de infraestrutura. Em ordem: o item 1
**bloqueia todos os outros** — sem ele ninguém entra em lugar nenhum.

### 1. Criar o primeiro operador — bloqueia tudo

O banco novo nasceu **sem usuário nenhum**. A Fly é por convite (§37.1) e não
há cadastro aberto, então existe um ovo-e-galinha: convite só é emitido por
quem já é operador. O primeiro é criado à mão, uma vez.

No painel do projeto `ptmifjnfskwipjjxauns`:

1. **Authentication → Users → Add user → Create new user.** E-mail e senha à
   sua escolha, com **Auto Confirm User** ligado.
2. **SQL Editor**, e rode — trocando o e-mail:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin'::public.fly_role from auth.users where email = 'SEU@EMAIL';
   ```

Depois disso o Fly Ops abre, e dele saem os convites para todo o resto.

### 2. ~~Definir `FLY_PAYMENTS_WEBHOOK_SECRET`~~ — feito em 28/08/2026

O segredo está no projeto. Falta só, quando quiser exercitar o checkout:
ligar a flag `payments.checkout` e pôr `app_config['payments.provider']` em
`"sandbox"`. **A flag nasce desligada de propósito.**

### 3. ~~Subir as cinco fotos~~ — feito em 28/08/2026

As cinco fotos estao no bucket `passeios` e o catalogo de demonstracao esta
publicado: 5 passeios, 140 horarios, vitrine com Trend e A Fly recomenda. O
preco foi decidido pelo dono (199 no Burj Khalifa, 250 nos outros); o resto e
placeholder marcado. Ver D104 e a P41.

**Isso destravou um bug que estava escondido** — ver D103 e a armadilha do
`Link asChild`, abaixo.

### 4. Decidir Expo/EAS e Cloudinary

A Vercel foi resolvida em 28/08/2026. Os dois abaixo continuam sem vínculo —
e nunca tiveram, nem antes da troca.

| O quê      | O que falta                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo / EAS | Qual conta. Hoje não há `owner`, `projectId` nem `eas.json`. Sem isso não existe build nativo                                                      |
| Cloudinary | Qual conta e qual responsabilidade. Recomendação registrada: catálogo e vitrine no Cloudinary; **passaporte e cofre continuam no Storage privado** |

### 5. Leaked Password Protection

No painel do projeto novo: Authentication → Policies. Não estava ligado no
projeto antigo e o projeto novo nasce igual.

---

## Auditoria de 27/08/2026 — o que foi conferido

Varredura das Fases 0 a 5. **A esteira estava verde e continua**; o que segue é
o que os testes não pegavam.

**Corrigido:**

| O quê                                                              | Onde                 |
| ------------------------------------------------------------------ | -------------------- |
| Falha de rede era anunciada como "este evento não está disponível" | `eventos/[slug].tsx` |
| Falha de rede era anunciada como "este pedido não existe"          | `pedido/[id].tsx`    |
| Falha de rede era anunciada como "sem passaporte cadastrado"       | `viagem/voos.tsx`    |
| Exceção dentro do IIFE deixava a tela no esqueleto para sempre     | `eventos/[slug].tsx` |
| Registro remoto da migration não batia com o nome do arquivo       | `schema_migrations`  |

**Conferido e correto — não mexi:**

- Zero `TODO`, `any`, `@ts-ignore`, `eslint-disable` ou `console.log` nas 211
  fontes. Menções a `service_role` são comentários e a própria guarda.
- Toda tela que busca dado trata carregando, erro e vazio. As em branco são
  formulário estático ou `PhaseStub` honesto de fase futura.
- Offline mora em camada compartilhada (`OfflineBanner`, `StateShell`), não
  repetida por tela.
- Fly Crew é só a casca com `/health` — e é o correto: o conteúdo dele é da
  Fase 7 (§42).
- Os quatro itens que faltam na Fase 5, abaixo, foram verificados um a um:
  faltam mesmo.
- Descartar o `error` continua em três lugares onde degrada para **menos** e
  não para **diferente**: chips de filtro, dropdown de template e a flag de
  biometria. Registrado como D82.
- `registrar_evento_pagamento` **não** aparece na lista de funções executáveis
  por `authenticated` do advisor — o grant revogado está valendo no ar.

**Achado estrutural — virou P39, e foi RESOLVIDO em 27/08/2026** pela troca de
infraestrutura (ADR 0010). O relato abaixo é o diagnóstico de então: o projeto
Supabase não era mais dedicado ao Fly App. O site IMMORTALS FLY tem três tabelas e cinco migrations lá dentro, que é
exatamente o que a [ADR 0004](architecture/adr/0004-backend-supabase.md)
descartou. Medido: não é caminho para passaporte nem pagamento. Mas
`supabase db reset` contra aquele projeto apagaria o site, e o advisor do Fly
App passou a devolver alerta que não é do Fly App. **Nada foi movido.**

---

## Fase 5 — o que FALTA

_(nada — todos os itens foram entregues; ver a ressalva do pagamento acima)_

---

## Decisões esperando o dono do produto

Todas estão em [architecture/DECISION_LOG.md](architecture/DECISION_LOG.md).
As que travam alguma coisa:

| #   | O quê                              | Trava                                    |
| --- | ---------------------------------- | ---------------------------------------- |
| P30 | Base legal do analytics            | nada; hoje é consentimento opt-in        |
| P31 | Fornecedor de analytics            | eventos são coletados e descartados      |
| P32 | Credenciais APNs/FCM               | push remoto                              |
| P34 | Retenção de documento              | produção com cliente real                |
| P35 | Quando mostrar dados do motorista  | nada; hoje some até a operação preencher |
| P36 | Aviso de privacidade do passaporte | nada                                     |
| P37 | Validade mínima do passaporte      | alerta usa só aritmética                 |
| P38 | **Provedor de pagamento**          | **checkout de verdade**                  |

Configuração marcada `PENDENTE` em `app_config`, esperando valor:
`meals.confirmation_deadline_hours`, `support.emergency_contacts`,
`points.earn_formula`, `status.tiers`,
`documents.passport_min_validity_months`, `cart.hold_minutes`.

E uma que só o dono faz, no painel do Supabase:
**Authentication → Policies → habilitar Leaked Password Protection.**

---

## Armadilhas já pagas — não repetir

Estão detalhadas em [quality/TEST_MATRIX.md](quality/TEST_MATRIX.md) e no
decision log. O resumo:

- **RLS em `UPDATE`/`DELETE` filtra linhas, não lança.** Em `INSERT` lança.
  GRANT ausente lança antes da RLS. Três comportamentos, três formas de testar.
- **`grant select` não restringe nada no Supabase** — só `revoke` fecha.
- **`raise exception` desfaz o `insert` na auditoria.** Negativa que precisa
  ser registrada volta como dado (`permitido: false`), não como exceção.
- **Nome dentro de política de RLS e de função plpgsql precisa ser
  qualificado.** `sa.trip_id = trip_id` virou tautologia; `order_id` colidiu
  com parâmetro de saída.
- **UUID de teste escrito à mão:** `o` e `p` não são hexadecimais.
  `npm run verify` checa.
- **Subquery dentro de um teste pgTAP roda sob a RLS do papel atual.** Um
  `(select id from order_items limit 1)` lido como o cliente errado devolve
  `NULL`, a função recebe `NULL`, responde "não encontrado" e **nunca chega a
  lançar** — o teste de acesso negado passa a testar outra coisa. Guarde o id
  numa config da transação (`set_config`, num bloco `do`) enquanto ainda é
  `postgres`, e leia com `current_setting`.
- **`database.types.ts` vem da esteira**, não do MCP remoto — o gerador local
  inclui `graphql_public`. E o arquivo termina com **linha em branco**.
- Imports internos dos packages **sem** extensão `.js`.
- **O `.dc.html` exportado do Claude Design não é o que parece.** 6 MB, 395
  linhas: a linha 381 é um JSON com quatro recursos em gzip+base64 (as telas
  estão no de 5,7 MB) e a linha 393 é só a capa do canvas. 98% do peso são
  fotos; descontadas, o markup útil são 91 KB.
- **`npx skills add` e `npx impeccable install` põem código de terceiro em
  `.claude/skills`, `.agents`, `.codex` e `.github`.** O ESLint passou a acusar
  8.052 problemas até esses caminhos entrarem no ignore.
- **`supabase db push --include-seed` NAO reexecuta um seed ja aplicado** quando
  o conteudo do arquivo muda — ele so atualiza o hash e segue. Conteudo novo
  precisa de **arquivo novo**. Custou uma rodada achando que o SQL tinha
  falhado em silencio.
- **No React Native Web, filho `position: absolute` pinta por cima de irmao
  estatico**, mesmo vindo antes no JSX. O gradiente do botao de carrinho
  cobriu o icone inteiro. Quem precisa ficar por cima leva `zIndex`.
- **`<Link asChild>` do expo-router nao repassa o `style` do `Pressable`.** O
  elemento do link recebe `css-view`, `r-cursor` e `r-touchAction` e mais nada:
  some altura, raio, fundo e borda. Com altura fixa, o card colapsa para zero e
  a tela vira pilha de texto sobreposto. Ponha o estilo num `View` interno, via
  funcao-filho `{({ pressed }) => ...}`. Ficou escondido meses porque sem foto
  o codigo caia noutro componente.
- **O Metro não popula `process.env` — ele substitui no código.** Passar
  `process.env` inteiro para uma função que indexa por chave montada em tempo
  de execução funciona no servidor de desenvolvimento e **falha no bundle de
  produção**, onde nada é inlinado e o app sobe sem ambiente. Leia cada
  `EXPO_PUBLIC_*` por referência estática. No Vite não acontece:
  `import.meta.env` é objeto de verdade. Custou o primeiro deploy da web.
- **Root Directory da Vercel fica VAZIO** nos três projetos. Apontar para
  `apps/<app>` faz o `npm install` rodar sem enxergar `packages/`, e o build
  morre com `Cannot find module '@fly/design-tokens'` — os packages são
  TypeScript cru. Quem separa os projetos é o Build Command e o Output
  Directory. E sem `vercel.json` com rewrite na raiz, **toda rota interna dá
  404**.
- **`config.toml` precisa declarar `verify_jwt` de TODA Edge Function.** O que
  não está lá sobe com JWT obrigatório no deploy pela CLI. `aceitar-convite`
  roda sem JWT por decisão (D30) e não estava declarada — a ativação de convite
  teria quebrado em silêncio no projeto novo. Só apareceu porque houve troca de
  projeto; num redeploy comum, ninguém notaria.
- **`erasableSyntaxOnly` recusa parameter property.** `constructor(private x)`
  não compila; declare o campo e atribua no corpo.
- **`deno check` num arquivo de `_shared/` direto na linha de comando herda o
  `@types/node` do workspace** e transforma o `crypto` global em erro de tipo
  que só existe ali. Cheque os `index.ts`; o `_shared` vai junto, transitivo.

---

## Como retomar

```bash
cd /Users/psg.vito/Downloads/FLY/fly-ecosystem
npm install
npm run verify          # lint, format, UUID em SQL, typecheck, testes
```

O repositório é `flydubaicompany-coder/FLYAPP` e o Supabase é
`ptmifjnfskwipjjxauns` — já vinculado por `supabase link`. A CLI vive em
`./node_modules/.bin/supabase`; `npx supabase` tenta baixar outra versão e
falha.

Sem Docker local. A suíte pgTAP roda na esteira — e passou verde no
repositório novo, 262 asserções em 10 arquivos. Para verificar antes de subir,
execute o arquivo de teste contra o projeto de desenvolvimento em transação
revertida.

Ambientes: `npm run dev:ops` (5180), `npm run dev:mobile` (Expo).

Para ver o app cliente no navegador, `npm run dev:mobile -- --web --port 8081`
— há uma sessão persistida no ambiente de desenvolvimento, então ele abre
logado.

**Antes de mexer em tela, leia o canvas.** Não implemente de memória nem do
print: as medidas estão no arquivo, e foi errando isso que a primeira tentativa
saiu com trilho horizontal onde o design empilha na vertical.
