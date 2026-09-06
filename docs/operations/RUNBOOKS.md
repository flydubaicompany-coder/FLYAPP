# Runbooks da operação

Entrega 12 da Fase 11 (§46). Escrito em 06/09/2026.

O runbook de infraestrutura é o [FLY_OPS_RUNBOOK](FLY_OPS_RUNBOOK.md): subir o
ambiente, banco, health, diagnóstico. Este aqui é outro assunto — é o que a
**equipe de operação** faz, na ordem em que faz, quando algo acontece.

Cada procedimento diz três coisas: **quem pode**, **onde**, e **o que fica
registrado**. A terceira existe porque toda ação desta fase deixa rastro, e
saber disso antes é diferente de descobrir depois.

> **Nada aqui inventa prazo, valor ou política.** Onde falta uma regra, o
> runbook diz que falta e aponta a pendência. Um runbook que preenche a lacuna
> com um número plausível vira a fonte da regra errada.

---

## 1. Alguém novo entra na equipe

**Quem pode:** administração (papel) e gerência de viagem (atribuição).
**Onde:** Fly Ops → Plataforma → Equipe.

1. A pessoa precisa ter conta. Conta vem de convite aceito — não há como criar
   pessoa pelo painel, e é assim de propósito.
2. **Conceda o papel.** Papel diz o que a pessoa faz.
3. **Atribua à viagem.** Atribuição diz onde. Sem ela, um guia não enxerga
   viagem nenhuma — a RLS decide por atribuição, não por papel.
4. **Escale o turno**, se ela for trabalhar hoje.

**Fica registrado:** `papel.concedido` e `atribuicao.criada` em Auditoria, com
quem concedeu.

**Se der errado:** "Conceda o papel antes de atribuir à viagem" significa que
o passo 2 não aconteceu. A ordem importa, e o servidor recusa a inversão.

---

## 2. Alguém sai da equipe

1. **Revogue a atribuição** primeiro. Ela é o que dá acesso aos dados da
   viagem; tirá-la fecha a porta imediatamente.
2. **Revogue o papel** em seguida.
3. Se a pessoa estava com casos abertos, devolva-os à fila em Atendimento antes
   — caso sem dono aparece no painel Hoje; caso com dono que saiu, não.

**O último admin não sai.** O servidor recusa, e a mensagem diz o que fazer:
conceder o papel a outra pessoa antes. Não há como contornar pelo painel, e a
trava existe justamente para isso.

---

## 3. Mudou o horário de uma atividade

1. Fly Ops → Viagens → corrija a atividade.
2. Fly Ops → Operação → **Avisos** → categoria **crítica** (Alertas da viagem).
3. Confira o número: a tela diz quantos receberam e quantos silenciaram. Em
   categoria crítica, silenciados é sempre zero — a §26 não deixa silenciar.
4. Se for hoje, avise também pelo Fly Crew a quem está em campo.

**Fica registrado:** `aviso.enviado`, com a categoria e as contagens.

---

## 4. Chegou um SOS

1. Fly Ops → Operação → **Atendimento**, ou Fly Crew → **Casos**.
2. **Assuma o caso.** Assumir é diferente de ver: o painel Hoje conta "casos
   sem dono", e um caso que todo mundo está lendo e ninguém assumiu conta como
   sem dono — corretamente.
3. Abra a **ficha do hóspede** (Pessoas → Clientes → a pessoa): contato de
   emergência, alergias e restrições estão lá, no topo.
4. Se a pessoa mandou localização, ela aparece no caso, com hora.
5. Se precisar escalar, o motivo é obrigatório — o próximo precisa saber o que
   já foi tentado.

**O prazo de aceite e de resposta não existe** (`support.sla_minutes` está
`PENDENTE`, P20). O relatório de suporte mostra os tempos medidos e **não** diz
"dentro do prazo": não há prazo declarado para comparar.

---

## 5. Um pedido não fecha

1. Fly Ops → Plataforma → **Relatórios** → Comércio.
2. A coluna **divergência** é o total dos pedidos menos o capturado mais o
   estornado. Zero é o esperado.
3. Abaixo da tabela, a lista dos pedidos que não fecham, um a um.
4. Em Comércio → Pedidos, cada pedido mostra as tentativas de pagamento e diz,
   em vermelho, quando não bate.

**Não corrija o valor do pedido.** O pedido registra o que foi vendido; o
pagamento registra o que entrou. Se discordam, o problema está num dos dois, e
igualar os números esconde qual.

