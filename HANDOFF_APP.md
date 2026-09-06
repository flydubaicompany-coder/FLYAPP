# HANDOFF — Fly App, Fly Ops e Fly Crew

Preparado em **06/09/2026** para revisão externa (ChatGPT).
Commit: `2dad5ab` · branch `main` · árvore de trabalho limpa.

> **Leia esta seção antes de qualquer outra.** Três coisas que este repositório
> aparenta e não são:
>
> 1. **O `README.md` diz "Fase 0 — fundação. Nenhuma tela de produto existe
>    ainda."** Está onze fases desatualizado. Ignore-o.
> 2. **O GitHub não tem o código atual.** Há **27 commits locais não enviados**
>    (Fases 8 a 11). `origin/main` está em `0fe2f60`, de 03/09. Quem clonar o
>    repositório verá um projeto na Fase 7/8.
> 3. **O `docs/ESTADO.md` afirmava que quinze migrations não estavam
>    aplicadas.** Conferi contra o banco de produção hoje: **as Fases 8 e 9
>    estão aplicadas**; as Fases 10 e 11 não — faltam **sete** migrations. O
>    arquivo foi corrigido; o método está na seção 2.4.
>
> O material confiável é o **ZIP**, não o link do repositório.

---

## 1. O projeto

### Nome, produto e público

**Fly App** é o companheiro digital do cliente de uma viagem Fly — antes,
durante e depois. Não é um app de reservas: é o app de quem **já comprou** uma
viagem de alto padrão e precisa saber o próximo passo.

O acesso é **por convite**. Não há cadastro aberto: a tela inicial de quem não
está logado diz "A Fly é por convite", e a conta nasce de um convite aceito.
Isso muda tudo no desenho — não existe funil de aquisição, existe onboarding de
quem já é cliente.

São **três aplicações sobre um banco só**:

| Superfície                      | Quem usa                       | O que faz                                                                                                  |
| ------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Fly App** (`apps/fly-mobile`) | Cliente e viajante             | Roteiro, voos, hotel, transfers, refeições, documentos, passeios, carteira, pontos, álbum, concierge e SOS |
| **Fly Ops** (`apps/fly-ops`)    | Gestão e operação              | Painel web: clientes, viagens, conteúdo, comércio, suporte, fidelidade, relatórios, configuração           |
| **Fly Crew** (`apps/fly-crew`)  | Guia, base, mídia, experiência | Interface móvel de campo: entregas, casos, escuta, turno                                                   |

**Fly Cup** é outro produto (competições esportivas) e está fora do escopo. A
fronteira é contrato, deep link e Fly ID — ver `docs/architecture/adr/0008`.

### Proposta de valor

Três promessas, e elas explicam quase toda decisão técnica do projeto:

1. **"Tudo importante vem do painel."** Conteúdo crítico nunca fica no código.
   Preço, horário, prazo, texto, catálogo — tudo vem do banco e é editável pela
   operação.
2. **"O código não inventa regra de negócio."** Existe uma lista explícita
   (§33 da spec) do que nunca se inventa: prêmio, taxa, regra de tax-free,
   critério de ranking, contato de emergência, texto jurídico, câmbio, dado
   médico, parceiro de pagamento. Onde falta a regra, o valor nasce
   `"PENDENTE"` e **a tela diz que falta** em vez de mostrar um número
   plausível. Há 20 pendências registradas assim.
3. **"A operação opera sem tocar em código."** É o objetivo da Fase 11.

### Jornadas principais do cliente

| Jornada                                                 | Rota                              | Estado                                       |
| ------------------------------------------------------- | --------------------------------- | -------------------------------------------- |
| Receber convite → ativar conta → onboarding em 4 passos | `/convite` → `/onboarding/*`      | entregue                                     |
| Ver o próximo passo do dia                              | `/(tabs)/index` (Início)          | entregue                                     |
| Consultar roteiro, voos, hotel, o que está incluso      | `/viagem/*`                       | entregue                                     |
| Guardar e abrir documentos (cofre)                      | `/viagem/cofre`                   | entregue                                     |
| Confirmar presença por QR                               | `/viagem/qr`                      | entregue                                     |
| Escolher refeição dentro do prazo                       | `/viagem/refeicoes`               | entregue                                     |
| Comprar passeio (carrinho → pedido → pagamento sandbox) | `/passeios/*`, `/carrinho`        | entregue, pagamento em **sandbox**           |
| Ver pontos, benefícios, ranking, notas fiscais          | `/(tabs)/carteira`, `/carteira/*` | entregue com dados de demonstração           |
| Pedir ajuda, urgência ou SOS                            | `/assist/[choice]`                | construído na Fase 8, **nunca visto logado** |
| Colecionar figurinhas e fechar o Dia Completo           | `/album`, `/quest`                | construído na Fase 9, **nunca visto logado** |
| Perguntar ao Assistente Fly                             | `/assistente`                     | **desligado de propósito** (sem credencial)  |

### O que significa "Fase 8" — e por que o projeto está além disso

A spec divide a construção em 13 fases verticais (§35 a §47). Cada fase termina
com código, banco versionado, painel correspondente, testes e validação.

**Você disse "aproximadamente fase 8". O código está na Fase 11.** As Fases 8,
9, 10 e 11 foram construídas depois do último push:

