# ADR 0008 — Fronteira entre Fly App e Fly Cup

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

Entrega §35.3: identificar se o Fly Cup está no mesmo repositório e documentar
a fronteira.

A auditoria encontrou `fly-cup/` e `legends-dubai-cup/`: aplicações web
independentes, Vite + React 18 + Tailwind, com Supabase próprio e deploy
próprio. **Zero código compartilhado com o Fly App.**

## Decisão

O Fly Cup **permanece separado**. Nenhuma migração — destrutiva ou não.

A fronteira é a que a §2.3 já define:

| Aspecto     | Regra                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------- |
| Repositório | separado; sem código comum                                                                   |
| Banco       | projetos Supabase distintos                                                                  |
| Identidade  | Fly ID compartilhado, via integração explícita (Fase 2+)                                     |
| Conteúdo    | eventos aparecem na Home do Fly App vindos do Fly Ops, nunca hardcoded                       |
| Navegação   | CTA "Abrir no Fly Cup" via deep link, mantendo a sessão do Fly ID                            |
| Pontos      | conversões autorizadas do Fly Cup entram no ledger do Fly App como lançamento próprio (§8.3) |

O que o Fly App **não** absorve (§1): tabelas, confrontos, inscrições, súmulas
e rankings esportivos completos.

## Alternativas consideradas

- **Trazer o Fly Cup para o monorepo** — daria CI e tooling comuns. Descartado:
  a §21.2 avisa para "não migrar por impulso; primeiro documentar fronteiras,
  SSO e contratos". Nada disso está fechado.

## Consequências

- `fly-cup/` continua **sem controle de versão** — risco herdado, registrado no
  [REPO_AUDIT](../REPO_AUDIT.md). Recomendação: `git init` ali, fora desta fase.
- O contrato de deep link e o SSO precisam ser especificados antes da Fase 2.
- Fly Points atravessando produtos vai exigir um contrato de conversão
  auditável. Decisão pendente §50.20.
