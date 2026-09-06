# TRIP MODE — Dubai, 10 a 17 de setembro de 2026

Release isolado do Fly App para os participantes da viagem.
Branch: **`release/trip-mode-dubai-2026-09`**. `main` não foi tocada.

## O que é, em uma frase

O **mesmo aplicativo**, com quatro abas em vez de cinco, ligado por uma
variável de ambiente. Nenhuma tela foi apagada, nenhum código foi reescrito, e
nenhuma RLS foi afrouxada para caber no prazo.

```bash
EXPO_PUBLIC_FLY_TRIP_MODE=true          # liga o modo viagem
EXPO_PUBLIC_FLY_SUPPORT_WHATSAPP=+55…   # rede de segurança do WhatsApp
```

Sem a variável, o build é o Fly App completo de sempre. É por isso que a
produção atual não muda: ela não tem a variável.

### Por que ambiente, e não `feature_flags`

O projeto prefere flag de banco, e com razão. Aqui é o contrário de propósito:
o Trip Mode muda **a navegação** — quantas abas existem. Uma flag de banco
faria a barra mudar de forma com o app aberto, e obrigaria a build de produção
a carregar as duas versões. O que se quer é um **artefato separado**, saindo do
mesmo código.

O **conteúdo** continua vindo do banco: o WhatsApp está em `app_config`, e o
valor do build é só a rede de segurança para o dia em que a migration ainda não
tiver sido aplicada.

---

## O que o participante vê

| Aba                                   | Tela                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| **Início**                            | Banner da viagem, alertas, próximo compromisso, seu dia, 7 atalhos |
| **Minha Viagem** _(central, elevada)_ | A tela de sempre — roteiro, voos, hotel, cofre, QR, refeições      |
| **Galeria**                           | As fotos da viagem                                                 |
| **Perfil**                            | Conta, documentos, preferências, privacidade                       |

**Botão flutuante de ajuda:** continua onde estava. O que mudou é o destino —
abre a folha com sete assuntos e, ao escolher, abre o WhatsApp da operação com
a mensagem **já escrita**:

```
Olá, equipe Fly.
Sou Marina.
Estou participando da viagem Dubai Setembro 2026.

Preciso de ajuda com: Estou perdido
Atividade agora: Desert Safari — Lobby do hotel
```

O contexto sai do que o app já sabe. Campo que não se sabe **não entra** — não
existe "Atividade atual: —".

---

## O que foi reaproveitado, e o que foi construído

**Reaproveitado inteiro** (nenhuma linha nova): roteiro, voos, hotel com número
do quarto, cofre, QR, refeições, meus passeios, vouchers de pedido, galeria,
catálogo de passeios, cartão de passeio, sessão, tema, componentes e animações.

**Construído para este release:**

| O quê                   | Onde                                | Por quê                                                                                         |
| ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Alertas do roteiro      | `src/trip/alertas.ts`               | O push nunca entregou uma notificação real. O alerta sai da hora que a operação já escreveu     |
| WhatsApp com contexto   | `src/trip/whatsapp.ts`              | Não há chat próprio provado em produção                                                         |
| Home da viagem          | `src/trip/TripHome.tsx`             | A Home completa fala de eventos e ofertas; esta fala de uma viagem acontecendo                  |
| **Envio de documentos** | `src/trip/useDocumentosPessoais.ts` | **O app lia o cofre desde a Fase 4 e nunca soube escrever nele.** Só notas fiscais tinham envio |
| Mais experiências       | `app/experiencias.tsx`              | Mesma consulta e mesmo cartão de Passeios; muda só o fim do fluxo                               |
| Barra de quatro abas    | `src/navigation/`                   | Com peso igual nos dois lados, para o botão central não sair do eixo                            |

### Três decisões que valem explicação

**Passeios e Carteira saem da barra, não do app.** As rotas continuam
registradas (`href: null` tira da barra do Expo Router sem tirar a rota), e um
deep link para `/passeios` continua abrindo. Barra é promessa: prometer
Carteira sem valor de ponto definido (P45/P46) é prometer o que não se cumpre.

