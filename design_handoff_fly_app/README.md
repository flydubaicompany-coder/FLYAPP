# Handoff: Fly App — Home, Passeios, Meus Passeios, Minha Viagem, Carteira, Perfil

## Overview

Fly é um app de experiências de luxo em Dubai. Este pacote entrega o protótipo mobile
high-fidelity de seis telas e a navegação entre elas: **Início (Home)**, **Passeios**,
**Meus Passeios** (bottom sheet + página), **Minha Viagem**, **Carteira** e **Perfil**.

Toda a interface está em **português do Brasil**. O alvo é iPhone (393 × 852 pt, iPhone 15 Pro),
com safe areas de 59 pt no topo e 34 pt na base respeitadas.

## About the Design Files

Os arquivos deste bundle são **referências de design escritas em HTML** — protótipos que
mostram aparência e comportamento pretendidos, **não código de produção para copiar**.

A tarefa é **recriar estes designs no ambiente já existente do codebase** (React Native,
SwiftUI, Flutter, React web, etc.), usando os padrões, bibliotecas e componentes que o
projeto já tem. Se ainda não existe ambiente, escolha o framework mais adequado
(para um app iOS premium com este nível de material translúcido, SwiftUI é a escolha
natural; React Native + Expo se o alvo for multiplataforma) e implemente lá.

Os arquivos `.dc.html` usam um runtime próprio de prototipagem (`support.js`). **Não
porte esse runtime.** Leia o HTML como especificação: a marcação e os estilos inline
descrevem a hierarquia, as medidas e os estados. `Fly Phone.dc.html` contém as seis
telas; `Fly App.dc.html` é só a prancheta de apresentação que instancia sete aparelhos
lado a lado.

## Fidelity

**High-fidelity (hifi).** Cores, tipografia, espaçamentos, raios, sombras, blurs e
microinterações são finais. Recriar pixel-perfect usando as bibliotecas do codebase.
Onde este documento dá um valor exato, use o valor exato.

Duas ressalvas honestas:

- **Conteúdo é fictício e plausível** — nomes de passeios, eventos, preços, datas, saldos
  e nomes de pessoas. Substituir por dados reais da API.
- **Fotografia**: cinco fotos de Dubai fornecidas pelo cliente (`assets/opt-*.jpg`).
  Não são finais para produção; trate como placeholders de enquadramento e peso visual.

---

## Design Tokens

### Cor

| Token             | Hex / valor                 | Uso                                                |
| ----------------- | --------------------------- | -------------------------------------------------- |
| `bg/base`         | `#08080A`                   | fundo de todas as telas                            |
| `bg/elevated`     | `#101013`                   | fundo de card fotográfico antes da imagem carregar |
| `graphite`        | `#16161A`                   | grafite de referência (cartão, materiais)          |
| `text/primary`    | `#F5F5F7`                   | títulos e corpo                                    |
| `text/secondary`  | `rgba(245,245,247,.45)`     | subtítulos, metadados                              |
| `text/tertiary`   | `rgba(245,245,247,.36)`     | rótulos auxiliares                                 |
| `text/quaternary` | `rgba(245,245,247,.28)`     | chevrons, estados desligados                       |
| `gold`            | `#DFC98A`                   | **dourado Fly**                                    |
| `gold/deep`       | `#C9A96B`                   | fim escuro de gradientes dourados                  |
| `amber`           | `#E9A23B`                   | **apenas** alertas e pendências                    |
| `blue/standard`   | `#5B8CFF` (texto `#8FADFF`) | nível Fly Standard                                 |
| `white/pill`      | `#F2F2F5`                   | botão SOS e CTA primário sólido                    |

**Regra do dourado — não violar.** O dourado aparece em exatamente sete lugares:
kicker de evento no banner, selo Exclusivo/Assinatura Fly, chip de categoria e de dia
selecionados, progresso para Billionaire, anel do botão central da tab bar, e detalhes do
cartão Fly Black. Em nenhum outro. É o que separa luxo de cassino.

### Superfícies (materiais)

- **Vidro padrão**: `background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.032))`,
  `border: 1px solid rgba(255,255,255,.085)`, `backdrop-filter: blur(22px) saturate(170%)`.
