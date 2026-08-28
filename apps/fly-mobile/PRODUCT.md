# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

**O cliente da Fly** — quem contratou uma viagem e a está vivendo. Usa o app
antes, durante e depois: no sofá planejando, e principalmente **em pé, na rua,
com uma mão só**, entre um compromisso e outro do roteiro. Não é um viajante
independente montando itinerário: a Fly monta, e ele acompanha, escolhe extras
e pede ajuda.

**Acompanhantes e família** entram na mesma viagem com acesso próprio. Menores
e responsáveis têm processo próprio, ainda não definido.

Quem **opera** a Fly não usa este app. Escritório e curadoria usam o Fly Ops;
o guia em campo usa o Fly Crew. São aplicações separadas, no mesmo monorepo.

## Product Purpose

Ser o único lugar onde a viagem inteira acontece: roteiro do dia, documentos,
tickets, passeios extras, pagamento, pontos e o caminho para falar com a Fly.

Sucesso é o cliente abrir o app no meio da rua em Dubai e saber, em segundos, o
que vem agora e para onde ir — e, quando algo dá errado, alcançar uma pessoa
sem procurar.

## Positioning

**Acesso é por convite.** Não existe cadastro aberto, nem no app nem em
produção. Quem entra foi convidado por alguém da Fly, e essa é uma restrição de
produto, não uma etapa de onboarding a ser otimizada.

O que um concorrente não copia sem ter a operação: **o conteúdo crítico nunca é
codificado no app**. Roteiro, catálogo, eventos, horários e preços saem do Fly
Ops e chegam ao cliente sem nova versão na loja. Isso é o que permite a Fly
mudar o ponto de encontro às 6h da manhã e o cliente ver às 6h01.

Não é uma OTA. A Fly não vende viagem avulsa para quem chegou de um anúncio;
ela opera a viagem de quem já é cliente.

## Operating Context

- **Destino atual: Dubai.** O modelo é multi-destino (`destinations` é tabela),
  mas o piloto e o conteúdo são de Dubai, no fuso `Asia/Dubai`.
- A viagem tem **dias numerados** (dia 3 de 7), e o app se comporta de forma
  diferente em quatro estados que o **servidor** decide: sem viagem, pré-viagem,
  durante e pós-viagem. O aparelho nunca calcula isso — celular com data errada
  mostraria outro número.
- Uso em movimento, conexão instável, sol forte, uma mão.
- O cliente compra extras **dentro** da viagem: passeios com vaga, horário e
  reserva temporária no carrinho.
- Documento sensível (passaporte) é digitado pelo cliente, não fotografado.

## Capabilities and Constraints

**Existe e funciona:** convite e ativação, onboarding em cinco etapas, perfil
com QR pessoal, consentimento por finalidade, Home por estado, eventos,
notificações, Minha Viagem (roteiro, inclusões, voos com Modo Aeroporto, hotel,
transfers, cofre, QR, presença), e Passeios completo (catálogo, busca, filtros,
carrinho com reserva, pedido, participantes, reembolso).

**Não existe ainda:** Carteira e fidelidade, refeições, mapa e SOS de verdade,
álbum e gamificação. As telas dizem isso em vez de fingir.

**Restrições que não se negociam:**

- Papel do usuário vive em tabela protegida, nunca em metadado editável.
- Preço, saldo, disponibilidade e vencedor nunca são decididos no cliente.
- Documento sensível fica em Storage privado, com URL assinada de 60 s e
  registro de quem abriu.
- Toda tela trata carregando, vazio, erro, permissão negada e offline.
- Integração externa só é declarada real com credencial, contrato e teste.

**O que nunca se inventa** (regra do projeto, não estilo): fórmula e validade de
pontos, critérios de ranking, prêmios, horário de roteiro, prazo de refeição,
preço, câmbio, disponibilidade, política de cancelamento, contato de emergência,
regra de tax-free, dado médico, papel ou permissão, período de retenção,
consentimento e texto jurídico. Faltando a regra, o app usa configuração ou
espaço vazio marcado — nunca um palpite.

**Decisões de produto ainda abertas:** provedor de pagamento, fórmula de pontos,
níveis de status e validade, prêmios, provedor de mapa, de clima e de status de
voo, retenção de documento, processo de menores, e os idiomas de lançamento (o
app é português do Brasil hoje).

## Brand Commitments

- **Nome do produto: Fly App.** Decidido em 28/08/2026, fechando uma pendência
  aberta desde 24/08. O wordmark exibido é `FLY` com a asa.
- **Dark-only, por decisão de marca.** Não existe tema claro.
- **Pacote e nível são escalas diferentes, e confundi-los é erro de produto.**
  Standard, Black e Billionaire são o **pacote que o cliente adquiriu**. Basic,
  prime e elite são o **nível de Fly Points**, que se sobe acumulando. Ninguém
  chega a Billionaire juntando ponto.
- O dourado da marca tem **uso contado e fechado**, listado no design. Espalhá-lo
  descaracteriza o produto.
- Voz: direta e adulta, em português do Brasil. O app não promete o que não
  cumpre — a prateleira chama-se "A Fly recomenda", e não "recomendados para
  você", porque não existe algoritmo de recomendação.

## Evidence on Hand

- **Marca:** wordmark e três variantes da asa, em `assets/brand/`.
- **Fotografia:** cinco fotos de Dubai fornecidas pelo cliente, em
  `../../docs/design/fotos/`. São **placeholders de enquadramento**, com direitos
  de imagem a confirmar. Não são material final.
- **Dados de demonstração:** o app está preenchido com uma viagem fictícia
  ("Rafael Mendes", Dubai, dia 3 de 7) para permitir avaliar o desenho.
  Vive em `supabase/seed_demo.sql` e `seed_fase4_demo.sql`, e apagar os dois
  devolve o app ao estado limpo. **Nada disso é dado real.**
- **Não existe, e não deve ser fabricado:** depoimento de cliente, número de
  vendas, benchmark, preço de tabela, parceiro de pagamento, provedor de
  analytics. Preços do catálogo de demonstração foram dados pelo dono como valor
  de teste, não como tabela.

## Product Principles

1. **O operacional vence o comercial.** Quem está viajando precisa saber o que
   vem agora; oferta pode esperar a rolagem.
2. **Espaço vazio é mais honesto que número inventado.** Quando a regra não
   existe, o app mostra o lugar dela e diz que a Fly define — nunca preenche.
3. **O conteúdo crítico vem do painel, nunca do código.** Se mudar exige nova
   versão na loja, está no lugar errado.
4. **Acesso mínimo e auditável.** Ver dado sensível é exceção registrada, não
   consequência de ser funcionário.
5. **A Fly está sempre a um toque.** Nenhum caminho termina em beco: falha de
   integração degrada e mostra o caminho humano.

## Accessibility & Inclusion

Alvo de toque mínimo de 44 pt em todo controle. Safe areas respeitadas pelo
valor real do aparelho, não fixas.

O padrão do projeto era WCAG AA. Em 28/08/2026 o dono escolheu **fidelidade ao
design acima do limiar de contraste** para o texto secundário, que passou a
medir 4,21:1 — abaixo dos 4,5:1 de texto normal. A escolha está registrada e o
contrato de cores diz a verdade sobre o que cada tom aguenta. O resto da paleta
segue AA.

Texto dinâmico é respeitado até 1,6× do tamanho do sistema.
