# Trip Mode — onde parei e como continuar

Para uma sessão nova pegar sem reler conversa. Atualizado em **07/09/2026**.

|                  |                                           |
| ---------------- | ----------------------------------------- |
| Branch           | `release/trip-mode-dubai-2026-09`         |
| Commit           | `36c6548`                                 |
| No GitHub        | sim, a branch está publicada              |
| `npm run verify` | ✅ 478 testes                             |
| `main`           | intocada — o Fly App completo continua lá |

```bash
cd /Users/psg.vito/Downloads/FLY/fly-ecosystem
npm run dev:mobile        # Expo em http://localhost:8081
```

O `.env.local` do app já tem `EXPO_PUBLIC_FLY_TRIP_MODE=true`. Sem essa
variável, o build é o Fly App completo de sempre.

---

## A regra número um

**O arquivo `/Users/psg.vito/Downloads/Fly Trip Mode.dc.html` é a
especificação, não um resumo.** São 508 blocos de `style=` com o valor exato de
cada elemento. Leia dele, não da memória — o ESTADO já registra que confundir
handoff com prosa custou um redesenho inteiro em agosto.

Os valores extraídos estão em `apps/fly-mobile/src/trip/design.ts`: cores,
raios, tipografia (com o `letter-spacing` já convertido de `em` para pontos) e
sombras. **Use esse arquivo**; não redigite hex.

---

## Pronto e rodando

| Tela                                                                    | Arquivo                                                   | Rota                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| Casca (barra de 5 destinos, Carteira com cadeado, véu)                  | `trip/TripChrome.tsx`                                     | raiz, via `trip/CascaDaViagem.tsx` |
| Home (banner, alertas, próximo, seu dia, fita de experiências, atalhos) | `trip/TripHome.tsx` + `TripHomeBlocos.tsx`                | `/`                                |
| Roteiro (chips de dia + timeline)                                       | `trip/TripRoteiro.tsx`                                    | `/viagem/roteiro`                  |
| Minha Viagem (hotel, quarto 38px, voo, atalhos)                         | `trip/TripMinhaViagem.tsx`                                | `/viagem`                          |
| Voo (cartão de rota, e-ticket, retorno)                                 | `trip/TripVoo.tsx`                                        | `/viagem/voos`                     |
| Voucher (recorte de bilhete + QR)                                       | `app/voucher/[pedido].tsx`                                | `/voucher/:pedido`                 |
| Documentos (passaporte com MRZ e brilho, CNH)                           | `app/viagem/documentos.tsx` + `trip/CartaoPassaporte.tsx` | `/viagem/documentos`               |
| Mais experiências                                                       | `app/experiencias.tsx`                                    | `/experiencias`                    |
| Carteira bloqueada                                                      | `trip/TripCarteiraBloqueada.tsx`                          | `/carteira`                        |
| Perfil                                                                  | `trip/TripPerfil.tsx`                                     | `/perfil`                          |

Lógica pura com teste: `whatsapp.ts` (10), `alertas.ts` (13), `mrz.ts` (12).

---

## O que falta, na ordem que eu faria

1. **Login** — foto `opt-burj-khalifa-noite.jpg` em tela cheia com `flyZoom`
   (14s, `scale 1.12 → 1`), chip de vidro "DUBAI · SET 2026", título 34px
   "Sua viagem começa aqui.", botão dourado 54px. Linhas 39–61 do arquivo.
2. **Galeria + lightbox** — grade de fotos e o visor de tela cheia com
   Compartilhar/Salvar. Linhas 638–652 e 863–890.
3. **As duas animações da Home** — o brilho de 4,6s que atravessa o cartão de
   próximo compromisso (`flyShine`) e o pulso de 2,4s no ícone (`flyPulse`).
   O padrão já está escrito em `CartaoPassaporte.tsx`: `Animated.loop` com
   **reset explícito** e respeito a "reduzir movimento".
4. **Passeios** (linhas 317–357) e **Cadastro** (62–109).

---

## Como ligar uma tela nova ao Trip Mode

Sempre o mesmo padrão, e ele preserva a tela completa:

```tsx
export default function Nome() {
  if (emModoViagem()) return <TripNome />;
  return <NomeCompleto />; // a tela original, intacta
}
```

A casca (`CascaDaViagem`) já é desenhada na **raiz**, então qualquer rota
ganha a barra e a boia sem fazer nada. Deixe `casca.respiroInferior` (124) de
padding no fim da tela, ou a barra cobre o último item.