| Fase   | Assunto                                               | Situação real                                       |
| ------ | ----------------------------------------------------- | --------------------------------------------------- |
| 0      | Fundação, `/health`, esteira                          | ✅ entregue e provado                               |
| 1      | Design system, navegação de 5 abas                    | ✅ entregue e provado                               |
| 2      | Fly ID: convite, onboarding, perfil, consentimento    | ✅ entregue e provado                               |
| 3      | Home dinâmica, eventos, notificações, push, analytics | ✅ entregue e provado                               |
| 4      | Minha Viagem: roteiro, cofre, QR, presença            | ✅ entregue e provado                               |
| 5      | Passeios, carrinho e pedidos                          | ✅ entregue (pagamento em sandbox)                  |
| 6      | Carteira e fidelidade                                 | ✅ entregue (2 regras pendentes)                    |
| 7      | Gastronomia, reservas e serviços                      | ✅ entregue                                         |
| **8**  | **Mapa, Bases Fly, concierge e SOS**                  | 🟡 código + banco aplicados, **nunca visto logado** |
| **9**  | **Álbum, Fly Quest, galeria, encantamento**           | 🟡 código + banco aplicados, **nunca visto logado** |
| **10** | **Assistente, planejador, Mala Pronta**               | 🔴 código pronto, **banco NÃO aplicado**            |
| **11** | **Consolidação Fly Ops e Fly Crew**                   | 🔴 código pronto, **banco NÃO aplicado**            |
| 12     | Hardening e lançamento                                | ⬜ não iniciada                                     |

### Divergências entre documentação e código

| Documento                            | O que diz                                                  | O que o código/banco diz                                    |
| ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `README.md`                          | "Fase 0 — fundação. Nenhuma tela de produto existe ainda." | 169 arquivos no app cliente, 55 rotas, 11 fases construídas |
| `README.md`                          | "64 testes"                                                | 434 testes                                                  |
| `docs/ESTADO.md` (antes de hoje)     | "quinze migrations não aplicadas"                          | Fases 8 e 9 **estão** no banco; faltam 7                    |
| `docs/operations/FLY_OPS_RUNBOOK.md` | "Na Fase 0 o Fly Ops ainda não opera nada"                 | 30 telas operacionais                                       |
| Spec §46 entrega 6                   | "Relatórios de … patrocinadores"                           | Não existe entidade de patrocinador no schema (P56)         |
| Spec §45 entregas 5, 6, 9            | Tradução, Fly Social, Fly Capsule                          | Não construídas (P54, P55)                                  |

O `docs/ESTADO.md` e o `docs/quality/TEST_MATRIX.md` estão corretos e são a
melhor fonte de estado. O `README.md` e o `FLY_OPS_RUNBOOK.md` estão obsoletos.

---

## 2. O que funciona de verdade

### 2.1 Legenda

| Marca                               | Significado                                            |
| ----------------------------------- | ------------------------------------------------------ |
| ✅ **Verificado**                   | Eu executei e vi funcionar                             |
| 🟦 **Verificado antes**             | Sessão anterior registrou a verificação; eu não repeti |
| 🟨 **Implementado, não verificado** | Código existe, banco suporta, ninguém viu rodando      |
| 🟧 **Parcial**                      | Funciona pela metade, e há razão registrada            |
| 🟥 **Bloqueado**                    | O banco não tem as tabelas — a tela abre em erro       |
| 🎭 **Dados simulados**              | Roda com conteúdo de demonstração                      |
| ⬜ **Planejado**                    | Não existe                                             |

### 2.2 A limitação que atravessa tudo

**Nunca vi nenhuma tela logada.** Nem no app, nem no Ops, nem no Crew. Não
tenho credenciais e não é papel meu digitar senha em campo de login. Tudo que
está marcado 🟦 vem de registro de sessão anterior; tudo marcado 🟨 nunca foi
visto por ninguém.

Isso significa que **a maior parte do produto está sem prova visual**. É a
lacuna mais importante deste handoff.

### 2.3 Fly App — cliente

