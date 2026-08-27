# Matriz de testes

Estado em 27/08/2026, Fase 5 em andamento (§40.9 e §40.10 entregues).

## O que roda hoje

```bash
npm run verify   # lint + typecheck + testes
```

| Alvo                                    | Onde                              | Testes  | Situação |
| --------------------------------------- | --------------------------------- | ------- | -------- |
| Tokens, tipografia, contraste, dourado  | `packages/design-tokens/src`      | 63      | ✅ passa |
| Ambiente, redação de log, health, sonda | `packages/config/src`             | 27      | ✅ passa |
| Papéis, superfícies, moedas             | `packages/domain-types/src`       | 8       | ✅ passa |
| Consentimento, PII, taxonomia           | `packages/analytics/src`          | 15      | ✅ passa |
| **Adapter de pagamento e assinatura**   | `packages/payments/src`           | **25**  | ✅ passa |
| App cliente                             | `apps/fly-mobile/src`             | 166     | ✅ passa |
| Tema do Fly Ops                         | `apps/fly-ops/src/theme.test.ts`  | 3       | ✅ passa |
| Tema do Fly Crew                        | `apps/fly-crew/src/theme.test.ts` | 3       | ✅ passa |
| **Total**                               | 20 arquivos                       | **310** | ✅       |

Dentro do app cliente, os grupos que mais importam:

| Assunto                         | Arquivo                          |
| ------------------------------- | -------------------------------- |
| Composição da Home por estado   | `src/home/composition.test.ts`   |
| CTA, deep link e fallback       | `src/home/ctas.test.ts`          |
| Push: destino, login, permissão | `src/push/push.test.ts`          |
| Onboarding                      | `src/auth/onboarding.test.ts`    |
| Navegação e abas                | `src/navigation/routing.test.ts` |

## RLS e regra de negócio: 262 asserções, verdes na esteira

A suíte pgTAP roda a cada push, no job **Migrations e RLS**:

| Arquivo                       | Asserções | Cobre                                                                             |
| ----------------------------- | --------- | --------------------------------------------------------------------------------- |
| `foundation_rls.test.sql`     | 31        | espinha de sistema, papéis, auditoria append-only                                 |
| `fly_id_rls.test.sql`         | 39        | isolamento entre clientes, atribuição, vínculo familiar, consentimento            |
| `advance_onboarding.test.sql` | 9         | transição de onboarding decidida no servidor                                      |
| `invitations_rpc.test.sql`    | 8         | quem pode convidar, e com qual papel                                              |
| `account_deletion.test.sql`   | 7         | exclusão de conta, inclusive de conta nascida de convite                          |
| `home_events.test.sql`        | 21        | estado da Home no fuso do destino, publicação, categoria crítica                  |
| `isolamento_viagens.test.sql` | 10        | **uma viagem não vaza para outra** — ver abaixo                                   |
| `minha_viagem.test.sql`       | 52        | roteiro, cofre, QR, presença                                                      |
| `passaporte.test.sql`         | 18        | quem lê o número, e o registro de quem leu                                        |
| `passeios.test.sql`           | **67**    | catálogo, carrinho, pedido, pagamento, webhook, participantes, reembolso, vitrine |

Antes de a esteira existir, as 22 asserções equivalentes já tinham sido
executadas via SQL direto no projeto `ewgbseesocekvhiiscnb`, dentro de uma
transação revertida — foi ali que a armadilha do `throws_ok` apareceu.

| Papel     | Verificações                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —         | RLS ligada nas seis tabelas                                                                                                                                         |
| cliente A | lê o próprio perfil ✓ · não lê perfil, papéis nem config interna do B ✓ · lê config pública ✓ · não lê auditoria ✓                                                  |
| cliente A | não se promove a admin ✓ · `WITH CHECK` impede reatribuir o perfil ✓ · não escreve na auditoria ✓ · `idempotency_keys` dá `42501` ✓ · não escreve em `app_config` ✓ |
| guia      | lê perfis e config interna ✓ · não lê papéis de outro ✓ · não escreve em `app_config` ✓                                                                             |
| admin     | escreve em `app_config` ✓ · lê todos os papéis ✓ · **não apaga a auditoria** ✓                                                                                      |
| anon      | não lê `profiles`, `app_config` nem `feature_flags` ✓                                                                                                               |

### A armadilha que a execução revelou

Duas asserções usavam `throws_ok` para "cliente não escreve em `app_config`" e
falharam. A causa não era a policy: **RLS em `UPDATE` filtra linhas em vez de
lançar exceção.** Um `UPDATE` sem linha visível afeta zero linhas e retorna
sucesso.

O reteste fez a pergunta certa — quantas linhas foram afetadas, e o valor
mudou? — e confirmou 0 linhas afetadas e valores intactos para cliente e guia,
com `INSERT` bloqueado por exceção.

O arquivo de teste foi corrigido para checar o efeito, com comentário
explicando por quê. **Se você vir um `throws_ok` em `UPDATE` sob RLS, é bug de
teste, não de policy.**

Para rodar na máquina (exige Docker):

