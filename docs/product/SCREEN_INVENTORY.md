# Inventário de telas

Deriva da especificação mestre. A coluna **Fase** diz quando cada tela é
construída — nada é antecipado.

## Navegação definitiva (§4)

`Início` · `Passeios` · **`Minha Viagem`** (botão central elevado) · `Carteira` · `Perfil`

Flutuantes: **Carrinho** e **Fly Assist / SOS**.

O protótipo em `docs/design/canvas/Fly Phone.dc.html` já implementa essa
estrutura — é o alvo concreto da Fase 1.

## Fly App

| Tela                                                      | §         | Fase | Estado     |
| --------------------------------------------------------- | --------- | ---- | ---------- |
| Fundação + `/health`                                      | 35.10     | 0    | ✅ existe  |
| Design system e navegação de 5 abas                       | 4, 25     | 1    | ✅ existe  |
| Onboarding, Fly ID, Perfil                                | 9         | 2    | ✅ parcial |
| Home — sem viagem / pré / durante / pós                   | 5         | 3    | ✅ existe  |
| Acontece na Fly (eventos)                                 | 5.6       | 3    | ✅ existe  |
| Passeios: catálogo, busca, filtros, card                  | 6.1–6.3   | 5    | —          |
| Detalhe do passeio                                        | 6.4       | 5    | —          |
| Meus Passeios                                             | 6.1       | 5    | —          |
| Carrinho: casca e estado vazio                            | 6.5       | 1    | ✅ existe  |
| Carrinho com itens e checkout                             | 6.5       | 5    | —          |
| Minha Viagem — raiz e hub                                 | 7.1–7.2   | 4    | ✅ existe  |
| Roteiro por dia                                           | 7.3       | 4    | ✅ existe  |
| Detalhe de atividade                                      | 7.3       | 4    | ✅ existe  |
| Tudo que está incluso                                     | 7.4       | 4    | ✅ existe  |
| Voos e **Modo Aeroporto**                                 | 7.5       | 4    | ✅ existe  |
| Hotel e transfer                                          | 7.6       | 4    | ✅ existe  |
| Cofre da viagem                                           | 7.7       | 4    | ✅ existe  |
| QR Codes                                                  | 7.8       | 4    | ✅ existe  |
| **Ready Check**                                           | 7.9       | 4    | ✅ existe  |
| Teste de push                                             | 38.10     | 3    | ✅ existe  |
| Passaporte (dados digitados)                              | 7.5, 9    | 4    | ✅ existe  |
| Fly Ops — passaportes e conferência                       | 7.5, 16   | 4    | ✅ existe  |
| Carteira: resumo, pontos, benefícios, pagamentos, compras | 8         | 6    | —          |
| Scanner de notas e Tax-Free                               | 8.8       | 6    | —          |
| Refeições da viagem                                       | 11.1      | 7    | —          |
| Restaurantes e serviços                                   | 11.2–11.3 | 7    | —          |
| Mapa e Bases Fly                                          | 12.1–12.2 | 8    | —          |
| Folha do Fly Assist com as três escolhas                  | 12.3–12.4 | 1    | ✅ existe  |
| Fluxo real de ajuda urgente e **SOS**                     | 12.3–12.4 | 8    | —          |
| Álbum, capítulos, figurinhas, **Dia Completo**            | 13.1–13.2 | 9    | —          |
| Galeria Fly                                               | 13.5      | 9    | —          |
| Modo Influenciador                                        | 13.6      | 9    | —          |
| Fly Quest                                                 | 14.1      | 9    | —          |
| Assistente, tradução, Fly Social, planejador              | 15        | 10   | —          |

## Fly Ops

| Tela                                | §         | Fase | Estado     |
| ----------------------------------- | --------- | ---- | ---------- |
| `/health`                           | 35.10     | 0    | ✅ existe  |
| Hoje                                | 16.1      | 3+   | —          |
| Clientes · Viagens · Roteiro        | 16.2–16.4 | 2–4  | ✅ parcial |
| Passeios e comércio                 | 16.5      | 5    | —          |
| Carteira e fidelidade               | 16.6      | 6    | —          |
| Refeições e reservas                | 16.7      | 7    | —          |
| Suporte e SOS                       | 16.8      | 8    | —          |
| Álbum, mídia e experiência          | 16.9      | 9    | —          |
| Eventos                             | 16.10     | 3    | —          |
| Configuração, segurança e auditoria | 16.11     | 11   | —          |