- **Vidro leve** (linhas de lista, campos): `rgba(255,255,255,.045)` + `1px solid rgba(255,255,255,.07)`.
- **Vidro sobre foto**: `rgba(10,10,13,.4)` + `1px solid rgba(255,255,255,.2)` + `blur(18px) saturate(180%)`.
- **Bottom sheet**: `rgba(19,19,23,.88)` + `blur(48px) saturate(190%)`.
- **Tab bar**: `linear-gradient(180deg, rgba(17,17,20,.7), rgba(9,9,11,.9))` + `blur(36px) saturate(190%)`.
- Todo material translúcido leva uma **linha de luz de 1 px no topo**:
  `inset 0 1px 0 rgba(255,255,255,.09—.14)`. É o detalhe que faz o vidro parecer físico.

### Sombras

- Card fotográfico: `0 24px 46px -24px rgba(0,0,0,.92), 0 0 0 1px rgba(255,255,255,.06)`
- Banner: `0 32px 62px -30px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.07)`
- Botão flutuante (carrinho): `0 16px 36px -8px rgba(0,0,0,.88), inset 0 1px 0 rgba(255,255,255,.1), 0 0 24px rgba(223,201,138,.1)`
- SOS branco: `0 12px 28px -6px rgba(0,0,0,.75), inset 0 -1px 2px rgba(0,0,0,.15)`
- Sheet: `0 -30px 60px -10px rgba(0,0,0,.7)`

### Raio (curvas contínuas, sempre concêntricas)

`34` sheet · `30` card grande / banner · `26` cartão Fly e blocos de perfil ·
`24` bloco de lista e cards de conteúdo · `22` linha interna · `19–20` botão alto ·
`17` chip e pílula · `16` campo de busca · `15–13` ícone-container · `11` badge pequeno.

Regra: quando um elemento arredondado está dentro de outro, o raio interno = raio externo
menos o padding. Nunca dois raios iguais aninhados.

### Tipografia — SF Pro Display / SF Pro Text

| Papel                | Tamanho      | Peso | Tracking            |
| -------------------- | ------------ | ---- | ------------------- |
| Large title          | 33 px        | 700  | −0.038em            |
| Título de banner     | 31 px        | 700  | −0.036em            |
| Saldo / número herói | 29 px        | 700  | −0.036em            |
| Saudação             | 25 px        | 600  | −0.03em             |
| Título de seção      | 20 px        | 600  | −0.028em            |
| Nome em card grande  | 19 px        | 600  | −0.026em            |
| Item de lista        | 15–15.5 px   | 600  | −0.018em            |
| Linha de menu        | 15 px        | 500  | −0.016em            |
| Corpo / metadados    | 12.5–13.5 px | 400  | −0.005 a −0.008em   |
| Caption (kicker)     | 9–10 px      | 700  | **+0.13 a +0.16em** |
| Rótulo de tab        | 9.5 px       | 600  | 0                   |

Números de dinheiro, pontos, horas e datas: `font-variant-numeric: tabular-nums`.
Textos longos: `text-wrap: pretty`.

### Espaçamento

Margem lateral padrão **16 px** para cards, **20 px** para títulos e texto corrido
(o título alinha com o conteúdo do card, não com a borda do card). Gap vertical entre
blocos: 8 / 12 / 16 / 20 / 24 / 28. Toque mínimo 44 × 44 px em todos os controles.

---

## Screens / Views

### 1. Início (Home)

**Propósito:** situar o hóspede em segundos — o que a Fly está promovendo, o que ele
precisa fazer agora, o que está pendente e onde ele está no programa de fidelidade.

**Layout** (topo → base, scroll vertical, `padding-bottom: 122`):

1. **Barra de identidade** — `padding: 10px 20px 0`, `space-between`.
   Wordmark Fly à esquerda com **14 px de altura**, opacidade .95.
   À direita, botão de notificações 38 × 38, raio 19, vidro sobre foto, com ponto dourado
   6 × 6 em `top:8 right:9` e `box-shadow: 0 0 7px rgba(223,201,138,.85)`.
2. **Saudação** — `padding: 12px 20px`. "Boa noite, Rafael" (25/600/−.03em) +
   "Dubai · 32°C · dia 3 de 7" (13.5, `text/secondary`).