| Tela / fluxo                                                                       | Rota                             | Estado       | Observação                                                                                            |
| ---------------------------------------------------------------------------------- | -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Navegação de 5 abas + botão central                                                | `(tabs)/_layout`                 | ✅           | Vi hoje: 5 abas, Minha Viagem elevada com anel dourado, SOS e carrinho flutuantes                     |
| Início — deslogado                                                                 | `(tabs)/index`                   | ✅           | "A Fly é por convite"                                                                                 |
| Início — logado (próximo passo, eventos, alertas)                                  | `(tabs)/index`                   | 🟦           |                                                                                                       |
| Passeios — deslogado                                                               | `(tabs)/passeios`                | ✅           |                                                                                                       |
| Minha Viagem — vazio                                                               | `(tabs)/viagem`                  | ✅           | "Nenhuma viagem ativa"                                                                                |
| Carteira — deslogado                                                               | `(tabs)/carteira`                | ✅           |                                                                                                       |
| Perfil — deslogado, com CTA "Entrar"                                               | `(tabs)/perfil`                  | ✅           |                                                                                                       |
| Login por e-mail e senha                                                           | `/entrar`                        | ✅ renderiza | Nunca submetido                                                                                       |
| Convite                                                                            | `/convite`                       | ✅ renderiza |                                                                                                       |
| Onboarding (4 passos)                                                              | `/onboarding/*`                  | 🟦           | identidade, preferências, privacidade, acesso                                                         |
| Roteiro, voos, hotel, incluso, cofre, QR, refeições, concierge                     | `/viagem/*`                      | 🟦           |                                                                                                       |
| Catálogo, passeio, carrinho, pedido, participantes, proposta                       | `/passeios/*`, `/carrinho`       | 🟦 🎭        | Pagamento **sandbox**, sem PSP real (P09)                                                             |
| Carteira: pontos, benefícios, ranking, notas                                       | `/carteira/*`, `/perfil/ranking` | 🟦 🎭        | Benefícios e ranking dizem "(demonstração)"                                                           |
| Perfil: dados, passaporte, emergência, acompanhantes, privacidade, push, segurança | `/perfil/*`                      | 🟦           | Passaporte é **digitado**, sem OCR                                                                    |
| Eventos                                                                            | `/eventos/*`                     | 🟦           |                                                                                                       |
| Notificações                                                                       | `/notificacoes`                  | 🟦           | Até a Fase 11 **ninguém conseguia enviar** — só leitura                                               |
| **Mapa e Bases Fly**                                                               | `/mapa`                          | 🟨           | Fase 8. Banco aplicado. `map_places` nasce vazia (P48)                                                |
| **Ajuda / urgente / SOS**                                                          | `/assist/[choice]`               | 🟨           | Fase 8. Localização real depende de `expo-location` (P49)                                             |
| **Álbum e figurinhas**                                                             | `/album`, `/album/[figurinha]`   | 🟨 🎭        | Fase 9. Conteúdo nasce vazio (P52)                                                                    |
| **Fly Quest**                                                                      | `/quest`                         | 🟨           | Fase 9                                                                                                |
| **Galeria da viagem**                                                              | `/galeria`                       | 🟨           | Fase 9                                                                                                |
| **Modo Criador**                                                                   | `/influenciador`                 | 🟨           | Fase 9                                                                                                |
| **Assistente Fly**                                                                 | `/assistente`                    | 🟧           | **Desligado de propósito** (D220): sem credencial de modelo (P53). A tela diz isso e oferece a equipe |
| **Planejador financeiro**                                                          | `/carteira/planejador`           | 🟥           | Fase 10 — `manual_expenses` e `trip_budgets` **não existem no banco**                                 |
| **Mala Pronta**                                                                    | `/viagem/mala`                   | 🟥 🟧        | Fase 10 — `packing_items` não existe. E é parcial: vem do roteiro, não do clima (P54)                 |
| Catálogo de design (estados visuais)                                               | `/catalogo`                      | ✅ 🎭        | Galeria de componentes com fixtures. **Não é tela de produto**                                        |
| Health                                                                             | `/health`                        | ✅           |                                                                                                       |
| Tradução por adapter                                                               | —                                | ⬜           | P54                                                                                                   |
| Fly Social                                                                         | —                                | ⬜           | P55                                                                                                   |
| Fly Capsule / Story do Dia                                                         | —                                | ⬜           | P55                                                                                                   |

### 2.4 Fly Ops — 30 telas

**Como descobri o que o banco tem.** O backend está no ar (`/health` respondeu
"Operacional", 1437 ms). Consultei o PostgREST com a chave publicável: uma
tabela que existe e é protegida responde `401 / 42501`; uma que não existe
responde `404 / PGRST205`. Só leitura, nada mutável.

```
map_places, stickers, quest_missions, guest_insights,
influencer_profiles, media_tags, support_cases.assigned_to → 401 42501  (EXISTEM)
manual_expenses, trip_budgets, assistant_runs, packing_items,
trip_feature_flags, staff_shifts, inventory_items       → 404 PGRST205 (NÃO EXISTEM)
rpc/tem_surpresa_a_caminho → 401 42501 (existe)   rpc/relatorio_viagem → 404 (não existe)
```

| Tela                                                     | Rota            | Estado                                                       |
| -------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| Login                                                    | `/entrar`       | ✅ renderiza (com defeito visual, ver 5.1)                   |
| Health                                                   | `/health`       | ✅                                                           |
| Clientes, Convites, Consentimentos, Passaportes, Eventos |                 | 🟦                                                           |
| Viagens, Presença, Leitor de QR, Refeições, Concierge    |                 | 🟦                                                           |
| Catálogo, Vitrine, Pedidos, Fidelidade, Notas            |                 | 🟦 🎭                                                        |
| **Atendimento** (fila, SLA, atribuição)                  | `/atendimento`  | 🟨 🟧 SLA é `PENDENTE` (P20)                                 |
| **Mapa e Bases**                                         | `/mapa`         | 🟨                                                           |
| **Álbum, Galeria, Surpresas, Criadores**                 |                 | 🟨                                                           |
| **Hoje** (dashboard)                                     | `/hoje`         | 🟥 lê `staff_shifts` e `inventory_balance`                   |
| **Ficha do hóspede**                                     | `/clientes/:id` | 🟥 parcial — lê tabelas que existem, mas a rota é da Fase 11 |
| **Logística** (voos, hotel, transfers, incluso, cofre)   | `/logistica`    | 🟥                                                           |
| **Avisos**                                               | `/avisos`       | 🟥 `rpc/enviar_aviso` não existe                             |
| **Equipe** (papéis, atribuições, escala, handoff)        | `/equipe`       | 🟥                                                           |
| **Configuração** (config, flags, flags por viagem)       | `/configuracao` | 🟥                                                           |
| **Auditoria** (trilha, QR, cofre, assistente)            | `/auditoria`    | 🟥                                                           |
| **Relatórios** (6 relatórios + reconciliação)            | `/relatorios`   | 🟥                                                           |
| **Inventário** (press kits, brindes, recompensas)        | `/inventario`   | 🟥                                                           |
| Busca global (no topo)                                   | —               | 🟥 busca `/clientes/:id`, rota da Fase 11                    |

