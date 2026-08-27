# ADR 0010 — Infraestrutura dedicada ao Fly App

**Status:** aceito · **Data:** 27/08/2026 · **Fase:** reorganização, entre a 5 e a 6

## Contexto

A auditoria de 27/08/2026 mediu o que a [ADR 0004](0004-backend-supabase.md) já
suspeitava, e encontrou mais do que ela registrava.

**O que estava no ar:**

|                      | Antes                                                         |
| -------------------- | ------------------------------------------------------------- |
| Repositório          | `adrianmatheusampc-code/fly-ecosystem`, privado               |
| Supabase             | `ewgbseesocekvhiiscnb`, us-east-1                             |
| Organização Supabase | `vercel_icfg_9MAZTgYmRWFDzgXNWR6MkpT3`                        |
| Vercel               | **nenhum projeto do Fly App existia**                         |
| Expo / EAS           | nenhum vínculo — sem `owner`, sem `projectId`, sem `eas.json` |
| Cloudinary           | nenhuma referência no monorepo                                |

**O achado que não estava em documento nenhum:** o `organization_id` do projeto
Supabase não era uma organização Supabase comum. O prefixo `vercel_icfg_`
identifica uma organização **criada pela integração do Marketplace da Vercel**.
O banco que guarda passaporte, pedido e pagamento tinha sido provisionado de
dentro da mesma conta Vercel _hobby_ que hospeda `appflycompany`,
`immortals-fly`, `fly-cup`, `flycup-app` e `legends-dubai-cup`.

Isso explica, sem precisar de culpado, como o IMMORTALS FLY foi apontado para o
banco do Fly App: pela integração, aquele banco ficava ao alcance de qualquer
projeto da conta. O que a P39 registrava como acidente era, na verdade, o
comportamento previsível do arranjo.

**O que o IMMORTALS tinha lá dentro,** medido e não suposto: as tabelas
`immortals_content`, `immortals_admin` e `site_media_overrides`; cinco
migrations sem arquivo correspondente no repositório; o bucket público
`immortals-media` com **6 objetos de produção**; e a função
`immortals_save_content`, `security definer`, executável por `anon`.

Dos 27 alertas do advisor de segurança do "Fly App", **5 eram de outro
produto** — inclusive o mais grave da lista.

## Decisão

Infraestrutura nova e dedicada, recebendo o código existente **sem alteração de
funcionalidade**.

|                      | Depois                                                    |
| -------------------- | --------------------------------------------------------- |
| Repositório          | `flydubaicompany-coder/FLYAPP`                            |
| Supabase             | `ptmifjnfskwipjjxauns`, ca-central-1, Postgres 17.6.1.166 |
| Organização Supabase | `hwvwzmukubznorgbkkwn` — **organização Supabase nativa**  |
| Conta                | `flydubaicompany@gmail.com`                               |

Três consequências que são o objetivo, não efeito colateral:

1. **A organização não é gerida pela Vercel.** O arranjo que produziu a mistura
   não pode se repetir por construção.
2. **A conta nova enxerga um projeto só.** Não existe projeto errado para
   mirar: `supabase projects list` devolve exatamente `ptmifjnfskwipjjxauns`, e
   o projeto antigo está fora do alcance daquele login.
3. **O projeto antigo não foi tocado.** Nem `db reset`, nem `db push`, nem
   `drop`. O site IMMORTALS continua no ar exatamente como estava, sobre
   `ewgbseesocekvhiiscnb`, que segue existindo.

### Sobre o histórico do Git

O dono decidiu **primeiro commit único**. Os 55 commits anteriores continuam
íntegros em `adrianmatheusampc-code/fly-ecosystem` e num arquivo local. O
`FLYAPP` nasce com um commit só, com autoria correta — a anterior estava
gravada como `dsadssda <saddsa>` nos 55.

Custo aceito: as referências a commits passados no decision log deixam de
resolver dentro deste repositório. Elas continuam resolvendo no antigo.

### Sobre a visibilidade

O `FLYAPP` é **público**, por decisão do dono, tomada depois de o risco ter
sido apresentado: spec mestre, decision log, regras de negócio e código ficam
legíveis e forkáveis por qualquer pessoa.

Isso não afrouxa nenhuma regra técnica. Nenhum segredo está versionado, a
esteira falha se um `.env` entrar, e `assertNoServerSecrets` recusa subir o app
se uma variável parecer segredo de servidor. O que é público é o código — não
a chave.

## Alternativas consideradas

- **Mover as três tabelas do IMMORTALS para fora do projeto antigo.** Resolveria
  a mistura sem trocar de projeto. Descartado: mexer no schema de um site em
  produção, cujo repositório não é este, é como se derruba um site no ar. E
  deixaria de pé a organização gerida pela Vercel, que é a causa.
- **Manter o projeto antigo e só criar um novo para produção.** Adiaria o
  problema para o dia em que houvesse dado de cliente real — que é exatamente
  o pior dia para descobrir que o banco é compartilhado.
- **Migrar os dados do projeto antigo.** Não havia o que migrar: 2 usuários de
  teste, 1 viagem de teste, **0 pedidos, 0 pagamentos, 0 passaportes e 0
  documentos**. Tudo reproduzível pelos seeds versionados. O único dado real do
  projeto antigo pertence ao IMMORTALS, e esse não deveria mesmo vir.

## Consequências

- A [ADR 0004](0004-backend-supabase.md) volta a valer como escrita. A **P39
  está fechada**.
- `supabase/config.toml` passou a declarar `verify_jwt` para as quatro Edge
  Functions. Antes só duas estavam lá: `aceitar-convite` roda com
  `verify_jwt = false` por decisão registrada (D30), e um deploy pela CLI a
  teria subido com JWT obrigatório, quebrando a ativação de convite em
  silêncio. A omissão só apareceu porque houve uma troca de projeto.
- O banco novo nasce **sem usuário nenhum**. A Fly é por convite (§37.1) e não
  há cadastro aberto, então o primeiro operador precisa ser criado à mão, no
  painel, com a linha correspondente em `user_roles`. É um passo do dono.
- **Vercel, Expo/EAS e Cloudinary continuam sem definição.** Não eram o que
  estava quebrado: nenhum dos três tinha vínculo com o Fly App antes desta
  mudança. Entram como fases próprias.
- Região mudou de `us-east-1` para `ca-central-1`. Sem efeito sobre o piloto de
  setembro; registrado porque latência a partir de Dubai é diferente e, se
  virar assunto, a causa está aqui.

## O que foi comprovado

| Verificação                               | Resultado                                             |
| ----------------------------------------- | ----------------------------------------------------- |
| 19 migrations aplicadas do zero           | todas, em ordem, sem erro                             |
| Migrations de outro produto               | **nenhuma** — o repositório não tem nenhuma           |
| Tabelas em `public`                       | 70, **zero `immortals_*`**                            |
| Seeds                                     | `seed.sql`, `seed_fase3.sql`, `seed_fase4.sql`        |
| Buckets                                   | `documentos` (privado) e `passeios` (público)         |
| Edge Functions                            | as 4, publicadas e ACTIVE                             |
| Tipos gerados do banco novo × versionados | **zero diferença de schema**                          |
| `npm run verify`                          | exit 0, 310 testes                                    |
| RLS de amostra                            | `app_config` e `feature_flags` recusam `anon` (42501) |