3. **Banner carrossel** — `margin: 0 16px`, **altura 340 px**, raio 30.
   Três slides em um track de 300 % com `transform: translateX(-33.333% × index)`,
   transição `.62s cubic-bezier(.32,.9,.28,1)`. Arraste horizontal com pointer events:
   durante o arraste, `transition: none` e offset = `dx` em px; ao soltar, avança se
   `|dx| > 46`. Autoplay a cada **5400 ms**, pausado durante o arraste.
   - Imagem `background-size: cover`, posição por slide (ver Assets).
   - Gradiente de leitura: `linear-gradient(180deg, rgba(4,4,6,.55) 0%, rgba(4,4,6,.04) 30%, rgba(4,4,6,.5) 64%, rgba(4,4,6,.95) 100%)`.
   - Pílula "EVENTOS FLY" em `top:18 left:20`, altura 28, asa dourada de 7 px + label 9.5/700/+.14em.
   - Texto em `left:22 right:22 bottom:66`: kicker dourado 10/700/+.145em (data · local),
     título 31/700/−.036em branco, apoio 13.5 em `rgba(255,255,255,.68)`.
   - Rodapé do banner em `bottom:20`: CTA "Ver detalhes" (altura 34, raio 17, vidro
     `rgba(255,255,255,.13)`, borda `.24`, chevron 12 px) e, à direita, indicador de páginas:
     três traços 18 × 5 raio 3 em `rgba(255,255,255,.26)` + um traço dourado absoluto que
     desliza `translateX(index × 24px)` em `.55s cubic-bezier(.22,1,.36,1)`.
   - Slides: **Fly Cup 2026** (12–14 SET · JUMEIRAH GOLF ESTATES / "72 convidados · 3 dias de torneio"),
     **Legends Dubai Cup** (07–09 NOV · DUBAI SPORTS CITY / "Craques convidados · jantar de gala"),
     **Fly Summit** (26 FEV 2027 · MUSEUM OF THE FUTURE / "Encontro anual Black e Billionaire").
4. **Próxima ação** — `margin: 16px 16px 0`, vidro padrão, raio 24, `padding: 12px 16px`, gap 14.
   Ícone 42 × 42 raio 15 em `rgba(223,201,138,.11)` borda `.26`, glifo de envio dourado 19 px.
   Kicker "PRÓXIMA AÇÃO" dourado 9.5/700/+.15em; título "Check-in Emirates EK262" 15.5/600;
   apoio "Abre em 4h 12min · Terminal 3". Chevron 16 px `text/quaternary`.
5. **Alerta** — `margin: 8px 16px 0`, raio 22, `padding: 11px 16px`,
   `background: rgba(233,162,59,.07)`, borda `rgba(233,162,59,.22)`, triângulo âmbar 19 px.
   "Visto de trânsito pendente" / "Envie o comprovante até 25/08".
6. **Faixa Status + Points** — `margin: 12px 16px 0`, raio 22, vidro
   `linear-gradient(165deg, rgba(255,255,255,.08), rgba(255,255,255,.028))`, duas colunas
   `flex:1` separadas por um fio de **1 px** `rgba(255,255,255,.09)`. Cada coluna:
   `padding: 12px 15px 11px`, kicker 9/700/+.15em, valor 19/700/−.03em, barra de 3 px
   com raio 2 sobre trilho `rgba(255,255,255,.1)`.
   - Esquerda: FLY STATUS · "Black" + "para **Billionaire**" (dourado) · barra 68 %
     `linear-gradient(90deg,#C9A96B,#DFC98A)` com `box-shadow: 0 0 9px rgba(223,201,138,.55)`.
   - Direita: FLY POINTS · "48.250" + "+1.200" (dourado) · barra 41 % `rgba(245,245,247,.55)`.

**Proporção do banner:** 340 px = **48 % da área útil** (entre status bar e tab bar) e 40 %
da tela inteira. Se o requisito for 45 % da tela cheia, remover o alerta de visto **ou** o
Fly Points da Home — não encolher os outros blocos.

### 2. Passeios

1. **Header** — large title "Passeios" 33/700 + botão de filtros 36 × 36 (ícone de dois
   sliders com bolinhas em trilhos).
