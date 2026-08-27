# ADR 0009 — O Claude Design é a fonte de verdade visual

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

Duas fontes visuais existiam ao mesmo tempo e **não batiam**:

| Token      | Spec §25.2 | Claude Design |
| ---------- | ---------- | ------------- |
| Fundo      | `#050505`  | `#08080A`     |
| Superfície | `#101010`  | `#16161A`     |
| Texto      | `#FFFFFF`  | `#F5F5F7`     |
| Dourado    | `#D4AF37`  | `#DFC98A`     |

A própria §25.2 avisa que "os valores finais dependem do manual da marca e de
teste de contraste".

## Decisão

O projeto Claude Design **"Fly App mobile premium"** é a fonte de verdade
visual. `#DFC98A` é o dourado Fly.

Os dois artboards estão versionados em `docs/design/canvas/`. Os tokens vivem
em `packages/design-tokens` e são **conferidos contra o arquivo do design** por
testes automatizados — um token que escorregar quebra o build.

A regra normativa do dourado foi codificada, não só comentada:

> "Aparece em cinco lugares e em nenhum outro: kicker do evento, selo Exclusivo
> Fly, chip selecionado, progresso para o próximo nível de Fly Points e o
> anel do botão central.
> É o que separa luxo de cassino."

`GOLD_ALLOWED_USES` lista os cinco. Um sexto uso exige decisão registrada.

## Alternativas consideradas

- **Manter a §25.2** — a especificação escrita mandaria. Descartado pelo dono:
  o design é mais recente e foi aprovado agora.
- **Aguardar o manual da marca** (pendência §50.2) — travaria a Fase 1 inteira
  por uma decisão que já tem resposta funcional.

## Consequências

- A §25.2 da spec passa a estar **desatualizada** em relação ao código. Esta ADR
  é o registro dessa divergência; a spec permanece intacta como documento
  histórico.
- `status.success` (`#35C76F`) e `status.danger` (`#F05454`) **não existem no
  design** — vieram da §25.2 e estão marcados como provisórios no código, à
  espera do manual da marca.
- Contraste ainda não foi medido contra WCAG. `text.tertiary`
  (`rgba(245,245,247,.42)`) sobre `#08080A` é candidato a reprovar em texto
  pequeno. Auditoria de acessibilidade é entrega da Fase 12, mas o risco fica
  registrado agora.
- As 5 fotos e os uploads do projeto de design **não** foram versionados: não
  são necessários à fundação e têm direitos de imagem a confirmar (§23).