## Fly Crew

| Tela                                   | §     | Fase | Estado    |
| -------------------------------------- | ----- | ---- | --------- |
| `/health`                              | 35.10 | 0    | ✅ existe |
| Agenda do dia e lista de grupo         | 17    | 4    | —         |
| Ready Check e escanear QR              | 17    | 4    | —         |
| Validar refeição                       | 17    | 7    | —         |
| Receber e atender SOS                  | 17    | 8    | —         |
| Registrar insight e tarefa de surpresa | 17    | 9    | —         |
| Subir e marcar mídia                   | 17    | 9    | —         |

## Fase 2 entregue

Convite · Entrar · Onboarding em 5 etapas · Perfil com QR pessoal · Dados ·
Preferências · Acompanhantes · Contato de emergência · Privacidade e
consentimentos · Ranking · Notificações · Quem Somos.

Fly Ops: Clientes, Convites e Consentimentos.

## Componentes fundamentais entregues na Fase 1

`Text` e `Kicker` · `Screen` · `AppHeader` · `Card` · `AlertBanner` ·
`OfflineBanner` · `PhaseStub` · `LoadingSkeleton` · `EmptyState` ·
`ErrorState` · `OfflineState` · `PermissionDeniedState` · `StateShell` ·
`BottomNav` · `CentralTripButton` · `FloatingActionRail` · `AssistSheet` ·
ícones de aba.

Os componentes de domínio da §25.3 — `TourCard`, `WalletSummary`, `TicketCard`,
`QRPass`, `StickerCard`, `MealOptionCard` e os demais — pertencem às fases que
os usam. Construí-los agora exigiria inventar preço, horário e disponibilidade,
o que a §33 proíbe.

Catálogo vivo em `/catalogo`, dentro do próprio app.

## Estados obrigatórios

Toda tela trata **carregando · vazio · erro · permissão negada · offline**
quando aplicável (§34). Não é opcional e não é polimento de fim de fase.

## O que a Fase 4 entregou, e o que ficou de fora

**Entregue e verificável:**

| Entrega da §39                        | Onde                                              |
| ------------------------------------- | ------------------------------------------------- |
| Tela raiz com Agora/Próximo e dias    | `app/(tabs)/viagem.tsx`                           |
| Hub completo                          | `viagem/hub.ts` — 8 abertos, 7 marcados           |
| Roteiro por dia e detalhe             | `app/viagem/roteiro.tsx`, `atividade/[id]`        |
| Tudo que está incluso                 | `app/viagem/incluso.tsx`                          |
| Voos e Modo Aeroporto                 | `app/viagem/voos.tsx`                             |
| Hotel e transfer                      | `app/viagem/hotel.tsx`                            |
| Cofre privado                         | `app/viagem/cofre.tsx` + bucket `documentos`      |
| Tickets e QR                          | `app/viagem/qr.tsx`                               |
| Ready Check, atraso, grupo não achado | detalhe da atividade + `Presenca.tsx`             |
| CRUD de viagens e roteiro (Ops)       | `fly-ops/src/paginas/Viagens.tsx`                 |
| Templates de roteiro                  | `aplicar_template()` + botão em Viagens           |
| Leitura de QR e check-in manual (Ops) | `Scanner.tsx`, `Presenca.tsx`                     |
| Alteração de horário com confirmação  | gatilho `stamp_activity_change` + `activity_acks` |

**Fora, e por quê:**

| Entrega da §39                | Motivo                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scanner de passaporte com OCR | Sem fornecedor de OCR contratado. A §7.7 proíbe mandar passaporte a modelo genérico, e a §33 proíbe declarar integração sem contrato. O schema já tem `extracted` e `reviewed_at`; falta o serviço. Ver P33. |
| Cache offline protegido       | A coluna `cacheable_offline` existe e o passaporte é barrado por constraint, mas o cache em si é da Fase 8, onde entra o resto da resiliência (§24).                                                         |
| Push de alteração de horário  | Depende das credenciais de APNs/FCM (P32). A alteração já aparece com destaque no app e exige confirmação de leitura; o que falta é o empurrão.                                                              |
| Acompanhantes na viagem       | A RLS já libera o responsável a ver o dependente. A tela dedicada continua em `/perfil/acompanhantes`, da Fase 2.                                                                                            |