2. **Barra "Meus Passeios"** — `margin: 20px 16px 0`, vidro padrão, raio 22,
   `padding: 11px 14px 11px 11px`. À esquerda, **pilha de três miniaturas** 36 × 36 raio 12
   sobrepostas com offset de 13 px, cada uma com `box-shadow: 0 0 0 2px #111114` para
   recortar do fundo. Título 15.5/600 + "próximo em 2 dias" 12.5. À direita, contador
   `3` em pílula dourada (min-width 24, altura 24, raio 12, `rgba(223,201,138,.14)`,
   borda `.32`, texto 12.5/700) + chevron. **Abre o bottom sheet.**
3. **Busca** — altura 44, raio 16, `rgba(255,255,255,.055)`, lupa 17 px em
   `rgba(245,245,247,.34)`, placeholder "Buscar experiências em Dubai" 15.
4. **Chips de categoria** — linha com scroll horizontal, `gap: 8`, `padding: 2px 16px 4px`.
   Cada chip: altura 34, raio 17, 13.5/500. Repouso `rgba(255,255,255,.05)` / borda `.075` /
   texto `rgba(245,245,247,.6)`. **Selecionado** `rgba(223,201,138,.15)` / borda
   `rgba(223,201,138,.44)` / texto `#DFC98A`. Transição `.25s` em background, border e color.
   Ordem: Todos · Deserto · Marina & Iates · Aéreo · Cidade & Cultura · Gastronomia ·
   Compras · Parques · Exclusivos Fly.
5. **Trend Passeios** — título 20/600 + "Ver tudo" dourado 13/600. Cards em coluna, `gap: 16`.
   Cada card: **altura 244**, raio 30, foto `cover`, gradiente
   `linear-gradient(180deg, rgba(4,4,6,.42) 0%, rgba(4,4,6,0) 32%, rgba(4,4,6,.6) 68%, rgba(4,4,6,.95) 100%)`.
   - Selo em `top:16 left:16`, altura 26, raio 13. Dourado (`rgba(223,201,138,.15)`, borda `.42`,
     asa dourada 6 px + label) para "EXCLUSIVO FLY" e "ASSINATURA FLY"; branco
     (`rgba(255,255,255,.14)`, borda `.26`) para "MAIS VENDIDO" e "NOVO".
   - Botão **+** em `top:14 right:14`, 34 × 34, raio 17, vidro sobre foto. `scale(.86)` no active.
   - Base em `left:18 right:18 bottom:16`: nome 19/600/−.026em; abaixo, `space-between`
     entre duração (relógio 13 px + texto 12.5 em `rgba(255,255,255,.62)`) e valor 16/600.
   - Conteúdo: **At The Top · Burj Khalifa** (Exclusivo Fly · 2h 30 · R$ 1.240) ·
     **Chá da Tarde no Burj Al Arab** (Assinatura · 2h · R$ 2.450) ·
     **Marina Yacht Sunset · 42 pés** (Assinatura · 3h · R$ 1.680) ·
     **Dubai Frame & Old Dubai** (Mais vendido · 4h · R$ 480) ·
     **Helicóptero sobre Downtown** (Novo · 22 min · R$ 3.180).
6. **Estado vazio de categoria** — quando o chip não tem cards (Deserto, Compras, Parques):
   bloco `padding: 40px 26px`, raio 30, **borda tracejada** `1px dashed rgba(255,255,255,.13)`,
   asa esmaecida 14 px, "Em curadoria", explicação, botão "Avise-me" dourado.

**Botões flutuantes — devem parecer materiais opostos:**

- **Carrinho**, `right: 20 bottom: 102`, 56 × 56, raio 28,
  `linear-gradient(165deg, rgba(40,40,45,.8), rgba(13,13,15,.92))`, borda `rgba(223,201,138,.3)`,
  `blur(28px) saturate(180%)`. Badge dourado em `top:-3 right:-3` (min-width 22, altura 22,
  raio 11, texto `#0A0A0B` 12/800), que **pula para `scale(1.22)` por 380 ms** ao somar.
- **Fly Assist / SOS**, `left: 20 bottom: 104`, 50 × 50, raio 25, **branco sólido `#F2F2F5`**,
  glifo escuro de mira. Anel `1.5px solid rgba(242,242,245,.5)` com pulso infinito de 2.8 s
  (`scale(1) opacity .55` → `scale(1.6) opacity 0`). Abre um painel de 242 px acima dele
  (raio 24, `rgba(22,22,26,.84)`, `blur(34px)`) com três linhas: Ligar para o concierge ·
  Chat com a Fly · **Emergência · 999** (em âmbar).

