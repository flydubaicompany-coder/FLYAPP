# ADR 0006 — Estratégia offline

**Status:** proposto · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

A §24 lista o que precisa funcionar sem rede: próximos compromissos, roteiro
dos dias autorizados, vouchers e QR essenciais, contatos, hotel e base,
documentos selecionados e instruções de emergência.

O princípio §3.7 é mais curto: "o essencial funciona offline".

## Decisão

Registrar a direção agora, **implementar na Fase 4** (Minha Viagem), que é onde
existe conteúdo offline de verdade.

Direção escolhida:

- cache local do que a §24 lista, e só disso;
- fila de ações offline com reconciliação **idempotente** no servidor;
- indicador visível de "dados desatualizados", com a hora da última sincronização;
- modo somente leitura quando a ação exigir servidor;
- limpeza completa do cache no logout;
- cache de documento sensível **criptografado**, e apenas para itens autorizados;
- QR de contingência com validação final no servidor ao reconectar.

## Alternativas consideradas

- **Sincronização total do banco no dispositivo** — resolveria offline de uma
  vez, mas colocaria passaporte, saúde e dados de terceiros do grupo no
  aparelho. Contraria a coleta mínima da §23.2.
- **Nada offline até a Fase 12** — inaceitável: o piloto de setembro acontece
  em Dubai, com roaming irregular, e o roteiro precisa abrir sem rede.

## Consequências

- A escolha de biblioteca (WatermelonDB, TanStack Query com persistência,
  SQLite via Expo) fica para a Fase 4, quando os padrões de acesso forem
  conhecidos. Decidir agora seria chutar.
- Toda mutação criada até lá já nasce idempotente, para que a fila offline não
  exija reescrita.
- **Status "proposto"**, não "aceito": esta ADR será fechada na Fase 4 com a
  biblioteca escolhida.
