# ADR 0003 — Fly Ops e Fly Crew em Vite + React

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

A §21.1 pede um painel web React/TypeScript para o Fly Ops e uma interface
móvel interna para o Fly Crew (Expo ou PWA responsiva, conforme requisitos de
câmera, push e offline).

A equipe já opera `fly-cup` e `legends-dubai-cup` em Vite + React + Tailwind.

## Decisão

Ambos em **Vite 8 + React 19 + TypeScript**, criados com `npm create vite`
(template `react-ts`). Fly Ops na porta 5180, Fly Crew na 5181.

Na Fase 0 cada um sobe, se identifica e serve `/health`.

## Alternativas consideradas

- **Next.js para o Fly Ops** — SSR e rotas de API são atraentes, mas a lógica
  sensível vive em Edge Functions do Supabase (§21.1) e um painel interno não
  precisa de SEO. Traria uma segunda forma de fazer backend.
- **Fly Crew em Expo** — o app do Crew vai precisar de câmera para QR e de
  offline. PWA cobre os dois em Android e, com limitações, em iOS. A escolha
  entre PWA e app nativo depende de requisitos que só a Fase 8 fecha — por
  isso a base é web, e a decisão fica registrada como reavaliável.

## Consequências

- O scaffold do Vite hoje traz **oxlint**. Foi removido: o monorepo usa um
  linter só, ESLint com flat config.
- O `tsconfig.app.json` do scaffold **não vem com `strict`**. Foi corrigido —
  vale conferir isso a cada atualização do template.
- Tailwind ainda não entrou. A Fase 0 não tem telas, e o design system da
  Fase 1 é que decide entre Tailwind e CSS Modules.
- Sem router: `/health` é resolvido por `window.location.pathname` e o
  `appType: 'spa'` do Vite devolve o `index.html`. Router entra na Fase 1.