### 3. Meus Passeios — bottom sheet

Overlay `rgba(0,0,0,.6)` + `blur(4px)`, fade de 300 ms; toque no overlay fecha.
Painel ancorado embaixo, `max-height: 79%`, raio superior 34, `rgba(19,19,23,.88)` +
`blur(48px) saturate(190%)`, entrada `translateY(101%) → 0` em **520 ms
`cubic-bezier(.22,1,.36,1)`**. Handle 38 × 5 centralizado. Cabeçalho com título 20/700 +
"3 confirmados · próximo em 2 dias" e botão de fechar 32 × 32. Lista rolável de três linhas
(miniatura 56 × 56 raio 16, kicker dourado com data e hora, nome 14.5/600). CTA sólido
`#F2F2F5` altura 50 raio 19, texto `#0A0A0B` 15.5/600: **"Abrir Meus Passeios"** → navega
para a página completa.

### 4. Meus Passeios — página

Nav bar iOS com back dourado ("‹ Passeios", 15/500) → volta para Passeios.
Large title + "3 experiências · 2 pessoas · 25 – 29 ago".
**Segmented control**: trilho `rgba(255,255,255,.055)` raio 16 padding 3, dois segmentos
altura 32 raio 13; ativo `rgba(255,255,255,.13)` + borda `.1` + texto `#F5F5F7`,
inativo transparente + `rgba(245,245,247,.45)`. Abas **Confirmados** / **Histórico**.
Linhas: vidro padrão raio 24, miniatura 72 × 72 raio 18, kicker dourado com dia e hora,
nome 15/600, badge de status + "2 pessoas".
Badges: **Confirmado** (ponto branco, vidro branco), **Aguardando guia** (âmbar,
`rgba(233,162,59,.13)` borda `.26`), **Concluído** (cinza; no Histórico a miniatura recebe
`filter: grayscale(.6)` e todo o texto cai um nível de opacidade).
Na tab bar, **Passeios permanece selecionada** nesta tela.

### 5. Minha Viagem

O coração do app — é a tab central. Roteiro dia a dia da viagem em curso.

1. **Card da viagem** — `margin: 20px 16px 0`, altura 196, raio 30, foto do downtown,
   gradiente de leitura. Pílula dourada "VIAGEM EM CURSO" com ponto pulsante.
   "Dubai" 27/700/−.034em · "25 – 31 ago · Atlantis The Royal · 2 pessoas" ·
   barra de 3 px com 43 % dourado + "dia 3 de 7" 11/600.
2. **Seletor de dias** — scroll horizontal, `gap: 8`. Cada dia: 52 px de largura,
   `padding: 9px 0 10px`, raio 19, weekday 9.5/700/+.1em com `opacity:.6` + número
   16.5/700/−.02em. Mesmos tokens de seleção dos chips (dourado).
   Sete dias: SEX 25 … QUI 31.
3. **Título do dia** — "Sexta, 25 de agosto" 20/600 + contagem "4 itens" à direita.
4. **Timeline** — cada item é uma linha `flex` com `gap: 13`: uma coluna de rail de 8 px
   (bolinha 8 × 8 raio 5 + fio de 1.5 px que desce em gradiente) e o conteúdo à direita.
   - Bolinha padrão `rgba(245,245,247,.28)`; **item ativo** dourado com
     `box-shadow: 0 0 12px rgba(223,201,138,.9)` e anel pulsante; item pendente em âmbar.
   - Cabeçalho do item: hora 12.5/700 tabular + status em caption 11/+.08em.
   - Itens simples: nome 15/600 + local 12.5.
   - **Item destacado** (o próximo): card de vidro raio 22 com miniatura 52 × 52 raio 16,
     nome, detalhes, e duas ações lado a lado divididas por fio de 1 px — "Ingressos"
     (dourado) e "Rota" (branco), altura 42 cada.
   - Dias com roteiro: **25** (Café da manhã concluído · Traslado privativo 14:30 ·
     **At The Top 18:30, em 4h 12min** · Jantar CÉ LA VI 21:00), **27** (Traslado 13:30 ·
     Chá da Tarde 15:00 · Souk Madinat 19:00), **29** (Dubai Frame 09:00 aguardando guia ·
     Almoço Al Fanar 13:00 · Dubai Mall 16:00).
   - Dias sem roteiro (26, 28, 30, 31): bloco tracejado "Dia livre" com CTA "Ver Passeios"
     que navega para a aba Passeios.
