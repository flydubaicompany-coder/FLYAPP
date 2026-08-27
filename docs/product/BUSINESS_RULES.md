# Regras de negócio

## A regra sobre as regras (§33)

Estas nunca são inventadas pelo código:

valores de status · fórmula de pontos · validade de pontos · critérios de
ranking · prêmios · orçamento de encantamento · horário de roteiro · prazo de
refeição · preço · câmbio · disponibilidade · política de cancelamento ·
contato de emergência · regra de tax-free · dado médico · integração
governamental · localização de funcionário · papel e permissão · período de
retenção · consentimento · texto jurídico · parceiro de pagamento · taxa
financeira.

Faltando uma delas: **configuração ou placeholder marcado**, e a pendência vai
para o [decision log](../architecture/DECISION_LOG.md). Suposição não vira
regra de produção.

## Placeholders já plantados

Em `supabase/seed.sql`, com valor literal `"PENDENTE"`:

| Chave                               | Espera                                                                   | Pendência |
| ----------------------------------- | ------------------------------------------------------------------------ | --------- |
| `meals.confirmation_deadline_hours` | prazo de confirmação de refeição — a §11.1 cita 5 h, mas proíbe hardcode | —         |
| `support.emergency_contacts`        | contatos oficiais de emergência                                          | P20       |
| `points.earn_formula`               | fórmula de Fly Points                                                    | P12       |
| `status.tiers`                      | níveis e validade do Fly Status                                          | P13       |

Feature flags, todas **desligadas**:

`wallet.balance_topup` · `wallet.fly_card` · `tax_free.partner_submit` ·
`sos.enabled` · `assistant.ai`

## Invariantes que valem desde já

### Os três sistemas de progresso são separados (§10)

| Sistema             | Representa                                |
| ------------------- | ----------------------------------------- |
| **Fly Status**      | relacionamento e valor elegível acumulado |
| **Fly Points**      | saldo resgatável                          |
| **Jornada / Álbum** | experiências concluídas em uma viagem     |

Uma compra pode afetar status e pontos — mas são **lançamentos independentes**.
Uma figurinha pode dar pontos; ela não é o ponto.

### Dinheiro e valor

- Ledgers são **append-only**. Reversão é lançamento novo, nunca exclusão.
- Dinheiro, crédito promocional, reembolso e pontos são **contas diferentes**,
  cada uma com ledger próprio.
- Preço é calculado **no servidor**. Sempre.
- A Fly não armazena PAN completo nem CVV — tokenização é do provedor.
- Tax-free é **estimativa**, nunca promessa. O app não promete devolução de 5%.

### Idempotência

Pedido, pagamento, resgate de QR, lançamento de ponto e webhook são
idempotentes. `idempotency_keys` já existe para isso.

### Autorização

> "O papel permite uma função; a atribuição limita a viagem; o consentimento
> limita o dado." (§18)

Papel vive em tabela protegida. O cliente nunca decide o próprio acesso.

### Privacidade

Cliente não vê dado sensível de outro integrante do grupo. Insight interno de
encantamento **nunca** aparece para o cliente. Localização exata de funcionário
não é revelada.

## Máquinas de estado (§20)

Processo importante não é boolean:

- **Pedido** — `draft → awaiting_payment → paid → confirmed → fulfilled`
  (+ `cancelled`, `refund_pending`, `refunded`, `failed`)
- **Reserva** — `held → confirmed → checked_in → completed` (+ `expired`, `cancelled`, `no_show`)
- **Refeição** — `available → selected → confirmed → locked → sent_to_supplier → delivered`
- **SOS** — `created → acknowledged → assigned → responding → resolved → closed`
  (+ `escalated`, `cancelled_by_user`, `connection_lost`)
- **Nota/Tax-Free** — `draft → extracted → user_reviewed → operations_review → partner_submitted → validated → refunded`
  (+ `needs_information`, `rejected`)
- **Figurinha** — `locked → eligible → unlocked → media_available`
- **Surpresa** — `insight → proposed → approved → purchased → prepared → delivered → recorded`

Toda transição valida papel, estado anterior, regra e idempotência.
Nenhuma foi implementada na Fase 0.
