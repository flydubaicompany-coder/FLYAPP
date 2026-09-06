# Fly Ecosystem

Monorepo do ecossistema Fly: **Fly App** (cliente), **Fly Ops** (operação) e
**Fly Crew** (equipe em campo).

Fonte oficial do produto: [docs/product/FLY_APP_MASTER_SPEC.md](docs/product/FLY_APP_MASTER_SPEC.md).
Regras para quem for mexer no código: [CLAUDE.md](CLAUDE.md).

> **Estado em 06/09/2026: Fase 11 construída.** As Fases 0 a 7 estão entregues
> e provadas; 8 e 9 estão no banco e sem prova de teste; 10 e 11 aguardam sete
> migrations. **Leia [docs/ESTADO.md](docs/ESTADO.md) antes de mexer em
> qualquer coisa** — ele diz o que está provado, o que não está e o que
> depende do dono do produto.
>
> Para uma visão completa do estado real, incluindo screenshots e as
> divergências entre documentação e código: [HANDOFF_APP.md](HANDOFF_APP.md).

## Começar

```bash
npm install
npm run verify       # lint + format + check:sql + typecheck + 434 testes
```

| Aplicação | Comando              | Endereço              |
| --------- | -------------------- | --------------------- |
| Fly Ops   | `npm run dev:ops`    | http://localhost:5180 |
| Fly Crew  | `npm run dev:crew`   | http://localhost:5181 |
| Fly App   | `npm run dev:mobile` | Expo                  |

Antes do primeiro `dev`, copie o `.env.example` de cada app para `.env.local`.

## Estrutura

```
apps/
  fly-mobile/      Expo SDK 57 + Expo Router — o app do cliente
  fly-ops/         Vite + React — painel operacional
  fly-crew/        Vite + React — operação em campo
packages/
  design-tokens/   tokens do Claude Design, conferidos por teste
  domain-types/    papéis, superfícies e tipos gerados do banco
  config/          ambiente, logger com redação, health
  analytics/       taxonomia de eventos com guarda de consentimento
  payments/        adapter de pagamento e verificação de assinatura
  assistant/       barreira de dado do assistente
supabase/
  migrations/      versionadas, formato da CLI
  rollback/        reversão para desenvolvimento
  tests/           RLS: casos permitidos e negados
docs/
  product/ architecture/ security/ operations/ quality/ design/
```

## Banco

```bash
npm run db:start   # exige Docker
npm run db:reset   # migrations + seed
npm run db:test    # RLS
npm run db:types   # regenera os tipos — commite o resultado
```

## Três coisas que não se quebram

1. **Só a chave publicável no cliente.** O boot falha se um segredo de servidor
   aparecer no ambiente — é proteção, não bug.
2. **Os tokens vêm do design.** Um token que divergir do
   `docs/design/canvas/` quebra o build. Não edite o token para o teste passar.
3. **Uma fase por vez.** Não implemente nada fora da fase pedida.