5. Botão **Fly Assist/SOS** flutuante, idêntico ao de Passeios. **Sem carrinho** nesta tela.

### 6. Carteira

1. Header "Carteira" + botão **+** 36 × 36.
2. **Cartão Fly Black** — `margin: 22px 16px 0` com `padding-top: 9` e uma **borda fantasma**
   atrás (altura 40, raio 24, `rgba(255,255,255,.055)`) sugerindo uma pilha de cartões.
   O cartão: altura 202, raio 26,
   `radial-gradient(128% 128% at 82% 6%, #32323A 0%, #191920 44%, #0B0B0E 100%)`,
   borda `rgba(223,201,138,.26)`, `inset 0 1px 0 rgba(255,255,255,.11)`.
   Brilho dourado: círculo de 196 px em `top:-56 right:-46` com
   `radial-gradient(circle, rgba(223,201,138,.16), transparent 70%)`.
   Asa dourada 13 px em cima à esquerda; pílula "BLACK" à direita.
   Chip 38 × 28 raio 7 `linear-gradient(135deg, rgba(223,201,138,.62), rgba(201,169,107,.32))`.
   Base: "SALDO DISPONÍVEL" (kicker dourado) · **R$ 8.420,00** 29/700 ·
   "RAFAEL MENDES" 12/600/+.06em e "•••• 4102" tabular.
3. **Três ações rápidas** — grid de 3, raio 22, `padding: 14px 6px 13px`, ícone 19 px acima
   do label 12/600: Adicionar · Transferir · Extrato. `scale(.96)` no active.
4. **Faixa Fly Points** — raio 24, `linear-gradient(180deg, rgba(223,201,138,.09), rgba(223,201,138,.035))`,
   borda `rgba(223,201,138,.22)`. "48.250" 20/700 + "≈ R$ 2.412" + botão **Resgatar** dourado.
5. **Movimentações** — bloco raio 24 com quatro linhas e divisores de 1 px recuados 65 px
   (alinhados ao texto, não ao ícone). Cada linha: ícone 36 × 36 raio 13, nome 14.5/600,
   contexto 12, valor 14.5/600 tabular à direita. Crédito em dourado, débito em branco
   com sinal `−`. Itens: At The Top −R$ 1.240 · Cashback Fly Points +2.480 pts ·
   Marina Yacht Sunset −R$ 1.680 · Recarga da carteira +R$ 5.000.

### 7. Perfil

1. Header "Perfil" + botão de engrenagem.
2. **Cartão de identidade** — vidro raio 26, `padding: 16`. Avatar 66 × 66 raio 33 com
   `radial-gradient(118% 118% at 30% 12%, #3A3A42, #1A1A20 60%, #0D0D10)`, borda
   `rgba(223,201,138,.34)`, monograma "RM" 22/600. **Não há foto de perfil no bundle** —
   se o app tiver avatar, trocar por imagem e manter o anel dourado.
   Nome 20/600, e-mail 12.5, badge "FLY BLACK".
3. **Fly Status (três níveis)** — bloco raio 26. Trilho de 3 px com preenchimento 68 %
   `linear-gradient(90deg, #5B8CFF, #C9A96B 52%, #DFC98A)`; três marcadores de 10 px com
   `box-shadow: 0 0 0 2px #0E0E11` para recortar do fundo: Standard azul (início),
   Black branco brilhante (meio, atual), Billionaire dourado a 30 % de opacidade (fim).
   Rótulos abaixo, 11 px, com o atual em peso 700. Nota final: "Faltam **8.400 pontos**
   para Billionaire — concierge dedicado e acesso antecipado aos eventos Fly."
