# Paridade App ↔ Fly Ops ↔ Fly Crew

Entrega 1 da Fase 11 (§46). Atualizado em 06/09/2026.

A pergunta desta auditoria é uma só, e é a da §46: **toda função que o cliente
usa é realmente operável pela equipe?** Não "existe uma tela parecida" — se o
cliente vê uma coisa no app e ninguém consegue criar, corrigir ou responder
aquilo sem abrir o banco, a função não está operável.

## Como foi levantada

Não por leitura de tela. Foi cruzamento de nomes de tabela, view e função
entre os três aplicativos, sobre o inventário de schema de
`packages/domain-types/src/database.types.ts` — 111 tabelas, 3 views, 34
funções. Um nome que aparece no app e não aparece em nenhum dos dois painéis é
candidato a lacuna; cada candidato foi conferido à mão, porque muitos são
legitimamente do cliente.

O script está reproduzido em [`scripts/paridade.mjs`](../../scripts/paridade.mjs)
e roda em `npm run paridade`. Ele não substitui a conferência à mão: ele diz
onde olhar.

## Resumo

|                                            |                          |
| ------------------------------------------ | ------------------------ |
| Nomes de schema tocados só pelo app        | **57**                   |
| Destes, deliberadamente só do cliente      | 34                       |
| **Lacunas reais de operação**              | **23**                   |
| Fechadas nesta fase                        | 14                       |
| Registradas como pendência                 | 9                        |
| Tabelas que ninguém lê, nem app nem painel | 14 → 6 depois desta fase |

## O que é só do cliente, e está certo assim

Estas não são lacunas. Ou são RPC que o cliente chama e a operação vê o
resultado em outra tela, ou são dados que a Fly deliberadamente não lê.

| Nome                                                                                                                                                                                                                               | Por quê                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `abrir_atendimento`, `criar_pedido`, `cancelar_pedido`, `reservar_no_carrinho`, `resgatar_beneficio`, `resgatar_codigo`, `definir_participantes`, `incluir_pedido_na_viagem`, `emitir_qr`, `advance_onboarding`, `abrir_documento` | Ação do cliente. A operação vê o efeito em Pedidos, Atendimento, Álbum, Passaportes      |
| `home_state`, `home_events`, `viagem_atual`, `vagas_livres`, `vitrine_de_passeios`, `passaporte_para_viagem`, `tem_surpresa_a_caminho`                                                                                             | Leitura composta para a tela do cliente. A fonte é operável                              |
| `carts`, `cart_items`, `tour_favorites`, `devices`, `push_tokens`, `notification_preferences`, `packing_checks`, `activity_acks`                                                                                                   | Estado pessoal do aparelho ou da sessão                                                  |
| `manual_expenses`, `trip_budgets`                                                                                                                                                                                                  | **D227**: nem o admin lê o que a pessoa anotou no planejador. Há asserção pgTAP provando |
| `idempotency_keys`, `payment_events`                                                                                                                                                                                               | Infraestrutura. Não é tela                                                               |

## Lacunas reais

Prioridade **A** = alguém pode se machucar, ou a Fly quebra uma promessa da
spec. **B** = a operação depende de SQL para uma mudança comum. **C** = falta,
mas há caminho manual aceitável.