**"Solicitar experiência" não compra.** O pagamento deste projeto é sandbox, e
o parceiro continua pendente (P09/P38). Um botão "Comprar" numa tela cujo
pagamento é de mentira seria a única mentira possível numa viagem em que
alguém vai clicar de verdade.

**Pontos e Ranking somem do Perfil.** As duas regras que os governam são
pendência do dono. Um saldo cuja escala ninguém definiu é um número que não
significa nada — e numa viagem de influenciador esse número vira print.

---

## O que você precisa fazer

### 1. Aplicar uma migration (30 segundos)

`supabase/migrations/20260907000000_trip_mode.sql`. **Independente das Fases 10
e 11 de propósito** — o release da viagem não pode esperar sete migrations.

Ela faz duas coisas: acrescenta `driver_license` ao tipo de documento (para a
CNH não virar `other` com título livre) e grava o WhatsApp em `app_config`.

Sem ela: o WhatsApp ainda funciona pela variável de ambiente, mas **enviar a
CNH falha** com uma mensagem que diz exatamente isso.

### 2. Cadastrar a viagem no Fly Ops

O app não inventa conteúdo. Para o participante ver algo, precisa existir:

| No Fly Ops                                  | Sem isso                                                            |
| ------------------------------------------- | ------------------------------------------------------------------- |
| A viagem, com destino e datas               | O banner não aparece — a Home mostra "sua viagem ainda não começou" |
| Participantes em `trip_members`             | Ninguém vê nada                                                     |
| Dias e atividades, **com horário**          | Sem alertas e sem próximo compromisso                               |
| `departure_at` nas atividades que têm saída | O alerta usa o início, que é mais tarde do que a saída              |
| `what_to_bring` onde importa                | Não há "leve seu passaporte" — o app não deduz                      |
| Voo, hospedagem e número do quarto          | As telas abrem vazias                                               |
| Passeios publicados                         | "Mais experiências" fica vazia                                      |

### 3. Publicar no preview, não em produção

A branch é isolada. No Vercel, aponte um **preview deployment** para
`release/trip-mode-dubai-2026-09` com as duas variáveis. A produção atual
continua em `main`, sem as variáveis, e não muda.

---

## O que NÃO está provado

Sejamos exatos, porque é véspera de viagem.

| Item                                    | Situação                                  |
| --------------------------------------- | ----------------------------------------- |
| Lógica de alertas, WhatsApp e navegação | ✅ **42 testes**, verde                   |
| Todas as telas em estado deslogado      | ✅ vistas hoje, sem erro de console       |
| Barra de quatro abas                    | ✅ vista, botão central no eixo           |
| **Qualquer tela logada**                | ❌ **nunca vista** — não tenho credencial |
| **Envio de documento de verdade**       | ❌ nunca executado contra o Storage       |
| **O WhatsApp abrindo no celular**       | ❌ nunca testado em aparelho              |
| Build nativo iOS/Android                | ❌ este ambiente não compila              |

**O maior risco é o envio de documento.** É o único código novo que escreve em
Storage, e ele nunca rodou. A policy do bucket já aceitava o dono gravar na
própria pasta desde a Fase 4, e o caminho segue o mesmo formato das notas
fiscais, que funcionam — mas isso é leitura de código, não execução.

**Teste isto primeiro, com uma conta real:** entrar → Documentos → adicionar
passaporte. Se funcionar, o resto do P0 é tela sobre dado que já existe.

---

## Prioridades atendidas

|     | Item                         | Situação                              |
| --- | ---------------------------- | ------------------------------------- |
| P0  | Login existente              | ✅ intocado                           |
| P0  | Home da viagem               | ✅                                    |
| P0  | Roteiro                      | ✅ reaproveitado                      |
| P0  | Meus passeios e vouchers     | ✅ reaproveitados                     |
| P0  | Passaporte e CNH             | ✅ **novo** — envio, troca e abertura |
| P0  | Voo, hotel, número do quarto | ✅ reaproveitados                     |
| P0  | WhatsApp / suporte           | ✅ **novo**                           |
| P1  | Galeria                      | ✅ virou aba                          |
| P1  | Alertas do roteiro           | ✅ **novo**, sem push                 |
| P1  | Mais experiências            | ✅ **novo**                           |
| P2  | Push, checkout, chat próprio | ⬜ fora, como combinado               |