4. **Grupos de lista** (padrão iOS inset grouped, raio 24, divisores recuados 48 px):
   - **CONTA** — Dados pessoais · Documentos e visto (com ponto âmbar de pendência) ·
     Formas de pagamento (valor "2").
   - **PREFERÊNCIAS** — Notificações (**toggle funcional**) · Idioma ("Português") ·
     Fly Assist ("24h", ícone dourado).
   - Toggle: 48 × 29 raio 15; ligado `rgba(223,201,138,.85)` com knob em `left: 21px`,
     desligado `rgba(255,255,255,.16)` com knob em `left: 2.5px`; knob 24 × 24 branco;
     transição `.28s cubic-bezier(.32,.9,.28,1)`.
5. "Sair da conta" — botão largo neutro, texto `rgba(245,245,247,.6)`.
6. Rodapé: asa esmaecida 9 px + "Fly App 1.0.0 (24)" em `rgba(245,245,247,.24)`.

---

## Tab bar (todas as telas)

Altura total **86 px**, fixa na base, `z-index` acima do conteúdo.
Material: `linear-gradient(180deg, rgba(17,17,20,.7), rgba(9,9,11,.9))`,
`blur(36px) saturate(190%)`, `inset 0 1px 0 rgba(255,255,255,.09)`,
`0 -22px 44px -22px rgba(0,0,0,.85)`.
Grid de **5 colunas iguais**, faixa de ícones com 56 px de altura e `padding-top: 9`.
Ícone 23 px, label 9.5/600, `gap: 5`. Ativo `#F5F5F7`, inativo `rgba(245,245,247,.4)`,
transição de cor `.25s`. Home indicator 140 × 5 raio 3 em `bottom: 9`.

Ordem: **Início · Passeios · Minha Viagem · Carteira · Perfil**.

**Minha Viagem — botão circular central elevado.** 62 × 62, raio 31, ancorado em
`top: -30px` da faixa de ícones (metade fora da barra).
`background: radial-gradient(118% 118% at 50% 0%, #2E2E34 0%, #16161A 56%, #0B0B0D 100%)`.
Borda `rgba(223,201,138,.28)` em repouso → **`rgba(223,201,138,.75)` quando selecionado**
(transição `.35s`). Sombras, na ordem:
`0 0 0 6px rgba(9,9,11,.94)` (o recorte que o separa da barra) ·
`0 14px 32px -6px rgba(0,0,0,.9)` · `inset 0 1px 0 rgba(255,255,255,.12)` ·
`0 0 26px rgba(223,201,138,.13)` (o brilho dourado sutil).
Dentro, a asa Fly dourada de 30 px com `drop-shadow(0 0 7px rgba(223,201,138,.4))`,
opacidade .72 → 1 quando selecionado. Label "Minha Viagem" 9.5/600 em `top: 37px`.

---

## Interactions & Behavior

| Gatilho                         | Comportamento                                        |
| ------------------------------- | ---------------------------------------------------- |
| Toque em aba                    | Troca de tela; fecha sheet e painel SOS              |
| Toque em "Meus Passeios"        | Abre o bottom sheet (rise 520 ms)                    |
| "Abrir Meus Passeios" / overlay | Navega para a página / fecha o sheet                 |
| Back "‹ Passeios"               | Volta para Passeios                                  |
| Arraste no banner               | Segue o dedo; solta e avança se `                    | dx  | > 46 px` |
| Autoplay do banner              | 5400 ms, pausa durante o arraste                     |
| Toque em chip                   | Filtra os cards; sem card → estado "Em curadoria"    |
| Toque em dia                    | Troca o roteiro; dias sem itens → "Dia livre"        |
| Botão **+** no card             | +1 no carrinho, badge pula 380 ms, toast por 2800 ms |
| Toque no carrinho               | Reexibe o toast                                      |
| Toque no SOS                    | Alterna o painel (pop 340 ms)                        |
| Segmented / toggle              | Troca de estado com transição de 250–280 ms          |
| Press em qualquer botão         | `scale(.86–.99)` conforme o tamanho, `.18–.2s`       |

**Curvas de animação — usar só estas três:**
`cubic-bezier(.22,1,.36,1)` para entradas e revelações ·
`cubic-bezier(.32,.9,.28,1)` para movimento contínuo (carrossel, knob) ·
`cubic-bezier(.34,1.56,.64,1)` só no pulo do badge do carrinho.

**Toast** — `left/right: 20`, `bottom: 172`, raio 20, `rgba(22,22,26,.86)` + `blur(32px)`,
ícone de carrinho dourado + "N experiências no carrinho" + ação "Ver" dourada.
Singular quando N = 1.