### 2.5 Fly Crew — 4 telas

| Tela                                     | Rota        | Estado                                 |
| ---------------------------------------- | ----------- | -------------------------------------- |
| Login                                    | _sem rota_  | 🟧 **`/entrar` devolve 404** — ver 5.2 |
| Entregas (refeições em campo)            | `/entregas` | 🟦                                     |
| Casos (SOS e atendimento)                | `/casos`    | 🟨                                     |
| Escuta ativa                             | `/escuta`   | 🟨                                     |
| **Turno** (passagem e entrega de brinde) | `/turno`    | 🟥 Fase 11                             |
| Health                                   | `/health`   | ✅                                     |

### 2.6 O que impede alguém de usar o app do começo ao fim

1. **Não há como criar conta.** É por convite, por desenho. Para testar de
   ponta a ponta é preciso um convite emitido pelo Fly Ops — e para entrar no
   Fly Ops é preciso um usuário com papel de equipe, que hoje só existe se
   alguém o criou direto no banco.
2. **As sete migrations das Fases 10 e 11 não estão aplicadas.** Onze telas do
   Fly Ops, uma do Crew e duas do app abrem em erro.
3. **Pagamento é sandbox.** Nenhum PSP homologado (P09/P38). Um pedido "pago"
   não moveu dinheiro.
4. **Vinte pendências de regra de negócio** deixam telas dizendo "a definir":
   valor do ponto, catálogo de benefícios, critério de ranking, regra de
   tax-free, prazo de atendimento, teto de encantamento.
5. **QR pela câmera e localização no aparelho não existem** — faltam
   `expo-camera` e `expo-location`, que exigem build nativo (P49, P50). Hoje o
   código de QR é **digitado**.

### 2.7 Botões sem ação e integrações incompletas

- **Botões sem ação: nenhum.** Varri as 151 tags `<button>` do Ops e do Crew e
  os 110 `Pressable` do app; todos têm handler ou são `type="submit"`.
- **Integrações incompletas:** pagamento (sandbox), tax-free (flag desligada),
  assistente (desligado sem credencial), push (registra token, nunca enviou
  notificação real), tradução e clima (não existem).

### 2.8 O que eu executei, e o que não consegui

**Executei hoje:**

| Verificação                                                   | Resultado                                 |
| ------------------------------------------------------------- | ----------------------------------------- |
| `npm run verify` (lint, format, check:sql, typecheck, testes) | ✅ exit 0, **434 testes**                 |
| `npm run build` (3 aplicações)                                | ✅                                        |
| `npm audit --omit=dev`                                        | ⚠️ 3 vulnerabilidades moderadas           |
| Fly Ops em `localhost:5180`                                   | ✅ sobe; `/health` "Operacional", 1437 ms |
| Fly Crew em `localhost:5181`                                  | ✅ sobe                                   |
| Fly App (Expo web) em `localhost:8081`                        | ✅ sobe, 1247 módulos                     |
| Screenshots das 15 telas alcançáveis                          | ✅ `docs/handoff/screenshots/`            |
| Existência de tabelas e funções no banco de produção          | ✅ via PostgREST, só leitura              |
| Estado do Git contra `origin/main`                            | ✅ 27 commits à frente                    |
| Última execução de CI                                         | ✅ 27/08/2026 — antes da Fase 8           |
| Medição de transbordo horizontal no app a 375px               | ✅ não transborda                         |
| Medição do defeito de layout do formulário                    | ✅ campo com 224px em vez de ~70px        |

**Não consegui executar:**

| O quê                                     | Por quê                                     |
| ----------------------------------------- | ------------------------------------------- |
| Qualquer tela logada, nas três aplicações | Sem credenciais                             |
| A suíte pgTAP (604 asserções)             | Sem Docker e sem token da CLI Supabase      |
| As **238 asserções** das Fases 8 a 11     | Nunca rodaram em lugar nenhum               |
| Aplicar as 7 migrations que faltam        | Sem token da CLI; MCP logado em outra conta |
| `deno check` nas Edge Functions           | Deno não instalado                          |
| Build nativo iOS/Android                  | Sem Xcode/EAS configurado                   |
| Teste em aparelho real                    | —                                           |

---

## 3. Estrutura técnica

### 3.1 Plataformas

| Superfície | Alvo              | Como roda hoje                                              |
| ---------- | ----------------- | ----------------------------------------------------------- |
| Fly App    | iOS, Android, Web | Só **Expo web** foi executado. Build nativo nunca compilado |
| Fly Ops    | Web desktop       | Vite dev + build                                            |
| Fly Crew   | Web mobile        | Vite dev + build                                            |

### 3.2 Tecnologias e versões

**Monorepo:** npm workspaces, Node ≥ 22, TypeScript estrito em tudo.

| Camada           | Tecnologia                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------ |
| App cliente      | Expo SDK **57**, Expo Router 57, React Native **0.86.2**, React **19.2.3**, React Compiler |
| Painéis          | Vite **8.2**, React **19.2.8**, React Router **7.18.2**                                    |
| Backend          | Supabase (Postgres 17) — projeto `ptmifjnfskwipjjxauns`                                    |
| Cliente do banco | `@supabase/supabase-js` **2.112.4**                                                        |
| Edge Functions   | Deno (5 funções)                                                                           |
| Testes           | Vitest (434) + pgTAP (604 asserções, 29 arquivos)                                          |
| Lint/format      | ESLint 10.9, Prettier 3.9.6                                                                |
| CI               | GitHub Actions, 3 jobs                                                                     |
| Hospedagem       | Vercel (3 projetos), time `app fly`                                                        |

