# Fonte do design

## Origem

Projeto Claude Design **"Fly App mobile premium"**
`https://claude.ai/design/p/8687d656-962d-4c07-a041-d985666c3d1d`

## O que está versionado aqui

| Arquivo                    | Papel                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `canvas/Fly App.dc.html`   | Página de sistema: paleta, Fly Status, tipografia, material, geometria                   |
| `canvas/Fly Phone.dc.html` | O protótipo navegável — telas `home`, `passeios`, `meus`, `viagem`, `carteira`, `perfil` |

## O que NÃO foi versionado, e por quê

- **5 fotos** (`opt-*.jpg`) e **5 uploads** — não são necessários à fundação e
  têm direitos de imagem a confirmar (§23). Entram na Fase 1.
- **4 PNGs de marca** (`fly-wordmark`, `fly-wing`, `fly-wing-gold`,
  `fly-wing-dim`) — mesma decisão: entram na Fase 1, com o manual da marca.
- **`support.js`** — runtime do canvas do Claude Design, não é código do produto.

## O que é autoritativo

Os tokens em `packages/design-tokens` são derivados destes arquivos e
**conferidos contra eles por teste automatizado**
(`packages/design-tokens/src/tokens.test.ts`).

Se um teste de token quebrar, há duas saídas legítimas:

1. ressincronizar o design (abaixo);
2. registrar a divergência em um ADR.

Editar o token para "passar o teste" **não** é uma delas.

## Ressincronizar

Os arquivos vêm do MCP do Claude Design. Para atualizar, peça ao Claude Code:

> Releia `Fly App.dc.html` e `Fly Phone.dc.html` do projeto de design e
> atualize `docs/design/canvas/` e `packages/design-tokens`.

Depois rode `npm test` — os testes dizem exatamente o que mudou.

## A regra do dourado

Citação literal do design:

> "Aparece em cinco lugares e em nenhum outro: kicker do evento, selo Exclusivo
> Fly, chip selecionado, progresso para o próximo nível de Fly Points e o
> anel do botão central.
> É o que separa luxo de cassino."

Codificada em `GOLD_ALLOWED_USES`. Um sexto uso exige decisão registrada.

## Divergência com a §25.2 da spec

A spec escrita lista `#D4AF37` e `#050505`. O design usa `#DFC98A` e `#08080A`.
Decidido a favor do design em [ADR 0009](../architecture/adr/0009-fonte-de-verdade-do-design.md).
