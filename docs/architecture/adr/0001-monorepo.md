# ADR 0001 — Monorepo, localização e gerenciador de pacotes

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

Não havia repositório. A pasta de trabalho era um depósito de mídia com ~47 GB.
Três projetos de código coexistiam como pastas soltas, dois deles versionados
de forma independente e um sem versionamento nenhum.

A §21.2 da spec sugere um monorepo `fly-ecosystem/` com `apps/`, `packages/`,
`supabase/` e `docs/`.

## Decisão

Monorepo em `/Users/psg.vito/Downloads/FLY/fly-ecosystem`, repositório git
próprio, com **npm workspaces**. Sem Turborepo, sem pnpm, sem Nx.

Packages criados na Fase 0: `design-tokens`, `domain-types`, `config`.

TypeScript **6.0.3** em todo o workspace, com `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax` e `erasableSyntaxOnly`.

## Alternativas consideradas

- **`Documents/fly-ecosystem`** — mais protegido contra limpeza de `Downloads`,
  mas quebraria a convenção dos outros projetos Fly. Descartado pelo dono.
- **Converter `appflycompany` em monorepo** — reaproveitaria git e deploy, mas
  misturaria o histórico de um protótipo com a fundação e complicaria rollback.
- **pnpm ou Turborepo** — ganho real só aparece com muitos pacotes e cache
  distribuído. Na Fase 0 seria complexidade sem contrapartida. Reavaliar quando
  o build passar de ~2 minutos.
- **TypeScript 7.0.2** (a versão mais recente) — `typescript-eslint` estável
  (8.67.0) declara `typescript: >=4.8.4 <6.1.0`. Escolher TS 7 hoje custaria o
  lint, que é critério de aceite. Fixado em 6.0.3; migrar quando o
  `typescript-eslint` suportar.

## Consequências

- Um `npm install` na raiz resolve tudo; `npm run verify` cobre o workspace.
- `.npmrc` com `save-exact=true`: versões travadas, sem surpresa de minor.
- `packages/ui-mobile`, `ui-web`, `validation`, `fly-id` e `analytics` estão
  previstos pela §21.2 mas **não foram criados vazios** — abstração prematura é
  proibida pela §35.8. Entram quando houver segundo consumidor real.
- Risco herdado: morar em `Downloads` deixa o repositório exposto a limpeza.
  Mitigação: criar remote cedo.