### 3.3 Organização das pastas

```
apps/
  fly-mobile/    Expo + Expo Router — 169 arquivos, 55 rotas
    src/app/         rotas (file-based)
    src/{home,viagem,passeios,carteira,album,assist,mapa,perfil,…}/  domínio por área
    src/ui/          componentes compartilhados
    src/auth/        sessão, cliente Supabase, storage
  fly-ops/       Vite + React — 53 arquivos, 30 páginas
    src/paginas/     uma tela por arquivo
    src/dominio/     lógica pura, com teste (slug, tempo, csv)
    src/componentes/ Busca global, formulários grandes
  fly-crew/      Vite + React — 15 arquivos, 4 páginas
packages/
  design-tokens/ tokens do Claude Design, conferidos contra o arquivo de design
  domain-types/  papéis, moedas, tipos gerados do banco (database.types.ts)
  config/        ambiente, logger com redação de PII, health
  analytics/     taxonomia de eventos com guarda de consentimento
  payments/      adapter de pagamento e verificação de assinatura
  assistant/     barreira de dado do assistente (lista de permissão)
supabase/
  migrations/    50 migrations versionadas
  tests/         29 arquivos pgTAP
  functions/     5 Edge Functions (Deno)
  seed*.sql      seeds de desenvolvimento e demonstração
docs/            spec mestre, ADRs, decision log (251 decisões), estado, testes
```

### 3.4 Navegação

- **App:** 5 abas — Início · Passeios · **Minha Viagem** (central, elevada,
  anel dourado) · Carteira · Perfil. Carrinho e Fly Assist/SOS são ações
  flutuantes. Rotas tipadas (`.expo/types/router.d.ts`, gerado pelo dev server).
- **Ops:** desde a Fase 11, navegação de **dois níveis** — 6 grupos (Operação,
  Viagens, Pessoas, Comércio, Experiência, Plataforma) e as telas do grupo
  aberto numa segunda fila. Busca global no topo.
- **Crew:** 4 abas planas — Entregas, Casos, Escuta, Turno.

### 3.5 Backend, banco e autenticação

- **Autenticação:** Supabase Auth, e-mail e senha. Sem cadastro aberto: conta
  nasce de convite aceito por Edge Function com `service_role`.
- **Autorização:** papéis em `public.user_roles` (tabela protegida, **nunca**
  em metadado editável pelo usuário). 11 papéis. **RLS e GRANT são tratados
  como controles diferentes** e configurados os dois — há testes de privilégio
  para os dois.
- **Banco:** 116 tabelas, 4 views, 53 funções. Ledgers append-only (pontos,
  carteira, inventário) com gatilho que recusa `update`/`delete`. Saldo é
  sempre `view` derivada, nunca coluna.
- **Storage privado:** buckets `documentos`, `notas`, `galeria`, `album`,
  `passeios`, com policy por pasta e URL assinada de curta duração.
- **Realtime:** `support_messages` e `support_cases` publicados.
- **Edge Functions:** `aceitar-convite`, `excluir-conta`, `pagamento-sandbox`,
  `pagamento-webhook`, `assistente`.

### 3.6 Integrações e serviços externos

| Integração                                           | Situação                                       |
| ---------------------------------------------------- | ---------------------------------------------- |
| Supabase (auth, banco, storage, realtime, functions) | ✅ em uso                                      |
| Provedor de pagamento                                | ⬜ **sandbox próprio**, sem PSP (P09/P38)      |
| Provedor de modelo (Anthropic)                       | ⬜ código pronto, **sem credencial** (P53)     |
| Push (Expo Notifications)                            | 🟧 registra token; envio real nunca exercitado |
| Tax-free                                             | ⬜ flag desligada, sem parceiro (P47)          |
| Tradução, meteorologia                               | ⬜ P54                                         |
| Mapa (provedor)                                      | ⬜ P16 — rota abre no app nativo do sistema    |
| Vercel                                               | ✅ 3 projetos no ar                            |

### 3.7 Comandos

```bash
npm install                # instala o workspace inteiro
npm run verify             # lint + format + check:sql + typecheck + testes
npm run build              # build das 3 aplicações
npm run paridade           # auditoria App ↔ Ops ↔ Crew
npm run dev:ops            # Fly Ops   → http://localhost:5180
npm run dev:crew           # Fly Crew  → http://localhost:5181
npm run dev:mobile         # Fly App   (Expo)
npm run db:start           # Supabase local (EXIGE Docker)
npm run db:reset           # migrations + seed
npm run db:test            # 604 asserções pgTAP
npm run db:types           # regenera database.types.ts
```

**Requisitos:** Node ≥ 22, npm. Para o banco local: Docker e a CLI do Supabase
autenticada. Para build nativo: Xcode/Android SDK ou EAS — **nada disso está
configurado neste ambiente**.

Antes do primeiro `dev`, copie o `.env.example` de cada app para `.env.local`.

### 3.8 Variáveis de ambiente (só os nomes)

**`apps/fly-ops/.env.local` e `apps/fly-crew/.env.local`:**

```
VITE_FLY_ENVIRONMENT
VITE_FLY_SUPABASE_URL
VITE_FLY_SUPABASE_PUBLISHABLE_KEY
VITE_FLY_APP_VERSION
VITE_FLY_COMMIT_SHA
```