```bash
npm run db:start && npm run db:reset && npm run db:test
```

## Verificação manual feita

| O quê                                                    | Como                 | Resultado              |
| -------------------------------------------------------- | -------------------- | ---------------------- |
| Fly Ops contra o backend real, `/health` "Operacional"   | preview do navegador | ✅ 419 ms              |
| Fly Ops com backend inalcançável, `/health` "Fora do ar" | preview do navegador | ✅ degrada sem quebrar |
| Fly Crew sobe e serve `/health`                          | preview do navegador | ✅                     |
| Build das três aplicações                                | `npm run build`      | ✅                     |
| Zero vulnerabilidades                                    | `npm audit`          | ✅                     |
| Advisor de segurança do Supabase                         | MCP                  | ✅ 1 INFO intencional  |
| `uuid.v4()` intacto após o override                      | execução direta      | ✅                     |

## O checkout em sandbox: o que está provado e o que não está

Entregue em 27/08/2026 (§40.9 e §40.10). A separação abaixo importa mais do que
a contagem de testes.

**Provado, e como:**

| Afirmação                                                              | Onde                                       |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| Nenhum caminho de erro do adapter devolve "pagou"                      | `packages/payments/src/payments.test.ts`   |
| Timeout **cancela** a requisição, em vez de deixá-la correndo          | idem — a asserção é `signal.aborted`       |
| Configuração ausente, `PENDENTE` ou com typo cai no provedor desligado | idem                                       |
| O instrumento tokenizado não aparece no log                            | idem                                       |
| Corpo adulterado em um byte reprova a assinatura                       | `packages/payments/src/assinatura.test.ts` |
| Reenvio de evento antigo é recusado pela janela de tempo               | idem                                       |
| Trocar o `t` mantendo o `v1` não burla a assinatura                    | idem                                       |
| **Nem cliente nem admin chamam `registrar_evento_pagamento()`**        | `supabase/tests/passeios.test.sql`         |
| O checkout nasce desligado e sem provedor declarado                    | idem                                       |
| Evento repetido continua em um pedido só                               | idem (já existia)                          |

O teste de assinatura importa **o próprio arquivo** que as Edge Functions usam,
e não uma cópia: `supabase/functions/_shared/assinatura.ts`. Uma cópia daria
verde sobre código que não é o que roda.

**Não provado — e não dá para provar sem deploy:**

O caminho HTTP completo (app → `pagamento-sandbox` → `pagamento-webhook` →
pedido confirmado) nunca rodou. As duas funções passam no `deno check`, que
pega import errado e erro de tipo, mas não prova que a entrega acontece. Falta:
publicar as duas funções e definir `FLY_PAYMENTS_WEBHOOK_SECRET` no projeto.
Enquanto isso não for feito, o critério "pagamento sandbox gera um pedido" está
**construído e não demonstrado**.

## Lacunas conhecidas

| Lacuna                                   | Fase que fecha    |
| ---------------------------------------- | ----------------- |
| Fly App em simulador/aparelho real       | 1                 |
| Testes de componente do RN (`jest-expo`) | 1                 |
| Testes E2E (Playwright / Detox)          | 1–2               |
| CI executando no GitHub Actions          | ao criar o remote |
| Acessibilidade e contraste WCAG          | 12                |
| Performance e carga                      | 12                |

## Regras da DoD (§31)

Uma fase só termina quando lint, typecheck e testes passam; a RLS tem teste
**permitido e negado**; o fluxo crítico foi verificado visualmente; a
documentação e o decision log foram atualizados; e **não existe erro conhecido
escondido por mock**.

Pelo critério acima, a Fase 0 está completa. O que resta são melhorias de
ferramental, não lacunas de comprovação: a suíte pgTAP completa espera Docker
(P01) e a CI espera o escopo `workflow` no token do `gh` (P02).

## O bug que a auditoria das Fases 0 a 3 encontrou

`isolamento_viagens.test.sql` não existia. Foi escrito depois de a auditoria
achar isto, na política de `trip_members`:

```sql
exists (select 1 from staff_assignments sa where sa.trip_id = trip_id and ...)
```

`staff_assignments` também tem uma coluna `trip_id`. O Postgres resolveu o
nome no escopo mais interno, e a condição virou `sa.trip_id = sa.trip_id` —
sempre verdadeira. **Qualquer guia com uma atribuição ativa lia a lista de
participantes de todas as viagens.** A política irmã, em `trips`, tinha o erro
espelhado (`sa.trip_id = sa.id`, nunca verdadeiro) e deixava o guia sem ver a
viagem à qual fora atribuído.

O teste da Fase 2 passava. Ele verificava que o guia via a própria viagem — o
que é verdade tanto numa política correta quanto numa política sempre
verdadeira. **Um caso positivo não distingue as duas.**

Daí a regra que `isolamento_viagens.test.sql` segue: toda asserção de acesso
vem em par. Quem pode, e quem não pode.

