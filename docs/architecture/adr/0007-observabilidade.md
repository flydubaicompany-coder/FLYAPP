# ADR 0007 — Analytics e observabilidade

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

A §21.1 pede erros, logs estruturados, performance e eventos de produto. A
§27 detalha as métricas. A §23.2 impõe o limite: "logs sem conteúdo sensível".

A §22.2 é igualmente clara: nenhuma integração externa é declarada real sem
credencial, contrato, homologação e teste.

## Decisão

Fase 0 entrega o mínimo que já é útil e nada além:

1. **Logger estruturado** em `@fly/config`, com saída JSON e nível configurável.
2. **Redação automática** de campos sensíveis antes de emitir — passaporte,
   localização, saúde, e-mail, telefone, cartão, token e afins viram
   `[redacted]`, recursivamente e à prova de ciclo.
3. **Página `/health`** nas três aplicações: serviço, ambiente, versão, commit,
   host do backend e resultado das sondas. Sem PII, sem chave, sem contagem de
   registros.
4. **Nenhum provedor externo conectado.** Sentry, PostHog e similares entram
   com adapter, feature flag e credencial por ambiente, na fase que precisar.

## Alternativas consideradas

- **Conectar Sentry agora** — tentador, mas sem credencial nem contrato seria
  exatamente o que a §22.2 proíbe: declarar integração que não existe.
- **Confiar na revisão de código para não logar PII** — revisão falha. A
  redação no logger torna o caminho seguro o caminho padrão.

## Consequências

- `logger.info('checkin', user)` é seguro por construção: campos sensíveis
  saem redigidos mesmo que ninguém tenha pensado nisso.
- A lista de campos redigidos é conservadora e vai gerar falso positivo (um
  campo chamado `location` de uma cidade pública, por exemplo). Preferível ao
  inverso.
- Eventos de produto da §27 não existem ainda. Entram junto das telas.