**`apps/fly-mobile/.env.local`:**

```
EXPO_PUBLIC_FLY_ENVIRONMENT
EXPO_PUBLIC_FLY_SUPABASE_URL
EXPO_PUBLIC_FLY_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_FLY_APP_VERSION
EXPO_PUBLIC_FLY_COMMIT_SHA
```

**Edge Functions (no painel do Supabase):** `ANTHROPIC_API_KEY` (ausente hoje),
mais as variáveis que o Supabase injeta.

> No cliente entra **apenas a chave publicável**. Nunca a secreta, nunca a
> `service_role`. É regra do projeto e há teste que a guarda.

### 3.9 Repositório e versão

|                          |                                                               |
| ------------------------ | ------------------------------------------------------------- |
| Repositório              | `https://github.com/flydubaicompany-coder/FLYAPP`             |
| Branch                   | `main`                                                        |
| Commit local             | `2dad5ab` — _Fase 11: duas construções SQL na forma canônica_ |
| Commit no GitHub         | `0fe2f60` — de 03/09/2026                                     |
| **Commits não enviados** | **27** (todas as Fases 8 a 11)                                |
| Mudanças não commitadas  | nenhuma — árvore limpa                                        |
| Última execução de CI    | 27/08/2026                                                    |

---

## 4. A interface

### 4.1 Screenshots

15 capturas em `docs/handoff/screenshots/`, todas de hoje, do código local.

O app foi capturado a **390×844 com emulação de aparelho móvel via CDP**. O
`--screenshot` simples do Chrome headless **não serve** para este app: o React
Native Web mede a janela na carga, e em headless ela ainda é 800×600 nesse
momento — o texto sai cortado e parece bug. Medido no navegador de verdade a
375px, `scrollWidth === innerWidth`: **não há transbordo**.

| Arquivo                                     | O que mostra                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `app-01-home.png`                           | Início deslogado + navegação de 5 abas, botão central e ações flutuantes |
| `app-02-entrar.png`                         | Login do cliente                                                         |
| `app-03-convite.png`                        | Convite                                                                  |
| `app-04-passeios.png` … `app-07-perfil.png` | As outras abas, estado deslogado                                         |
| `app-08-estados-design.png`                 | **Catálogo de design com contraste medido**                              |
| `app-09-health.png`                         | Health do app                                                            |
| `ops-01-entrar.png`                         | Login do Fly Ops — **mostra o defeito de layout**                        |
| `ops-02-health.png`                         | Health do Fly Ops, backend Operacional                                   |
| `crew-01-entrar.png`                        | Login do Fly Crew — **mesmo defeito**                                    |
| `crew-02-health.png`                        | Health do Fly Crew                                                       |
| `crew-03-rota-entrar-404.png`               | **Evidência: `/entrar` não existe no Crew**                              |

**Não há screenshot de nenhuma tela logada.** É a maior lacuna deste material.

### 4.2 Identidade visual

Vem do **Claude Design**, versionado em `docs/design/canvas/` e
`design_handoff_fly_app/`. Os tokens estão em `packages/design-tokens` e são
**conferidos por teste** contra o arquivo do design.

**Cores.** Fundo quase preto (`#08080A`), superfície grafite, texto branco. O
dourado `#DFC98A` é o único acento e tem uso **contado**: kicker de evento,
selo Exclusivo Fly, chip selecionado, progresso de nível, anel do botão
central, cartão de pontos, bloco de Dia Completo. Um uso novo exige decisão
registrada — hoje são 9, e cada um está no decision log. Essa disciplina é
rara e é o que faz o dourado continuar significando alguma coisa.

**Tipografia** (medida no catálogo):

| Papel      | Tamanho / peso |
| ---------- | -------------- |
| largeTitle | 33px / 700     |
| section    | 20px / 600     |
| body       | 15px / 400     |
| caption    | 9.5px / 700    |
| tabLabel   | 9.5px / 600    |

**Contraste medido pelo próprio projeto**, sobre `#08080A`:

| Token            | Razão      | Veredito                                      |
| ---------------- | ---------- | --------------------------------------------- |
| `text/primary`   | 18.38:1    | ✅ tudo                                       |
| `text/secondary` | **4.21:1** | ⚠️ **abaixo de AA (4.5:1) para texto normal** |
| `text/tertiary`  | 3.06:1     | só texto grande e UI                          |
| `text/disabled`  | 2.28:1     | só controle inativo                           |

**Navegação e espaçamento.** Alvos de toque de 44px (2.75rem), raio de 17px
nos controles, 14px nos cartões. Espaçamento consistente em múltiplos de
0.25rem.

### 4.3 Avaliação

**O que está bom:**

- **Hierarquia clara.** Kicker pequeno em dourado → título grande → corpo
  secundário. Funciona em todas as telas que vi.
- **Consistência real.** Os três apps compartilham tokens; o Ops e o Crew
  compartilham a folha de estilo inteira.
- **Estados vazios com texto honesto.** "Nenhuma viagem ativa — quando a Fly
  montar sua viagem, tudo o que você precisa aparece aqui". Explica em vez de
  só informar. É bom trabalho.
- **Acessibilidade parcialmente cuidada.** 55 de 87 arquivos `.tsx` do app
  usam `accessibilityLabel`/`accessibilityRole`.

**O que precisa de atenção:**

