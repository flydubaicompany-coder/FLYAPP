# Integrações

## Estado atual

**Nenhuma integração externa está conectada.** Isso é escopo, não pendência:
a §22.2 proíbe declarar integração real sem credencial, contrato, homologação
e teste.

O único serviço externo em uso é o próprio Supabase, com chave publicável.

Desde 27/08/2026 existe **um adapter completo sem provedor do outro lado**:
`@fly/payments`. Ele atende à §40.9 sem contradizer a §22.2 — o contrato está
escrito, o caminho está construído e testado, e o provedor de produção continua
sendo P09.

## Pagamento (§40.9 e §40.10)

```
Fly App
  │  escolherProvedor(flag, config)      ← as duas chaves vivem no banco
  │  provedor.autorizar(intencao)
  ▼
supabase/functions/pagamento-sandbox     ← faz o papel do PSP
  │  iniciar_pagamento(...)  com o JWT do usuário
  │  assina o evento (HMAC-SHA256)
  ▼
supabase/functions/pagamento-webhook     ← o endereço que um PSP real usaria
  │  confere a assinatura
  │  registrar_evento_pagamento(...)  com service_role
  ▼
pedido confirmado ou recusado
```

**Por que o sandbox é uma função remota e não um mock no app.** Um mock no
cliente devolveria "aprovado" sem exercitar assinatura, webhook nem
idempotência — exatamente as partes que quebram em produção. Como o sandbox
fala pela rede e assina de verdade, o caminho testado é o caminho real.
Contratar um PSP muda um adapter e uma linha de `app_config`; não muda tela,
RPC nem webhook.

### Chaves

| Chave                                | Onde vive               | Quem lê            |
| ------------------------------------ | ----------------------- | ------------------ |
| `feature_flags['payments.checkout']` | banco, `feature_flags`  | app (interruptor)  |
| `app_config['payments.provider']`    | banco, `app_config`     | app (qual adapter) |
| `FLY_PAYMENTS_WEBHOOK_SECRET`        | secret da Edge Function | só as duas funções |

O segredo **nunca** está no banco nem no bundle. `readPublicEnv` recusa subir
o app se uma variável parecer segredo de servidor.

### O contrato cumprido, item a item

| Exigência da §22.2      | Como                                                           |
| ----------------------- | -------------------------------------------------------------- |
| interface               | `ProvedorDePagamento`                                          |
| sandbox                 | `ProvedorSandbox` + `pagamento-sandbox`                        |
| credencial por ambiente | secret da Edge Function                                        |
| timeout                 | `AbortSignal.timeout`, 15 s, **cancelando** a requisição       |
| retry controlado        | o do provedor: reenvio até receber 2xx, idempotente por evento |
| logs sem PII            | instrumento nunca é logado; `createLogger` ainda redige        |
| fallback humano         | `indisponivel` leva a tela ao "a Fly entra em contato"         |
| feature flag            | `payments.checkout`, nasce desligada                           |

### O que falta para funcionar de verdade

Publicar as duas funções e definir `FLY_PAYMENTS_WEBHOOK_SECRET`. Sem isso o
webhook responde `503` e o sandbox recusa — de propósito: sem segredo não há
como distinguir evento do provedor de evento forjado, e aceitar "por enquanto"
seria abrir um endpoint que confirma pedidos.

## Contrato de todo adapter (§22.2)

Antes de qualquer integração entrar, ela precisa de:

- interface no domínio, não chamada direta do componente;
- modo mock/sandbox;
- credenciais por ambiente, via secret manager;
- timeout;
- retry controlado;
- circuit breaker quando fizer sentido;
- **logs sem PII**;
- status operacional visível;
- fallback humano;
- feature flag.

## Mapa por fase

| Integração                           | Fase | Decisão pendente                                        |
| ------------------------------------ | ---- | ------------------------------------------------------- |
| Pagamento / tokenização de cartão    | 5    | §50.5 — provedor (adapter e sandbox prontos; ver acima) |
| Pix                                  | 5–6  | §50.6 — regra                                           |
| Saldo / Fly Card                     | 6    | §50.7 — parceiro regulado                               |
| Push                                 | 3    | —                                                       |
| Mapas e rotas                        | 8    | §50.12 — provedor                                       |
| Status de voo                        | 4    | §50.13 — provedor                                       |
| Clima                                | 4    | —                                                       |
| OCR de notas                         | 6    | §50.14 — provedor                                       |
| Tax-free                             | 6    | §50.15 — processo real                                  |
| SMS / e-mail / WhatsApp transacional | 3    | —                                                       |
| Tradução                             | 10   | —                                                       |
| Telemedicina                         | 8    | —                                                       |
| Mobilidade e delivery                | 7    | contrato e termos                                       |
| Mídia e processamento de vídeo       | 9    | —                                                       |
| Analytics                            | 3    | —                                                       |
| Error tracking                       | 3    | —                                                       |

## Deep links (§22.3)

Rotas mínimas a suportar: ativação de convite, viagem/dia/atividade, ticket,
evento, passeio, pedido, carteira, benefício, suporte e Fly Cup.

Notificação abre o contexto exato e trata usuário deslogado ou sem permissão.

**Registrado agora:** `apps/fly-mobile` usa `scheme: "fly"`, o mesmo do
`appflycompany`. Em um aparelho com os dois instalados, só um resolve `fly://`.
Pendência para o dono.

## Regras que valem para todas

- Nenhuma chave secreta chega ao cliente. `assertNoServerSecrets` em
  `@fly/config` transforma essa regra em erro de execução.
- Webhook de pagamento é **assinado** e **idempotente**.
- Falha de integração degrada com elegância e mostra caminho humano — nunca
  deixa o cliente sem saída.