| Caso                                          | Antes | Depois |
| --------------------------------------------- | ----- | ------ |
| guia vê a própria viagem                      | ✗     | ✓      |
| guia **não** vê viagem alheia                 | ✓     | ✓      |
| guia vê participantes da própria viagem       | ✓     | ✓      |
| guia **não** vê participantes de outra viagem | ✗     | ✓      |
| atribuição revogada perde acesso              | ✗     | ✓      |
| cliente vê só a própria participação          | ✓     | ✓      |

Verificado no projeto `ewgbseesocekvhiiscnb` em transação revertida: 10 de 10.

## Os critérios da §39, um a um

| Critério                            | Como é provado                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| cliente vê somente a viagem correta | cliente e guia da viagem B não veem dia, atividade nem roteiro da A                        |
| mudança no painel aparece no app    | o app lê `activities` direto; o teste altera e relê pelo mesmo caminho                     |
| horário usa fuso certo              | `viagem_atual()` devolve dia 2 de 7 no fuso do destino; `tempo.test.ts` cobre a formatação |
| documento sem grant é negado        | guia da viagem vê 0 documentos e `abrir_documento` lança `42501`                           |
| QR expirado/usado é recusado        | quatro motivos distintos: `expired`, `already_used`, `revoked`, `wrong_scope`              |
| check-in cria log                   | leitura por QR grava presença **e** `qr_scans`, inclusive as recusadas                     |
| Ready Check atualiza Crew           | a operação vê 2 respostas, o cliente vê só a dele                                          |
| essenciais abrem em modo avião      | **não provado** — ver abaixo                                                               |
| reconexão não duplica ações         | `emitir_qr` devolve o código existente; check-in usa `on conflict do nothing`              |

## A armadilha do `throws_ok`, terceira aparição

Uma asserção da Fase 4 esperava `42501` num `update public.qr_tokens set
uses = 0` e recebeu "no exception". A causa não era a política:

**O Supabase concede todos os privilégios das tabelas de `public` a `anon` e
`authenticated` por padrão.** Um `grant select` adicional não restringe — só
repete o que já estava lá. Seis tabelas documentadas como append-only
(`qr_tokens`, `qr_scans`, `consents`, `activity_acks`,
`document_access_log`, `activity_checkins`) tinham UPDATE e DELETE abertos.

Não houve exposição: RLS ligada **sem** política para um comando nega aquele
comando, e era a RLS que estava segurando. O que não existia era a segunda
camada que a documentação afirmava. Corrigido em
`20260825200000_grants_append_only`.

E a diferença que a asserção revelou, agora escrita onde não se perde:

| Comando negado por | Comportamento                          | Como afirmar     |
| ------------------ | -------------------------------------- | ---------------- |
| GRANT ausente      | lança `42501` antes de consultar a RLS | `throws_ok`      |
| RLS em INSERT      | lança `42501` (viola `WITH CHECK`)     | `throws_ok`      |
| RLS em UPDATE      | **filtra zero linhas, sem exceção**    | afirmar o efeito |
| RLS em DELETE      | **filtra zero linhas, sem exceção**    | afirmar o efeito |

O teste agora cobre as duas camadas do mesmo caso: a exceção prova o GRANT, e
o valor intacto prova que nada passou.

## Auditoria que sobrevive à negativa

`ver_passaporte` e `abrir_documento` devolvem `permitido: false` em vez de
lançar exceção, e a razão é sutil o bastante para valer estar escrita:

**`raise exception` desfaz tudo o que a função escreveu na mesma transação**,
inclusive o `insert` que registrou a tentativa. O Postgres não tem transação
autônoma. Uma função que loga e depois lança não loga nada.

Como registrar a tentativa negada _é_ o objetivo — quem tenta abrir um
passaporte que não pode é exatamente o que se quer enxergar —, a negativa
virou dado de retorno. "Não encontrado" continua lançando: isso não é evento
de segurança.

Verificado contra o banco, em transação revertida: duas tentativas negadas de
passaporte e uma de documento, todas presentes em `audit_logs` depois do
`rollback` da chamada.

## O que ainda não é testado

- **Push remoto de ponta a ponta.** Falta credencial de APNs/FCM. O caminho a
  partir da entrega — toque, deep link, login, retomada de contexto — é testado
  em `src/push/push.test.ts` e exercitável na tela `/perfil/push`.
- **Analytics com fornecedor.** Não há fornecedor contratado. A porta de
  consentimento e a barreira de PII são testadas; o envio real, não.
- **Fluxo visual em aparelho físico.** A verificação foi feita no Expo web e
  no simulador.
- **Modo avião.** O cache offline protegido é da Fase 8, junto com o resto da
  resiliência da §24. Hoje, sem rede, as telas caem no estado de erro com
  botão de tentar de novo — o que é honesto, mas não é o critério da §39.
- **Leitura de QR pela câmera.** O `Scanner` do Fly Ops recebe o token por
  campo de texto, que é o que um leitor USB ou um app de câmera nativo
  entrega. A câmera no navegador é da Fase 8.
- **OCR de passaporte.** Deixou de existir: o passaporte é digitado, não
  escaneado. Ver D57.