- **`text/secondary` reprova em AA** e é usado em corpo de texto. Já registrado
  como P44 e ainda aberto — é decisão do dono entre fidelidade ao design e
  acessibilidade.
- **9.5px em `caption` e `tabLabel`** é pequeno demais para leitura confortável,
  ainda mais em peso 700 sobre fundo escuro.
- **Estados vazios ocupam ~15% da tela e deixam 85% de preto.** O conteúdo é
  ancorado no topo; o resultado é uma tela que parece quebrada em vez de vazia.
- **Formulários verticais têm um defeito de layout confirmado** (ver 5.1).

**Estados de tela.** O projeto trata carregando / vazio / erro / permissão
negada / offline por convenção — cada `use*` do app tem um tipo com esses
casos, e há um modo degradado explícito no atendimento (a tela de emergência
guarda telefones em cache para funcionar sem rede). **Verifiquei "vazio" e
"carregando"**; erro, permissão negada e offline não pude exercitar sem sessão.

---

## 5. Problemas e oportunidades

### 5.1 🔴 CONFIRMADO — campos de formulário esticam na vertical

**Onde:** `apps/fly-ops/src/styles.css:217` e `apps/fly-crew/src/styles.css`
(mesma regra). Afeta o **login das duas aplicações** e todo formulário vertical
— Equipe, Configuração, Avisos, Turno.

```css
.field {
  display: flex;
  flex-direction: column;
  flex: 1 1 14rem; /* ← escrito para .form--linha, que é horizontal */
}
```

Dentro de `.form` (que é `flex-direction: column`), `flex: 1 1 14rem` aplica a
base de 14rem à **altura**, e `flex-grow: 1` estica o campo para preencher a
coluna.

**Evidência medida no navegador:** cada `.field` do login tem **224px de
altura** em vez dos ~70px do conteúdo. Visível em `ops-01-entrar.png` e
`crew-01-entrar.png` como um buraco entre o campo de e-mail e o rótulo "Senha".

**Correção:** limitar o crescimento à direção horizontal.

```css
.field {
  flex: 0 1 auto;
}
.form--linha > .field {
  flex: 1 1 14rem;
}
```

**Não apliquei** — a instrução foi preservar a versão atual.

### 5.2 🔴 CONFIRMADO — Fly Crew não tem rota de login

**Onde:** `apps/fly-crew/src/App.tsx`. O componente `Entrar` é renderizado
_dentro_ de `Protegido`; não há `<Route path="/entrar">`. O Fly Ops **tem**.

**Consequência:** `localhost:5181/entrar` devolve **404** — evidência em
`crew-03-rota-entrar-404.png`. Um guia que receba um link para a tela de login,
ou que salve a URL, cai numa página de erro.

### 5.3 🔴 CONFIRMADO — o GitHub não tem o código

27 commits locais não enviados. Quem revisar pelo repositório revisará um
produto quatro fases atrás. **Use o ZIP.**

### 5.4 🔴 CONFIRMADO — 238 asserções de banco nunca rodaram

As suítes pgTAP das Fases 8 a 11 (238 de 604 asserções) nunca foram executadas
— nem local (sem Docker) nem no CI (última execução em 27/08). Tudo que o
projeto afirma sobre RLS, GRANT e reconciliação nessas fases é **leitura de
código**.

Isso é sério porque a segurança inteira do produto está na RLS. O decision log
registra que a mesma classe de erro já mordeu quatro vezes.

### 5.5 🟠 CONFIRMADO — treze telas abrem em erro contra produção

Faltam 7 migrations (Fases 10 e 11). Onze telas do Fly Ops, uma do Crew e duas
do app leem tabelas que não existem.

**Correção:** aplicar as migrations. O arquivo consolidado está em
`docs/handoff/fases-10-e-11-migrations.sql`; duas delas **removem permissão**
(as policies de escrita de `app_config` e `feature_flags`) e o cabeçalho avisa.

### 5.6 🟠 CONFIRMADO — documentação de entrada obsoleta

`README.md` e `docs/operations/FLY_OPS_RUNBOOK.md` descrevem a Fase 0. Quem
chega ao projeto lê primeiro o README, e ele mente sobre o produto inteiro.

### 5.7 🟡 CONFIRMADO — contraste e tamanho de fonte

`text/secondary` a 4.21:1 reprova em AA para texto normal e é usado em corpo de
texto. `caption`/`tabLabel` a 9.5px. Decisão do dono (P44).

### 5.8 🟡 CONFIRMADO — 3 vulnerabilidades moderadas

`decode-uri-component` ← `query-string` ← `expo-router`. Transitivas, sem
correção sem `--force`. Baixo risco, mas entra no checklist da Fase 12.

### 5.9 🟡 CONFIRMADO — bundle do Fly Ops em 729 kB

Sem divisão de código. Trinta telas num arquivo só. `React.lazy` por rota
resolveria com pouco esforço.

### 5.10 🔵 HIPÓTESES — precisam de investigação

| Hipótese                                           | Como testar                                        |
| -------------------------------------------------- | -------------------------------------------------- |
| As telas das Fases 8 e 9 funcionam logadas         | Entrar no app com um convite ativo                 |
| A Edge Function `assistente` passa no `deno check` | É a primeira com dependência `npm:`; nunca testada |
| O `enviar_aviso` e os relatórios da Fase 11 rodam  | SQL nunca executado                                |
| O Realtime do atendimento entrega mensagem         | Nunca observado                                    |
| Push chega a um aparelho                           | Nunca exercitado                                   |
| Os seeds de demonstração ainda estão em produção   | Não consegui ler (RLS)                             |