| #   | Lacuna                                                                                                                                                                    | Pri   | O que quebra hoje                                                                                                                                 | Situação                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **Ficha do hóspede.** `customer_preferences`, `preference_items`, `emergency_contacts`, `companionships` não são lidos por nenhum painel. `Clientes` é uma lista de nomes | **A** | Alergia e restrição alimentar existem no banco e não chegam a quem serve a refeição. Contato de emergência existe e não chega a quem atende o SOS | ✅ fechada — `/clientes/:id`           |
| 2   | **Não há como enviar aviso.** `notifications` só tem GRANT de `select` e de `update (read_at)`. Nenhuma tela insere                                                       | **A** | O app tem uma caixa de avisos que ninguém consegue encher. Mudança de horário de roteiro não vira notificação                                     | ✅ fechada — `/avisos`                 |
| 3   | **Papéis e atribuições não têm tela.** `user_roles` e `staff_assignments` são lidos, nunca escritos                                                                       | **A** | Dar acesso a alguém da equipe exige `insert` manual no banco. Revogar, idem                                                                       | ✅ fechada — `/equipe`                 |
| 4   | **`app_config` e `feature_flags` não têm tela**                                                                                                                           | **A** | O critério da §46 — "nenhuma mudança comum exige editar código" — falha na primeira. Ligar uma flag ou corrigir um texto é SQL                    | ✅ fechada — `/configuracao`           |
| 5   | **`audit_logs` não é lido por ninguém.** 14 RPC escrevem nele                                                                                                             | **B** | A trilha existe e é ilegível. `qr_scans` e `document_access_log` idem                                                                             | ✅ fechada — `/auditoria`              |
| 6   | **Voos, hospedagem e transfers.** `flights`, `flight_passengers`, `accommodations`, `accommodation_guests`, `transfers`, `transfer_passengers`                            | **B** | O cliente vê voo, hotel e transfer na Minha Viagem. Mudança de portão ou de horário é SQL                                                         | ✅ fechada — `/logistica`              |
| 7   | **`trip_inclusions`** — o que está incluso                                                                                                                                | **B** | Mesma tela do cliente, mesma falta                                                                                                                | ✅ fechada — `/logistica`              |
| 8   | **Cofre: `documents`, `document_grants`**                                                                                                                                 | **B** | Só passaporte é operável. Bilhete, voucher e apólice não                                                                                          | ✅ fechada — `/logistica`              |
| 9   | **`packing_items`** — a mala curada                                                                                                                                       | **B** | Criada na Fase 10 sem tela. A lista só cresce por SQL                                                                                             | ✅ fechada — `/configuracao`           |
| 10  | **`quest_missions`, `quest_completions`**                                                                                                                                 | **B** | O Álbum opera capítulo e figurinha; missão não                                                                                                    | ✅ fechada — `/album`                  |
| 11  | **`benefit_redemptions`**                                                                                                                                                 | **B** | O cliente resgata um benefício e a equipe não tem onde ver para honrar                                                                            | ✅ fechada — `/fidelidade`             |
| 12  | **`assistant_runs`, `assistant_tool_calls`, `assistant_feedback`**                                                                                                        | **C** | Gasto e recusa de ferramenta ficam sem leitor. Enquanto o assistente estiver desligado (D220) não incomoda                                        | ✅ fechada — `/auditoria`              |
| 13  | **`payments`, `order_participants`, `cancellation_policies` no Pedidos**                                                                                                  | **B** | O painel mostra o pedido e não mostra se foi pago, nem quem vai                                                                                   | ✅ fechada — `/pedidos`                |
| 14  | **`proposal_requests`** — passeio sob medida                                                                                                                              | **B** | O cliente pede; ninguém recebe                                                                                                                    | ✅ fechada — `/concierge`              |
| 15  | **`restaurants`, `lifestyle_services`**                                                                                                                                   | **C** | Reserva e pedido são operáveis; o catálogo por trás deles, não                                                                                    | ⛔ **P57**                             |
| 16  | **`event_ctas`, `event_media`, `event_participants`, `event_categories`, `event_interests`**                                                                              | **C** | Eventos edita o evento, não o botão, a mídia nem a lista de quem vai                                                                              | ⛔ **P58**                             |
| 17  | **`consent_purposes`** — as finalidades                                                                                                                                   | **C** | Criar uma finalidade nova de consentimento é SQL. Texto jurídico é do dono (§33) de todo jeito                                                    | ⛔ **P59**                             |
| 18  | **Relatório de patrocinadores** (§46, entrega 6)                                                                                                                          | —     | **Não existe domínio de patrocinador.** Só `surprise_tasks.sponsor`, texto livre                                                                  | ⛔ **P56**                             |
| 19  | **`refunds` sem tela própria**                                                                                                                                            | **C** | Aparece embutido em Pedidos; não há visão financeira do estorno                                                                                   | ⛔ P56 (junto do relatório financeiro) |
| 20  | **`coupons`**                                                                                                                                                             | **C** | Lido em Fidelidade, nunca escrito                                                                                                                 | ⛔ P57                                 |
| 21  | **`tour_suppliers`**                                                                                                                                                      | **C** | Escrito no Catálogo, sem visão de fornecedor                                                                                                      | ⛔ P57                                 |
| 22  | **`ready_checks` fora da Presença**                                                                                                                                       | **C** | Operável só dentro do dia                                                                                                                         | — aceito                               |
| 23  | **`destinations`**                                                                                                                                                        | **C** | Escrito em NovaViagem, sem tela própria                                                                                                           | — aceito                               |