## State Management

```
screen   : 'home' | 'passeios' | 'meus' | 'viagem' | 'carteira' | 'perfil'
sheet    : boolean                  // bottom sheet de Meus Passeios
slide    : 0 | 1 | 2                // banner
dx, dragging                        // gesto do banner
chip     : categoria selecionada    // default 'Todos'
day      : '25'…'31'                // default '25'
cart     : number                   // default 2
pop      : boolean                  // 380 ms após somar
toast    : boolean                  // 2800 ms
sos      : boolean
seg      : 'conf' | 'hist'
notif    : boolean                  // default true
```

Mapa categoria → passeios: At The Top {Cidade & Cultura, Exclusivos Fly} ·
Chá da Tarde {Gastronomia, Exclusivos Fly} · Marina Yacht {Marina & Iates, Exclusivos Fly} ·
Dubai Frame {Cidade & Cultura} · Helicóptero {Aéreo}. "Todos" mostra tudo.

Sem data fetching no protótipo. Em produção: viagem atual + roteiro por dia, catálogo de
passeios com categorias, reservas do usuário, saldo e extrato, perfil e nível de fidelidade.

## Assets

Em `assets/`. Marca fornecida pelo cliente; fotos fornecidas pelo cliente (banco de imagens),
redimensionadas para 1170 px no lado longo e JPEG 84.

| Arquivo                       | Conteúdo                      | Enquadramento usado                    |
| ----------------------------- | ----------------------------- | -------------------------------------- |
| `fly-wordmark.png`            | wordmark "FLY" branco com asa | 14 px de altura na Home, 22 px na capa |
| `fly-wing.png`                | asa isolada, branca           | base para as variantes                 |
| `fly-wing-gold.png`           | asa em `#DFC98A`              | selos, cartão, botão central, timeline |
| `fly-wing-dim.png`            | asa em `rgba(245,245,247,.5)` | estados vazios e rodapé                |
| `opt-burj-khalifa-noite.jpg`  | Burj Khalifa à noite          | banner `52% 34%`, card `52% 26%`       |
| `opt-downtown-crepusculo.jpg` | Downtown ao crepúsculo        | banner `56% 42%`, viagem `56% 38%`     |
| `opt-burj-al-arab-mar.jpg`    | Burj Al Arab sobre o mar      | `44–46% 44–46%`                        |
| `opt-burj-al-arab-praia.jpg`  | Burj Al Arab da praia         | `50% 76%`                              |
| `opt-dubai-frame.jpg`         | Dubai Frame                   | `50% 40%`                              |

**Não há geração de imagem neste pacote.** Para produção, encomendar fotografia
cinematográfica real de Dubai nos mesmos enquadramentos.

Ícones: todos desenhados como SVG de traço, `stroke-width` **1.6–1.8** para ícones de 17–23 px
e **2.2** para chevrons, `stroke-linecap: round`, `stroke-linejoin: round`. Substituir por SF
Symbols equivalentes em SwiftUI (`house`, `location`, `creditcard`, `person`, `bell`,
`cart`, `dot.scope`, `clock`) mantendo peso e tamanho.

## Files

| Arquivo             | O que é                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Fly Phone.dc.html` | **A especificação.** As seis telas, a tab bar, o sheet, os flutuantes e toda a lógica de estado. Abrir no navegador para interagir.     |
| `Fly App.dc.html`   | Prancheta de apresentação: sete aparelhos lado a lado (Home, Passeios, sheet, página, Carteira, Perfil, Minha Viagem) + tokens e notas. |
| `support.js`        | Runtime do protótipo. **Não portar.**                                                                                                   |
| `assets/`           | Marca e fotografia.                                                                                                                     |

Abrir `Fly App.dc.html` para ver tudo de uma vez; abrir `Fly Phone.dc.html` para
testar uma tela em tamanho real.

## Escopo não desenhado

Detalhe do passeio, carrinho e checkout · extrato completo e resgate de pontos ·
mapa ao vivo e rota do motorista em Minha Viagem · edição de dados pessoais ·
upload de documentos · onboarding e login · estados de erro e offline · dark/light
(o app é dark-only por decisão de marca).
