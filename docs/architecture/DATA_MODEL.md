# Modelo de dados

## Regras válidas para todo o modelo (§19.15)

- nomes em `snake_case`;
- horários em `timestamptz`, com o fuso da viagem explícito;
- dinheiro em `numeric` e moeda ISO;
- foreign keys indexadas;
- constraints para estados e valores;
- paginação por cursor em feeds e extratos;
- IDs públicos opacos;
- **ledgers append-only** — nunca atualização destrutiva de saldo;
- soft delete só com motivo e política clara;
- migrations pequenas, reversíveis e testadas;
- RLS em toda tabela exposta;
- teste de acesso permitido **e** negado, por papel.

## O que existe (migration `20260824000000_foundation`)

Só a espinha de sistema. A §35.9 é explícita: "sem criar ainda todos os domínios".

| Tabela             | Papel                                                | Acesso do cliente           |
| ------------------ | ---------------------------------------------------- | --------------------------- |
| `profiles`         | identidade mínima; nasce por trigger em `auth.users` | lê e atualiza a própria     |
| `user_roles`       | **fonte de verdade de autorização**                  | lê o próprio; nunca escreve |
| `app_config`       | textos, prazos, contatos e parâmetros administráveis | lê só o que é `is_public`   |
| `feature_flags`    | toda função regulada nasce atrás de flag             | lê                          |
| `audit_logs`       | trilha **append-only**                               | nenhum                      |
| `idempotency_keys` | infraestrutura de idempotência                       | nenhum (sem GRANT)          |

Schema `fly_private`: `has_role()`, `is_staff()`, `touch_updated_at()` e
`handle_new_user()`. Fora da API por construção — o `config.toml` expõe apenas
`public` e `graphql_public`.

### Duas decisões que valem explicação

**Papel fora do metadado do usuário.** `raw_user_meta_data` é editável pelo
próprio usuário. Papel guardado ali seria autorização por sugestão. Por isso
`user_roles` é tabela protegida, sem policy de escrita para cliente algum.

**Append-only é a ausência de policy.** `audit_logs` não tem policy de UPDATE
nem de DELETE — nem para admin. O teste `'NEGATIVO: nem admin apaga a trilha de
auditoria'` existe para que ninguém "conserte" isso por engano.

## O que ainda não existe

Os domínios da §19, um por fase:

| Domínio                                                  | Fase |
| -------------------------------------------------------- | ---- |
| Identidade completa, consentimentos, acompanhantes       | 2    |
| Eventos, notificações, conteúdo                          | 3    |
| Viagens, roteiro, documentos, QR, presença               | 4    |
| Passeios, carrinho, pedidos, pagamentos                  | 5    |
| Carteira, ledger de pontos, status, benefícios, tax-free | 6    |
| Refeições, reservas, serviços                            | 7    |
| Suporte, SOS, incidentes                                 | 8    |
| Álbum, figurinhas, missões, mídia                        | 9    |
| Creators, campanhas, métricas                            | 10   |

## Máquinas de estado (§20)

Processos importantes **não** são representados por boolean. As transições da
§20 — pedido, reserva, refeição, SOS, tax-free, figurinha, surpresa — valem
como contrato desde já, e cada uma valida papel, estado anterior, regra e
idempotência. Nenhuma foi implementada na Fase 0.
