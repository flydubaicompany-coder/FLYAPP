# ADR 0004 — Supabase como backend, em projeto dedicado

**Status:** aceito, **mas violado na prática** — ver "Situação real" abaixo · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

A §21.1 define Supabase como backend: Postgres, Auth, Storage, Realtime e
Edge Functions.

`fly-cup` e `legends-dubai-cup` já usam um projeto Supabase compartilhado
(`ezfmvblirhmootdvqmsr`), com uma tabela `site_content`.

## Decisão

O Fly App usa um **projeto Supabase novo e dedicado**, separado do projeto dos
sites institucionais.

Migrations versionadas em `supabase/migrations/`, com o nome no formato da CLI
(`YYYYMMDDHHmmss_nome.sql`). Tipos gerados para `packages/domain-types`.

A migration de fundação cria apenas a espinha de sistema: `profiles`,
`user_roles`, `app_config`, `feature_flags`, `audit_logs` e `idempotency_keys`.
O modelo completo da §19 vem uma fase por vez.

## Situação real em 27/08/2026 — a decisão não está mais valendo

Auditoria do projeto `ewgbseesocekvhiiscnb` encontrou **três tabelas de outro
produto** dentro dele: `immortals_content`, `immortals_admin` e
`site_media_overrides`, mais cinco migrations `immortals_*`. O site
**IMMORTALS FLY** foi apontado para o projeto do Fly App.

Ou seja: o que esta ADR descartou como alternativa é o que está no ar.

**O que isso NÃO é.** Não é um caminho para o passaporte. A função
`immortals_save_content` é `security definer`, mas tem `search_path` fixo e
escreve **só** em `immortals_content`. Medido, não suposto.

**O que isso É:**

- `immortals_save_content` é executável por `anon`. O único obstáculo entre a
  internet e a escrita no conteúdo do site é uma comparação de token — sem
  limite de tentativas. É um oráculo de força bruta, e o token é curto.
- Passaporte, pagamento e o CMS de um site institucional passaram a
  compartilhar banco, blast radius e janela de manutenção.
- **`supabase db reset` contra este projeto apagaria o conteúdo do site**, que
  não tem migration no repositório do Fly. Hoje o `db reset` só roda local e
  na esteira, mas o comando existe e a armadilha é silenciosa.
- O `get_advisors` do Fly App passou a devolver alertas que não são do Fly App,
  o que treina a equipe a ignorar o relatório.

**Nada foi movido.** Mexer no schema de outro produto sem decisão do dono é
como se derruba um site em produção. Virou a pendência **P39**.

## Alternativas consideradas

- **Reusar o projeto compartilhado** — menos infraestrutura e Fly ID único mais
  simples no curto prazo. Descartado: o Fly App vai guardar passaporte, saúde,
  localização e pagamento (§23.1). Misturar isso com o CMS de um site
  institucional significa uma política de RLS errada em `site_content`
  potencialmente expondo dado de cliente.

## Consequências

- Fly ID entre Fly App e Fly Cup passa a exigir integração explícita entre
  projetos, não uma tabela comum. Ver [ADR 0005](0005-auth-fly-id.md) e
  [ADR 0008](0008-fronteira-fly-cup.md).
- Custo confirmado com a organização: **US$ 0/mês**.
- Sem Docker na máquina, `supabase start` não roda. As migrations são a fonte
  de verdade e valem para qualquer ambiente; a verificação fica pendente até
  haver Docker ou um projeto remoto.
- O `config.toml` gerado expõe apenas `public` e `graphql_public`. O schema
  `fly_private`, onde vivem as funções `security definer`, fica fora da API
  por construção.
