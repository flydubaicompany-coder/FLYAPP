# Resumo de continuidade

Para repassar entre ferramentas (Claude Code ↔ ChatGPT ↔ próxima sessão).
Atualizado em **06/09/2026**. Substitua este bloco a cada rodada.

## Onde estamos

|                   |                                                                              |
| ----------------- | ---------------------------------------------------------------------------- |
| Produto           | Fly App (cliente) + Fly Ops (operação) + Fly Crew (campo), sobre um Supabase |
| Fase construída   | **11** de 13 (§46 — consolidação Fly Ops e Fly Crew)                         |
| Fase provada      | **7**                                                                        |
| Commit local      | `2dad5ab`, branch `main`, árvore limpa                                       |
| Commit no GitHub  | `0fe2f60` — **27 commits atrás**                                             |
| Testes de unidade | 434, exit 0                                                                  |
| Asserções pgTAP   | 604 escritas · **238 nunca executadas**                                      |
| Última CI         | 27/08/2026                                                                   |

## Os três bloqueios, em ordem

1. **Sete migrations das Fases 10 e 11 não estão no banco.** Treze telas abrem
   em erro. As Fases 8 e 9 **já estão** aplicadas — conferido pelo PostgREST em
   06/09. Arquivo pronto: `docs/handoff/fases-10-e-11-migrations.sql`.
2. **27 commits não enviados.** Sem push, nenhuma CI roda e as 238 asserções
   continuam sem prova.
3. **Nenhuma tela logada foi vista**, em nenhuma das três aplicações, em
   nenhuma das quatro últimas fases.

## O que muda quando cada bloqueio cair

| Se você…                | Destrava                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| Aplicar as 7 migrations | Fases 10 e 11 saem do erro; 13 telas passam a abrir                    |
| Der `git push`          | CI roda; as 238 asserções são provadas ou reprovadas pela primeira vez |
| Entrar nos apps         | Verificação visual de tudo das Fases 5 a 11                            |

## Decisões que a próxima rodada precisa respeitar

- **§33 — o código não inventa regra.** Prêmio, taxa, tax-free, ranking,
  contato de emergência, texto jurídico, câmbio, dado médico, parceiro de
  pagamento. Onde falta, o valor é `"PENDENTE"` e a tela diz que falta. Há 20
  pendências registradas assim. Preencher com número plausível é regressão.
- **RLS e GRANT são controles diferentes.** Sempre os dois, sempre com teste de
  acesso permitido **e** negado.
- **Ledger é append-only.** Pontos, carteira e inventário. Saldo é view, nunca
  coluna.
- **O dourado `#DFC98A` tem uso contado** — 9 lugares, cada um com decisão
  registrada. Um décimo exige decisão.
- Todo porquê está em `docs/architecture/DECISION_LOG.md` (251 decisões). Leia
  antes de propor mudança: muito do que parece descuido é decisão.

## O que ficou aberto no código

| #           | Assunto                                                                               | Onde                                              |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| —           | `.field { flex: 1 1 14rem }` estica campos na vertical                                | `fly-ops/src/styles.css:217`, mesma regra no Crew |
| —           | Fly Crew não tem rota `/entrar` (404)                                                 | `fly-crew/src/App.tsx`                            |
| P20         | Prazo de atendimento (SLA)                                                            | `support.sla_minutes`                             |
| P43         | Moeda do catálogo (assumido AED)                                                      |                                                   |
| P45/P46/P47 | Benefícios, ranking, tax-free                                                         |                                                   |
| P48–P52     | Mapa, `expo-location`, `expo-camera`, teto de encantamento, conteúdo do álbum         |                                                   |
| P53–P55     | Credencial de modelo, tradução/clima, política de moderação                           |                                                   |
| P56–P59     | Patrocinador, catálogo de restaurantes, evento completo, finalidades de consentimento |                                                   |

## Como manter este arquivo

A cada rodada, registre: **o que mudou**, **quais arquivos**, **o que foi
verificado de fato** e **o que ficou pendente**. Um item que não foi executado
entra como pendente, e não como feito — é a regra que mantém o `ESTADO.md`
confiável.