### 5.11 💡 IDEIAS DE EVOLUÇÃO

Ordenadas por relação entre benefício e custo.

**1. Um caminho de teste ponta a ponta.** Hoje é impossível experimentar o
produto sem criar usuário no banco à mão. Um seed de demonstração que crie um
convite, uma viagem completa e um usuário de equipe destravaria toda revisão de
UX — a sua, a minha e a de qualquer pessoa nova. _Dependência: nenhuma. É o
item de maior retorno da lista._

**2. Reequilibrar os estados vazios.** Centralizar verticalmente e acrescentar
uma ação. "Nenhuma viagem ativa" poderia oferecer "ver passeios" ou "falar com
a Fly" em vez de deixar 85% de preto. _Benefício: a tela deixa de parecer
quebrada. Dependência: nenhuma._

**3. Skeleton em vez de "Carregando…".** As telas de dados fazem 3 a 7
consultas em paralelo; num 4G ruim isso é um segundo de texto cinza. Skeleton
com a forma do conteúdo reduz a percepção de espera sem mudar nada no dado.

**4. Divisão de código por rota no Fly Ops.** 729 kB para abrir a tela de
login. `React.lazy` por grupo de navegação.

**5. Estado vazio que ensina no Fly Ops.** As telas novas (Álbum, Mapa,
Inventário) nascem vazias por decisão de produto — nenhuma inventa conteúdo. O
estado vazio poderia explicar **o que cadastrar primeiro** em vez de só dizer
"nenhum item".

**6. Confirmação nas ações de alto risco.** Revogar papel, revogar atribuição e
enviar aviso para uma viagem inteira acontecem num clique. A §46 pede
"ação de alto risco exige aprovação" — hoje existe trilha, não existe pergunta.

**7. Indicador de sessão e papel no cabeçalho.** O Fly Ops mostra o nome; não
mostra o papel. Quem opera com dois acessos não sabe com qual está.

**8. Modo offline de leitura no app.** O atendimento já guarda telefones para
funcionar sem rede. Roteiro do dia e documentos do cofre são os dois candidatos
naturais — é o que a pessoa precisa exatamente quando está sem sinal.

**9. Busca no app do cliente.** O Ops ganhou busca global na Fase 11; o app não
tem. "Onde está meu voucher do jantar" é uma pergunta real.

**10. Revisão de microcópia dos erros.** As mensagens de rede são boas ("Sem
conexão: sua mensagem NÃO foi enviada"). As de banco não: aparecem cruas, com
texto do Postgres, em várias telas do Ops.

---

## 6. O material

### 6.1 O que está no pacote

```
fly-handoff-2026-09-06.zip
├── HANDOFF_APP.md                        este documento
├── README.md  CLAUDE.md  package.json    raiz do monorepo
├── apps/                                 código das 3 aplicações (sem node_modules)
├── packages/                             6 pacotes compartilhados
├── supabase/                             50 migrations, 29 testes, 5 functions, seeds
├── docs/
│   ├── product/FLY_APP_MASTER_SPEC.md    a fonte oficial do produto
│   ├── ESTADO.md                         onde o trabalho parou (atualizado hoje)
│   ├── architecture/DECISION_LOG.md      251 decisões + 20 pendências, com o porquê
│   ├── quality/TEST_MATRIX.md            o que é provado e o que não é
│   ├── quality/PARIDADE.md               auditoria App ↔ Ops ↔ Crew
│   ├── operations/RUNBOOKS.md            procedimentos da operação
│   ├── design/                           procedência do design
│   └── handoff/
│       ├── screenshots/                  15 capturas de hoje
│       └── fases-10-e-11-migrations.sql  as 7 migrations que faltam, em transação
├── assets/  design_handoff_fly_app/      marca e handoff do Claude Design
├── scripts/  .github/workflows/          verificações e CI
└── apps/*/.env.example                   nomes das variáveis, sem valores
```

**Excluídos:** `node_modules`, `dist`, `.expo`, `.git`, caches, `*.tsbuildinfo`
e **todos os `.env.local`**. Nenhuma credencial, chave ou dado pessoal.

### 6.2 Por onde começar a revisão

1. **`HANDOFF_APP.md`** (este arquivo) — contexto e estado real.
2. **`docs/ESTADO.md`** — onde o trabalho parou.
3. **`docs/product/FLY_APP_MASTER_SPEC.md`** — o produto inteiro, longo.
4. **`docs/architecture/DECISION_LOG.md`** — por que cada coisa é como é. Se
   for propor mudança, leia antes: muita coisa que parece descuido é decisão
   registrada.
5. **`docs/handoff/screenshots/`** — a interface como ela está.

### 6.3 Duas regras que a revisão precisa respeitar

1. **A §33 da spec.** Existe uma lista do que o código nunca inventa: prêmio,
   taxa, regra de tax-free, critério de ranking, contato de emergência, texto
   jurídico, câmbio, dado médico, parceiro de pagamento, período de retenção.
   Onde falta a regra, o valor é `"PENDENTE"` e a tela diz que falta. **Uma
   sugestão que preencha essas lacunas com valores plausíveis está errada**,
   por mais razoável que pareça o número.

2. **RLS e GRANT são controles diferentes.** Toda tabela exposta tem os dois
   configurados, e teste de acesso permitido **e** negado. Sugestão que mexa em
   permissão precisa mexer nos dois.