---

## Armadilhas que já custaram tempo aqui

| Sintoma                                       | Causa                                                                              | O que fazer                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| SVG existe, tem tamanho, e não aparece        | `fill` no `<Svg>` não desce para o `<Path>` no react-native-svg web                | Ponha `fill` no `Path`                                                                  |
| Ícone some sob o próprio fundo                | Filho `position:absolute` pinta **acima** de irmão estático no RN Web              | Faça o `LinearGradient` **envolver** o conteúdo, não ficar atrás por `absoluteFill`     |
| Foto estourada e esticada                     | `ImageBackground` desenha no tamanho natural                                       | `<Image>` com `resizeMode="cover"` e width/height 100%                                  |
| `fontWeight: '650'` não compila               | RN só aceita centenas                                                              | Já resolvido em `design.ts`: 650 → 600 (onde o arquivo quer peso cheio ele escreve 700) |
| Erro no console que persiste após corrigir    | Módulo velho no cache do Metro                                                     | Confira em **aba nova**; o console acumula erros do bundle anterior                     |
| Tela inteira em branco                        | `in('kind', [...])` com valor de enum que o banco ainda não tem derruba a consulta | Filtre em memória                                                                       |
| `Animated.loop` para depois da primeira volta | Falta o reset                                                                      | `Animated.sequence([timing, timing(0, duration 0)])`                                    |

---

## O que NÃO inventar (e o que eu já não inventei)

A §33 da spec vale aqui inteira. Casos concretos desta branch:

- **MRZ do passaporte**: calculada de `mrz.ts`, com dígito verificador da norma
  ICAO 9303. Campo que o projeto não guarda vira `<`. O sexo é o caso — não há
  coluna, e a norma reserva o preenchimento para isso. **Não escreva `M`.**
- **Voo**: o desenho pede LOCALIZADOR e CLASSE; o schema não tem nenhum dos
  dois. A grade mostra assento, terminal e bagagem, que são reais.
- **Carteira bloqueada**: o desenho traz `•••• 4821` e `FASE 2 · OUT 2026`.
  Número de cartão, mesmo borrado, é artefato financeiro fabricado; a data é
  promessa de cronograma. A data só aparece se alguém escrever em
  `app_config['wallet.release_note']`.
- **Voucher**: o QR carrega a **referência do pedido**, e não um código de
  formato próprio — é o que o leitor do Fly Ops já sabe ler.

---

## O que depende do dono, e trava

1. **A migration `20260907000000_trip_mode.sql` não está aplicada.** Ela cria o
   tipo `driver_license` e grava o WhatsApp em `app_config`. Sem ela, **enviar
   a CNH falha** com uma mensagem que diz exatamente isso.
   ```bash
   ./node_modules/.bin/supabase login && ./node_modules/.bin/supabase db push
   ```
   Alternativa sem CLI: colar `docs/handoff/fases-10-e-11-migrations.sql` mais
   o arquivo acima no SQL Editor.
2. **O preview da Vercel está protegido por login** (HTTP 302). Para os
   influenciadores abrirem: _Project Settings → Deployment Protection → Vercel
   Authentication → Disabled_, no projeto `flyapp-cliente`.
3. **A viagem precisa estar cadastrada no Fly Ops** com dias, atividades **com
   horário**, `departure_at`, `what_to_bring`, voo, hospedagem e número do
   quarto. O app não inventa conteúdo: sem isso, as telas abrem vazias — e
   estão certas ao fazê-lo.
4. **Nada foi visto em aparelho.** O envio de documento é o único código novo
   que escreve em Storage e **nunca rodou**. É o que eu testaria primeiro.

---

## Estado da esteira

A CI rodou pela primeira vez desde 27/08. O job **"Lint, tipos, testes e
build" está verde**. O job **"Migrations e RLS" ainda falha**: 55 asserções de
604, em 10 arquivos.

Parte é consequência da Fase 11 (D232 tirou o GRANT de escrita de `app_config`,
e testes antigos esperavam "a RLS filtra em silêncio" — agora o Postgres recusa
antes, lançando). Parte é anterior e nunca tinha sido vista: `refeicoes` falha
14 de 14, `carteira` 23 de 41.

**Nada disso bloqueia o Trip Mode** — o app tem seus 478 testes no job que
passou. Mas é a próxima dívida a pagar depois da viagem.
