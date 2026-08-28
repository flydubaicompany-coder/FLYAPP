# Como usar este pacote com o Claude Code

## Passo 1 — coloque a pasta dentro do seu projeto

Descompacte `design_handoff_fly_app` na **raiz do repositório** do app. Deve ficar assim:

```
meu-app/
├── src/            (ou app/, lib/, o que você já tem)
├── package.json
└── design_handoff_fly_app/     ← a pasta inteira, sem renomear
    ├── README.md
    ├── PROMPT.md
    ├── Fly Phone.dc.html
    ├── Fly App.dc.html
    ├── support.js
    └── assets/
```

O Claude Code lê arquivos do repositório onde ele está rodando. Se a pasta ficar fora,
ele não acha.

## Passo 2 — abra o Claude Code na raiz do projeto

No terminal, dentro de `meu-app/`:

```
claude
```

## Passo 3 — antes de tudo, abra os arquivos no navegador (você, não ele)

Dê dois cliques em `design_handoff_fly_app/Fly App.dc.html`. Você vai ver as 7 telas
lado a lado, interativas. Isso é o alvo. Serve para você conferir o que ele entregar.

## Passo 4 — cole o comando abaixo

Cole **exatamente** o texto entre as linhas. Não resuma, não corte.

---

```
Leia design_handoff_fly_app/README.md inteiro antes de escrever uma linha de código. Ele é a especificação vinculante deste trabalho.

CONTEXTO
design_handoff_fly_app/ contém um protótipo de design de alta fidelidade do Fly App — um app de experiências de luxo em Dubai. Sete telas prontas: Início, Passeios, Meus Passeios (bottom sheet e página), Minha Viagem, Carteira e Perfil. O design está aprovado e é final.

SUA TAREFA
Recriar essas telas neste codebase, usando o framework, as bibliotecas e os padrões que o projeto já tem. Se o projeto ainda não tem tela nenhuma, me pergunte qual stack usar antes de começar.

REGRAS — NÃO NEGOCIÁVEIS

1. README.md manda. Todo valor que ele especifica (cor, raio, sombra, blur, tamanho de fonte, tracking, duração, easing, padding, altura) é exato. Use o valor exato. Não arredonde, não simplifique, não "melhore".

2. Não invente nada visual. Nenhuma cor, fonte, espaçamento, sombra ou componente que não esteja no README. Se você achar que falta um valor, pare e me pergunte em vez de escolher por conta própria.

3. Os arquivos .dc.html são especificação, não código para copiar. Abra-os no navegador para entender comportamento e proporções. Leia o HTML como referência de hierarquia e medidas. Não copie o markup. Não porte support.js — é o runtime do protótipo e não tem nada a ver com o app.

4. A regra do dourado. #DFC98A aparece em exatamente sete lugares, listados no README. Em nenhum outro lugar da interface. Não use dourado em botão comum, em texto de destaque, em ícone de lista, em borda decorativa. Essa restrição é a identidade da marca — quebrá-la destrói o design.

5. Materiais translúcidos são obrigatórios. Cada superfície de vidro tem background, borda de 1px, backdrop-filter com blur E saturate, e uma linha de luz de 1px no topo via inset shadow. Os quatro juntos, sempre. Um sem os outros não parece vidro.

6. Raios concêntricos. Quando um elemento arredondado está dentro de outro, o raio interno é o externo menos o padding. Nunca dois raios iguais aninhados.

7. Três curvas de easing, só essas: cubic-bezier(.22,1,.36,1) para entradas, cubic-bezier(.32,.9,.28,1) para movimento contínuo, cubic-bezier(.34,1.56,.64,1) apenas no pulo do badge do carrinho.

8. Todo o texto da interface em português do Brasil, copiado literalmente do README. Não reescreva, não traduza, não "melhore" a copy.

9. Números (dinheiro, pontos, horas, datas) sempre com tabular-nums.

10. Alvo de toque mínimo 44x44pt em todo controle. Safe areas respeitadas: 59pt no topo, 34pt na base.

COMO TRABALHAR
Uma tela por vez, nesta ordem: tab bar → Início → Passeios → Meus Passeios (sheet e página) → Minha Viagem → Carteira → Perfil.

Comece pela tab bar, porque ela aparece em todas as telas e o botão circular central de Minha Viagem é o elemento mais difícil (62x62, elevado 30pt fora da barra, quatro sombras empilhadas em ordem específica, anel dourado que muda de opacidade quando selecionado). Acerte esse antes de seguir.

Depois de cada tela, pare e me mostre o resultado. Não emende uma na outra sem eu confirmar.

Antes de me entregar cada tela, confira você mesmo:
- Todo valor numérico bate com o README?
- O dourado está apenas nos lugares permitidos?
- Cada superfície de vidro tem os quatro ingredientes?
- Os raios são concêntricos?
- A copy está idêntica?

Se em algum ponto o design do README não couber no que o codebase permite, pare e me explique o conflito. Não improvise uma solução.

PRIMEIRO PASSO
Leia o README, olhe o codebase, e me diga: qual stack você vai usar, quais arquivos vai criar, e qualquer conflito que você já enxerga entre o design e o que o projeto tem hoje. Não escreva código nessa primeira resposta.
```

---

## Passo 5 — o que fazer quando ele errar

Se ele desviar, **não descreva o problema em palavras vagas**. Aponte o valor:

- Ruim: "ficou feio, o cartão está estranho"
- Bom: "o raio do card de Trend está errado. README seção 2, item 5: raio 30, altura 244. Você usou 16 e 200."

Frases que funcionam:

- `Releia design_handoff_fly_app/README.md seção <X> e corrija os valores.`
- `Você usou dourado em <elemento>. Isso viola a regra do dourado. Remova.`
- `Essa superfície não tem os quatro ingredientes do vidro. Faltou <qual>.`
- `Abra design_handoff_fly_app/Fly Phone.dc.html no navegador e compare com o que você fez.`

## Por que ele erra sem isso

O Claude Code sozinho não tem o design na frente dele. Ele infere um visual "razoável"
a partir da descrição — e razoável é sempre mais genérico do que o design real: raios
menores, sombras mais fracas, dourado espalhado, blur sem saturate, copy reescrita.
O README fecha todas essas portas com números. Mas ele só funciona se o Claude Code for
obrigado a ler antes de codar — é isso que a primeira linha do comando faz.
