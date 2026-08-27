/**
 * @fly/payments
 *
 * O adapter de pagamento (§40.9). Nenhum PSP está contratado — P09 — e este
 * pacote é o que permite o checkout inteiro ser construído e provado antes
 * disso, sem que o app afirme uma integração que não existe.
 *
 * O que **não** está aqui: chave secreta, número de cartão, confirmação de
 * pagamento. Confirmação vem do webhook, no servidor
 * (`supabase/functions/pagamento-webhook`).
 */
export * from './tipos';
export * from './sandbox';
export * from './desligado';
export * from './escolher';
