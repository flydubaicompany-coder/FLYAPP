# Visão do sistema

Estado em 24/08/2026, fim da Fase 0.

## Superfícies

| Superfície   | Público                          | Onde vive                              | Estado      |
| ------------ | -------------------------------- | -------------------------------------- | ----------- |
| **Fly App**  | cliente e viajante               | `apps/fly-mobile` (Expo + Expo Router) | fundação    |
| **Fly Ops**  | gestão e operação                | `apps/fly-ops` (Vite + React)          | fundação    |
| **Fly Crew** | guias, bases, mídia, experiência | `apps/fly-crew` (Vite + React)         | fundação    |
| **Fly Cup**  | atleta, equipe, fã               | fora deste repositório                 | em produção |

## Desenho

```
   Fly App (Expo)        Fly Ops (web)        Fly Crew (web)
        |                     |                     |
        +----------+----------+----------+----------+
                   |                     |
            chave publicavel      chave publicavel
                   |                     |
        +----------v---------------------v----------+
        |                Supabase                    |
        |  Auth · Postgres+RLS · Storage privado     |
        |  Realtime · Edge Functions                 |
        +--------------------+-----------------------+
                             |
                     +-------v-------+
                     |  adapters     |  pagamento, mapas, voo,
                     |  (fase a fase)|  OCR, push, tax-free...
                     +---------------+

   Fly Cup  <--- deep link + Fly ID --->  Fly App
   (produto separado, Supabase proprio)
```

## Camadas (§21.3)

UI → view models/hooks → casos de uso → domínio → repositories → clientes
externos → persistência/cache → telemetria.

**Componente visual não chama webhook, chave secreta nem regra de saldo.**

## Packages compartilhados

| Package              | Responsabilidade                                                  |
| -------------------- | ----------------------------------------------------------------- |
| `@fly/design-tokens` | cor, tipografia, geometria e material, extraídos do Claude Design |
| `@fly/domain-types`  | papéis, superfícies e tipos gerados do banco                      |
| `@fly/config`        | ambiente, logger com redação, payload de health, sonda de backend |

Previstos pela §21.2 e ainda **não criados**, por serem abstração prematura
nesta fase: `ui-mobile`, `ui-web`, `validation`, `fly-id`, `analytics`.

## O que existe hoje

- as três aplicações sobem e servem `/health`;
- migration de fundação com seis tabelas de sistema, RLS e GRANTs explícitos;
- 64 testes automatizados; 28 asserções de RLS escritas, aguardando banco;
- CI com lint, formatação, tipos, testes, build, varredura de `.env` e um job
  de banco com migrations, lint de schema, RLS e conferência dos tipos gerados.

## O que não existe

Nenhuma tela de produto. Nenhum pagamento. Nenhuma carteira. Nenhuma IA.
Nenhuma integração externa conectada. Por decisão de escopo — Fase 0 é fundação.