---

## 6. Trocar de turno

**Onde:** Fly Crew → **Turno** (no campo) ou Fly Ops → Plataforma → Equipe.

1. Escreva **o que aconteceu** e **o que ficou aberto**. Os dois campos são
   diferentes: o primeiro é contexto, o segundo é trabalho.
2. Quem entra **assume**. Enquanto ninguém assumir, a passagem aparece no
   painel Hoje como pendência.
3. Nomear sucessor não impede outra pessoa de assumir. Quem assumiu de fato é
   quem fica registrado.

---

## 7. Entregar press kit, brinde ou recompensa

**Onde:** Fly Crew → Turno (na hora) ou Fly Ops → Experiência → Inventário.

1. Registre **na hora da entrega**. Anotar depois, de memória, é o começo de um
   estoque que não bate.
2. Entregar mais do que existe é recusado. Se o número do sistema estiver
   errado, use **ajuste** com a observação do que foi contado.
3. O movimento não se edita. Errou? Lance o ajuste contrário — a correção fica
   visível, que é o ponto.

---

## 8. Mudar uma configuração ou ligar uma função

**Quem pode:** administração. Sobrepor flag numa viagem: gerência.
**Onde:** Fly Ops → Plataforma → Configuração.

1. O valor é **JSON**. Texto vai entre aspas: `"PENDENTE"`.
2. Para ligar uma função só numa viagem, use **sobrepor**. Ausência de
   sobreposição significa "vale a global", e não "desligada".
3. Toda mudança grava o valor **anterior** na trilha.

**As chaves em `"PENDENTE"`** aparecem no topo da tela. São as regras que só o
dono do produto decide (§33). Preenchê-las com um número plausível para
"destravar" é o erro que este projeto inteiro evita.

---

## 9. Exportar dado

**Onde:** Relatórios e Auditoria, botão **Exportar CSV**.

A exportação é registrada antes do arquivo sair: relatório, escopo, número de
linhas, quem. Se o registro falhar, o arquivo não é gerado.

**Isto não é um porteiro.** Quem exporta já leu as linhas na tela, e quem
decidiu que podia ler foi a RLS. O registro serve para depois: transforma
"alguém baixou a base de clientes" de suposição em fato datado.

---

## 10. Investigar "quem fez isso?"

**Onde:** Fly Ops → Plataforma → Auditoria.

Quatro trilhas, e cada uma responde uma pergunta diferente:

| Aba        | Responde                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Trilha     | Quem mudou papel, config, flag, estoque; quem enviou aviso; quem exportou                                 |
| QR         | Quem leu qual código, **inclusive as recusas** — sequência de recusas é bilhete circulando                |
| Cofre      | Quem abriu documento de quem, e por qual permissão                                                        |
| Assistente | Gasto por conversa e **ferramentas recusadas** — sequência de recusas é tentativa de alcançar dado alheio |

A trilha é append-only. Não há edição nem exclusão, nem para a administração —
e a ausência dessas policies é o controle, não um esquecimento.

---

## Treinamento — a ordem para aprender

Uma pessoa nova na operação consegue trabalhar depois destes seis passos, nesta
ordem. Cada um leva minutos e usa a tela de verdade.

1. **Hoje.** Onde o dia começa. O que está esperando alguém vem antes do
   roteiro, e é assim de propósito.
2. **Busca.** Nome, Fly ID, número de pedido, assunto de caso. É o caminho mais
   curto para qualquer coisa.
3. **Ficha do hóspede.** Alergia, contato de emergência, consentimento,
   histórico. É a tela que se abre antes de falar com alguém.
4. **Atendimento.** Assumir, responder, escalar, resolver.
5. **Avisos.** Como se fala com quem está viajando, e por que o número de
   silenciados aparece.
6. **Auditoria.** Que tudo que você faz fica registrado — inclusive o que você
   lê. Aprender isso no primeiro dia é diferente de descobrir no terceiro mês.

**O que a operação não decide, e precisa pedir:** prazo de atendimento (P20),
valor do Fly Point, catálogo de benefícios (P45), critério de ranking (P46),
regra de tax-free (P47), teto de encantamento (P51). Estão em
[`DECISION_LOG`](../architecture/DECISION_LOG.md), e enquanto estiverem lá as
telas dizem "a definir" em vez de mostrar número inventado.