## As três que ficaram de fora, e por quê

- **P56 — patrocinadores.** Não há tabela, não há contrato, não há o que
  agregar. Inventar uma entidade de patrocinador é inventar termo comercial,
  que a §33 proíbe. O relatório de comércio agrupa o que existe: o campo
  `sponsor` das surpresas, que é texto livre digitado pela operação.
- **P57 — catálogo de restaurantes, serviços, cupons e fornecedores.** É CRUD,
  e é volume: quatro telas de cadastro. Cabe numa fase de operação, não no
  fim desta.
- **P58 e P59 — evento completo e finalidades de consentimento.** O conteúdo de
  ambos é texto que o dono escreve (§33: texto jurídico, campanha).

## O que sobrou, item a item

| Nome                                                                  | Por quê continua fora                                                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `flight_passengers`                                                   | O voo é operável; **quem está nele**, não. Fica com P57                                                                             |
| `cancellation_policies`                                               | O texto da política é copiado para dentro do pedido na compra; editar o catálogo de políticas é cadastro, e vai com P57             |
| `consent_purposes`                                                    | P59 — o texto de uma finalidade é jurídico, e é do dono (§33)                                                                       |
| `event_ctas`, `event_media`, `event_participants`, `event_categories` | P58                                                                                                                                 |
| `idempotency_keys`, `payment_events`, `carts`                         | Infraestrutura. Não é tela                                                                                                          |
| `activity_acks`                                                       | O "li e entendi" de uma mudança de roteiro. A Presença mostra quem apareceu; quem **leu** o aviso ainda não tem coluna. Vai com P58 |

Nenhuma delas é função do cliente sem dono. As quatro primeiras linhas são
cadastro e texto; as outras são apoio.

## Proprietário operacional por tela

A §46 pede que cada tela crítica tenha proprietário. Papel **mínimo** que
executa, e nada além:

| Tela                                  | Proprietário      | Papel mínimo                                           |
| ------------------------------------- | ----------------- | ------------------------------------------------------ |
| `/hoje`                               | Gerente de viagem | `guide` (leitura), `trip_manager`                      |
| `/clientes`, `/clientes/:id`          | Gerente de viagem | `support`                                              |
| `/logistica`                          | Gerente de viagem | `trip_manager`                                         |
| `/avisos`                             | Gerente de viagem | `trip_manager`                                         |
| `/atendimento`                        | Suporte           | `support`                                              |
| `/pedidos`, `/notas`                  | Financeiro        | `finance`                                              |
| `/fidelidade`                         | Financeiro        | `finance`                                              |
| `/album`, `/galeria`, `/encantamento` | Experiência       | `experience`                                           |
| `/inventario`                         | Experiência       | `experience`                                           |
| `/relatorios`                         | Financeiro        | `finance` (viagem e comércio), `support`, `experience` |
| `/equipe`                             | Administração     | `admin`                                                |
| `/configuracao`                       | Administração     | `admin`                                                |
| `/auditoria`                          | Administração     | `admin`                                                |
| Crew `/casos`, `/entregas`, `/escuta` | Campo             | `guide`, `base`, `media`                               |

Esconder a aba é conveniência. O controle é a RLS, e ela decide de novo em
cada consulta.
