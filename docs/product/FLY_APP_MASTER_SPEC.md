# FLY APP

## Especificação Mestre do Produto e Plano Integral para Claude Code

**Versão:** 2.0  
**Data:** 23 de agosto de 2026  
**Responsável pela visão:** Victor / Fly  
**Produto:** aplicativo Fly para viagem, relacionamento, concierge e fidelidade  
**Superfícies relacionadas:** Fly Ops, Fly Crew, Fly Cup App e integrações de parceiros  
**Piloto operacional prioritário:** viagem oficial Fly de 10 a 17 de setembro de 2026

---

## 0. Como usar este documento

Este arquivo é a fonte oficial do produto. Ele descreve o aplicativo completo, e não apenas uma prévia visual.

O desenvolvimento deve seguir duas regras ao mesmo tempo:

1. **A visão e a arquitetura precisam considerar o produto inteiro desde o primeiro dia.**
2. **A implementação precisa ser feita em fases verticais, testáveis e publicáveis.**

Isso não significa construir um aplicativo pequeno. Significa construir o aplicativo completo sem entregar ao Claude Code um comando gigante que misture autenticação, pagamentos, SOS, mapas, carteira, pontos, passaporte, tax-free e inteligência artificial de uma só vez.

Cada fase deve terminar com código executável, banco versionado, painel operacional correspondente, testes e validação visual. Nenhuma fase pode destruir ou reescrever de forma impulsiva o que já funciona.

### Arquivos que devem existir no repositório

```text
docs/product/FLY_APP_MASTER_SPEC.md
docs/product/SCREEN_INVENTORY.md
docs/product/BUSINESS_RULES.md
docs/architecture/SYSTEM_OVERVIEW.md
docs/architecture/DATA_MODEL.md
docs/architecture/DECISION_LOG.md
docs/architecture/INTEGRATIONS.md
docs/security/THREAT_MODEL.md
docs/operations/FLY_OPS_RUNBOOK.md
docs/quality/TEST_MATRIX.md
CLAUDE.md
```

O presente conteúdo deve ser copiado para `docs/product/FLY_APP_MASTER_SPEC.md`. O arquivo `CLAUDE.md` deve resumir as regras imutáveis e apontar para esta especificação, sem duplicá-la por inteiro.

---

## 1. Decisão executiva

### O que será construído

O Fly App será o companheiro digital do cliente antes, durante e depois de uma viagem. Ele deve:

- orientar o próximo passo;
- organizar roteiro, voos, hotel, transfers, refeições, documentos e ingressos;
- vender passeios, upgrades e experiências;
- concentrar pontos, benefícios, créditos, recibos e tax-free;
- oferecer concierge, ajuda urgente e SOS;
- transformar a viagem em uma história por meio de capítulos, figurinhas, fotos e vídeos;
- conectar o cliente aos eventos e demais produtos do ecossistema Fly;
- permitir que a equipe opere tudo sem alterar código.

### O que não será feito

O app Fly não vai absorver tabelas, confrontos, inscrições, súmulas e rankings esportivos completos do Fly Cup. O Fly Cup continua sendo outro produto, com propósito próprio.

### Decisão sobre velocidade

O produto inteiro será especificado agora. A implementação será feita em ondas, porque um único prompt para “fazer tudo” cria três problemas:

- o Claude perde contexto e toma decisões contraditórias;
- erros de segurança e regras financeiras ficam escondidos;
- cada nova funcionalidade pode quebrar cinco anteriores.

A forma correta é construir **uma base definitiva e vários cortes verticais de produção**. Não se trata de uma prévia descartável.

---

## 2. Arquitetura do ecossistema Fly

### 2.1 Produtos e superfícies

| Superfície | Público | Responsabilidade |
|---|---|---|
| **Fly App** | Cliente e viajante | Viagem, concierge, passeios, carteira, fidelidade, álbum e relacionamento |
| **Fly Cup App** | Atleta, equipe e fã | Competições, inscrições, CTs, tabelas, desafios, resultados e ranking esportivo |
| **Fly Ops** | Gestores e operação | Painel web para administrar clientes, viagens, conteúdo, comércio, suporte e fidelidade |
| **Fly Crew** | Guias, bases, mídia e experiência | Interface móvel interna para check-in, QR, presença, SOS, insights e tarefas |

Fly Ops e Fly Crew são superfícies internas do mesmo sistema. Não precisam ser divulgadas como aplicativos públicos independentes.

### 2.2 Fly ID

Todos os produtos compartilham uma única identidade, o **Fly ID**.

O Fly ID deve permitir:

- uma conta para Fly App e Fly Cup;
- perfil único;
- login contínuo por deep link ou SSO entre os produtos;
- ledger central de Fly Points;
- benefícios e conquistas compartilháveis;
- papéis diferentes para cliente, atleta, influenciador e funcionário;
- consentimentos específicos por produto.

O mesmo login não significa a mesma interface. Cada produto mantém navegação e objetivo próprios.

### 2.3 Fronteira entre Fly App e Fly Cup

No Fly App, os eventos aparecem na Home e em páginas editoriais. O cliente pode ver data, cidade, atrações, participantes, conteúdo, ingressos e benefícios. Se precisar acompanhar uma competição em detalhes, o CTA abre o Fly Cup por deep link e mantém a sessão do Fly ID.

Eventos que devem ser suportados pelo conteúdo administrável:

- Fly Cup Futevôlei;
- Fly Cup Fut 7;
- Fly Cup Kart;
- Fly Cup Surf;
- Fly Cup Basquete;
- Fly Cup Skate;
- Fly Cup Tênis;
- Fly Cup Paintball;
- Fly Cup Airsoft;
- Legends Dubai Cup / Showbol;
- Fly Summit;
- eventos com artistas e influenciadores;
- festas, ativações, encontros e novas viagens Fly.

---

## 3. Posicionamento e princípios

### Definição curta

**O Fly App é o companheiro inteligente que conduz, protege e eterniza a jornada do cliente Fly.**

### Promessa

Transformar uma viagem em uma experiência guiada, personalizada, segura, gamificada, comprável e memorável.

### Princípios de produto

1. **O próximo passo vem primeiro.** O que o cliente precisa fazer agora nunca pode ficar escondido atrás de promoções.
2. **A Home muda conforme o momento.** Sem viagem, pré-viagem, durante a viagem e pós-viagem são experiências diferentes.
3. **Minha Viagem é o coração.** O botão central deve sempre levar ao comando da jornada ativa.
4. **Tecnologia aumenta o cuidado humano.** O app organiza a equipe para que o atendimento pareça pessoal.
5. **Luxo é ausência de atrito.** O visual precisa ser premium, mas a operação precisa ser simples.
6. **Gamificação não substitui utilidade.** Roteiro, alerta, QR, refeição e ajuda têm prioridade.
7. **O essencial funciona offline.** Roteiro, documentos autorizados, vouchers, QR e contatos críticos têm cache protegido.
8. **Tudo importante vem do painel.** Horários, preços, textos, contatos e regras nunca ficam presos no código.
9. **Privacidade por padrão.** Passaporte, localização, saúde, gastos e preferências recebem acesso mínimo e auditável.
10. **Não existe saldo mágico.** Pontos, créditos e pagamentos precisam de ledger, idempotência e validação no servidor.

---

## 4. Navegação principal definitiva

Usar cinco posições na barra inferior:

| Posição | Rótulo | Função |
|---|---|---|
| 1 | **Início** | Próxima ação, alertas, eventos, status e conteúdo personalizado |
| 2 | **Passeios** | Meus passeios, catálogo, tendências, adicionais e compra |
| 3 | **Minha Viagem** | Botão central elevado; roteiro, inclusões, documentos, refeições, álbum e operação da viagem |
| 4 | **Carteira** | Fly Points, status, benefícios, créditos, pagamentos, compras, recibos e tax-free |
| 5 | **Perfil** | Fly ID, QR pessoal, ranking, conquistas, preferências, viagens e configurações |

### 4.1 Botão central Minha Viagem

O botão deve ser circular, maior que os demais, elevado sobre a barra e com brilho dourado discreto. Ele é o elemento mais reconhecível da navegação.

Requisitos:

- área visual aproximada entre 68 e 76 dp, respeitando acessibilidade;
- ícone relacionado a jornada, asa, avião ou mala;
- rótulo visível “Minha Viagem”;
- pequeno indicador de alerta quando houver alteração importante;
- anel de progresso opcional durante a viagem;
- feedback tátil ao tocar;
- estado sem viagem ativa, mantendo o rótulo e abrindo histórico/planejamento;
- nunca sobrepor conteúdo ou áreas seguras de iPhone e Android.

### 4.2 Ações flutuantes

Duas ações ficam em uma coluna flutuante na lateral direita, acima da barra inferior:

1. **Carrinho:** dourado/grafite, com contador de itens e acesso ao checkout.
2. **Fly Assist / SOS:** visual distinto, com acesso imediato a chat, ajuda urgente e emergência.

Regras:

- o carrinho aparece principalmente em Passeios, ofertas e Carteira; pode ficar compacto quando vazio;
- Fly Assist permanece acessível nas telas críticas;
- o botão de emergência nunca deve ter a mesma cor ou ícone do carrinho;
- tocar em Fly Assist abre uma folha com três escolhas: “Falar com a Fly”, “Preciso de ajuda agora” e “SOS / Emergência”;
- o envio de um SOS exige confirmação clara, mas não pode obrigar o cliente a navegar por várias telas;
- leitores de tela devem anunciar cada ação e seu estado.

### 4.3 O que não vira aba inferior

Para não transformar a barra em um menu infinito:

- Álbum fica dentro de Minha Viagem e também pode ter atalho na Home;
- Gastronomia fica dentro de Minha Viagem e em serviços contextuais;
- Mapa/Explorar fica dentro de Minha Viagem e Passeios;
- Eventos ficam na Home com listagem própria;
- Quem Somos, saúde, privacidade e suporte ficam no Perfil;
- ranking detalhado fica no Perfil;
- notas fiscais e tax-free vivem funcionalmente na Carteira, com atalhos no Perfil.

---

## 5. Início / Home dinâmica

A Home deve responder a uma pergunta: **“O que importa para este cliente agora?”**

### 5.1 Componentes permanentes

- foto e saudação;
- Fly Status resumido;
- sino de notificações;
- card principal de próxima ação;
- atalhos contextuais;
- Fly Points resumidos;
- Acontece na Fly;
- memória, conquista ou recomendação;
- Fly Assist.

### 5.2 Estado sem viagem ativa

Ordem recomendada:

1. saudação, nível e pontos;
2. hero de próxima viagem ou experiência indicada;
3. Acontece na Fly;
4. benefícios disponíveis;
5. passeios e destinos em alta;
6. galeria/histórias recentes;
7. indicação e CTA para falar com a Fly.

### 5.3 Estado pré-viagem

Ordem recomendada:

1. contagem regressiva;
2. checklist obrigatório;
3. próxima pendência;
4. passaporte, documentos e termos;
5. voo, aeroporto e evento pré-viagem;
6. curadoria de preferências;
7. Fly Talks sobre mala, cultura, clima, câmbio e segurança;
8. Acontece na Fly;
9. suporte.

### 5.4 Estado durante a viagem

Ordem recomendada:

1. **Agora na sua jornada** com compromisso, contagem regressiva e ponto de encontro;
2. ações: apresentar QR, abrir rota, confirmar presença, escolher refeição e avisar atraso;
3. alertas críticos;
4. linha do tempo resumida do dia;
5. progresso do capítulo;
6. figurinha, foto ou memória recém-liberada;
7. sugestão contextual de passeio ou upgrade;
8. Acontece na Fly em espaço menor;
9. Fly Assist/SOS persistente.

### 5.5 Estado pós-viagem

Ordem recomendada:

1. resumo ou filme da jornada;
2. álbum e fotos profissionais;
3. pontos, nível e conquistas;
4. recibos/tax-free pendentes;
5. feedback curto;
6. próxima experiência recomendada;
7. indicação e embaixador;
8. eventos Fly.

### 5.6 Acontece na Fly

Exibir até três cards na Home e um botão “Ver todos”. Cada card contém:

- capa;
- categoria;
- nome;
- cidade;
- data e horário;
- status: anunciado, inscrições abertas, acontecendo, encerrado;
- participantes em destaque;
- benefício para cliente Fly;
- CTA configurável.

CTAs aceitos:

- Ver evento;
- Comprar ingresso;
- Entrar na lista;
- Assistir;
- Ver resultados;
- Abrir no Fly Cup;
- Quero viver isso em Dubai.

O conteúdo vem do Fly Ops. Nenhum evento deve ser hardcoded no componente.

---

## 6. Passeios

Passeios é ao mesmo tempo a área de uso e a principal vitrine comercial do app.

### 6.1 Tela raiz

Ordem sugerida:

1. título, busca e filtros;
2. barra compacta **“Meus passeios (n)”** com seta;
3. categorias em chips;
4. seção **Trend Passeios**;
5. recomendados para o cliente;
6. experiências Fly Exclusives;
7. perto de você;
8. ofertas e combos;
9. parceiros e eventos locais.

Ao tocar em “Meus passeios”, abrir uma página própria com:

- próximos;
- pendentes de confirmação;
- concluídos;
- cancelados/reembolsados;
- ingressos e QR Codes;
- botão para adicionar à Minha Viagem quando permitido.

### 6.2 Catálogo e busca

Filtros:

- cidade e destino;
- data;
- categoria;
- preço;
- duração;
- horário;
- perfil: família, casal, aventura, luxo, negócios ou creator;
- acessibilidade;
- disponibilidade imediata;
- incluído no pacote ou adicional;
- pontos gerados ou aceitos.

### 6.3 Card de passeio

Cada card deve mostrar:

- imagem;
- nome;
- selo “Incluído”, “Adicional”, “Exclusivo” ou “Em alta”;
- duração;
- preço e moeda;
- nota ou curadoria Fly;
- disponibilidade curta;
- Fly Points que pode gerar;
- botão de favoritar;
- CTA de detalhes/adicionar.

### 6.4 Detalhe do passeio

- galeria e vídeo;
- descrição;
- por que a Fly recomenda;
- o que está incluso e não incluso;
- data, horários e vagas;
- local e ponto de encontro;
- regras de roupa, idade, saúde e segurança;
- política de cancelamento;
- acessibilidade;
- opções e adicionais;
- avaliações verificadas;
- preço, moedas e pontos;
- recomendação para o roteiro existente;
- botão “Adicionar ao carrinho”.

### 6.5 Carrinho e checkout

O carrinho flutuante precisa persistir entre sessões autenticadas.

Fluxo:

1. cliente escolhe data, horário, quantidade e participantes;
2. sistema valida disponibilidade no servidor;
3. item entra no carrinho por tempo configurável;
4. cliente aplica cupom, crédito ou pontos elegíveis;
5. confirma participantes e regras;
6. paga por provedor externo tokenizado;
7. recebe confirmação, pedido e QR/ticket;
8. passeio aparece em Meus Passeios e, se aplicável, em Minha Viagem.

Requisitos:

- idempotência no pedido e pagamento;
- preços calculados no servidor;
- reserva temporária de inventário;
- moedas BRL e AED preparadas, sem conversão inventada pelo cliente;
- política de cancelamento registrada no momento da compra;
- webhook assinado do provedor;
- reembolso com trilha de auditoria;
- nunca armazenar número completo ou CVV do cartão.

### 6.6 Fly Exclusives e pedidos especiais

Categorias:

- iate;
- helicóptero;
- carro esportivo;
- mesa e camarote;
- tour privado;
- pedido de namoro/casamento;
- fotógrafo exclusivo;
- concierge de compras;
- experiência Billionaire.

Itens sem preço fechado podem usar “Solicitar proposta” e virar tarefa no Fly Ops.

---

## 7. Minha Viagem

Minha Viagem é o centro de comando da jornada ativa.

### 7.1 Tela raiz

Blocos:

1. capa da viagem, destino e datas;
2. card “Agora / Próximo”;
3. seletor de dia;
4. linha do tempo;
5. alertas e mudanças;
6. barra de progresso do capítulo;
7. atalhos do hub;
8. contato da equipe responsável.

### 7.2 Hub da viagem

O hub deve conter:

- Roteiro;
- Tudo que está incluso;
- Voos;
- Hotel;
- Transfers;
- Passeios;
- Refeições;
- Documentos;
- Ingressos e QR Codes;
- Mapa e Bases Fly;
- Álbum e Galeria;
- Grupo e acompanhantes;
- Fly Talks;
- Ajuda e emergência;
- Compras vinculadas;
- Feedback e pós-viagem.

### 7.3 Roteiro por dia

Cada atividade mostra:

- título e imagem;
- status: futuro, confirmado, em andamento, concluído, alterado ou cancelado;
- horário local e horário de saída;
- duração;
- contagem regressiva;
- ponto de encontro;
- rota;
- responsável Fly;
- o que levar;
- roupa e instruções;
- participantes/companheiros;
- ticket ou QR;
- refeição associada;
- chat contextual;
- botões “Estou pronto”, “Estou atrasado” e “Não encontrei o grupo”;
- galeria liberada após a conclusão.

Alterações importantes precisam gerar push, destaque no app e confirmação de leitura quando exigido.

### 7.4 Tudo que está incluso

Separar por categoria:

- aéreo;
- hospedagem;
- alimentação;
- transporte;
- passeios;
- seguro;
- benefícios;
- press kit;
- serviços especiais.

Cada item deve ter status, detalhes, regras e canal de dúvida. Itens opcionais devem ser claramente diferenciados de itens já pagos.

### 7.5 Voos e modo aeroporto

- companhia, número, origem, destino, terminal, portão e horários;
- cartões de embarque quando permitido;
- check-in e status;
- limite de bagagem;
- checklist de passaporte, mala e documentos;
- horário recomendado para sair de casa/hotel;
- instruções da Base Fly;
- alertas de mudança via fornecedor de dados contratado;
- conteúdo disponível offline.

Nova ideia recomendada: **Modo Aeroporto**, uma tela limpa que mostra apenas o necessário para embarcar, localizar a base, apresentar documentos e pedir ajuda.

### 7.6 Hotel e transfer

- hotel, endereço, reserva e quarto quando liberado;
- política e horários;
- mapa e contato;
- check-in pré-preenchido quando legalmente permitido;
- status do transfer;
- motorista/veículo conforme política de privacidade;
- “Onde está meu transfer?” quando houver integração de rastreamento;
- confirmação de embarque e presença do grupo.

### 7.7 Cofre da viagem

Itens:

- passaporte;
- passagem;
- reserva do hotel;
- seguro;
- vouchers;
- ingressos;
- autorizações;
- documentos enviados pela equipe.

Regras:

- armazenamento privado;
- URLs temporárias;
- autenticação e biometria para conteúdo sensível;
- cache local criptografado apenas para itens autorizados;
- log de acesso administrativo;
- política de retenção e exclusão;
- revisão dos campos extraídos por OCR;
- passaporte nunca em bucket público;
- dados de passaporte nunca enviados a um modelo de IA genérico.

### 7.8 QR Codes

Tipos:

- Fly ID pessoal;
- check-in de atividade;
- ingresso;
- benefício;
- pulseira;
- álbum físico;
- ponto interativo da cidade;
- item de press kit;
- confirmação manual de contingência.

Regras:

- token opaco ou assinado, sem dados pessoais brutos;
- expiração e revogação;
- escopo de uso;
- prevenção de resgate duplicado;
- log de leitura;
- funcionamento de contingência offline;
- validação final no servidor ao reconectar;
- política clara para screenshot e compartilhamento.

### 7.9 Presença e grupo

Nova ideia recomendada: **Ready Check**.

Antes de uma saída, cada viajante pode tocar em “Estou pronto”. A equipe enxerga:

- quem confirmou;
- quem ainda não respondeu;
- quem informou atraso;
- quem precisa de ajuda;
- acompanhantes vinculados.

O cliente nunca deve ver informações sensíveis dos demais integrantes.

### 7.10 Modo acompanhante e família

- responsável pode visualizar dependentes autorizados;
- documentos e tickets separados por pessoa;
- seleção de refeição por acompanhante;
- autorização específica para menores;
- contato de emergência;
- permissão granular para compartilhar localização em situações de ajuda.

---

## 8. Carteira

O nome da aba inferior será **Carteira**. Dentro dela, a marca pode usar o título **Fly Wallet**.

### 8.1 Estrutura

Usar navegação interna:

- Resumo;
- Fly Points;
- Benefícios;
- Pagamentos;
- Compras;
- Notas e Tax-Free.

### 8.2 Resumo

- saldo de Fly Points;
- Fly Status e progresso;
- créditos promocionais;
- vouchers e cupons;
- últimas movimentações;
- benefícios disponíveis;
- atalhos para adicionar saldo, resgatar e cadastrar nota;
- estimativa de tax-free pendente.

### 8.3 Fly Points

Fly Points são pontos resgatáveis e não devem ser confundidos com dinheiro.

Fontes possíveis:

- compras elegíveis;
- check-ins;
- desafios;
- indicação;
- eventos;
- conteúdo aprovado;
- campanhas patrocinadas;
- conversões autorizadas do Fly Cup.

Toda movimentação deve ter:

- tipo;
- quantidade;
- origem;
- referência;
- data;
- validade;
- regra utilizada;
- idempotency key;
- usuário ou sistema responsável;
- reversão vinculada, nunca exclusão silenciosa.

### 8.4 Fly Status e plaquinhas

O status representa relacionamento e valor elegível acumulado. Exemplos:

- Elite VIP;
- Billionaire;
- placas 10K, 50K, 100K, 500K e 1MM.

Mostrar:

- nível atual;
- progresso;
- quanto falta;
- benefícios ativos;
- validade;
- regras resumidas;
- histórico de evolução.

As regras de pontuação e elegibilidade são administráveis. O app não deve prometer acompanhante, Lamborghini ou outro prêmio sem uma regra ativa e aprovada.

### 8.5 Benefícios e recompensas

- catálogo;
- elegibilidade;
- quantidade disponível;
- validade;
- regras;
- resgate por QR;
- reserva;
- histórico;
- patrocinador associado.

Exemplos conceituais do Livro Fly:

- nível 50K: acompanhante;
- nível 100K: dois acompanhantes e experiência com Lamborghini;
- cliente da semana: avião dourado e pacote Billionaire;
- reconhecimento dos clientes próximos ao ganhador.

Esses exemplos precisam ser configuráveis e sujeitos a disponibilidade, contrato e aprovação operacional.

### 8.6 Pagamentos, cartões e saldo

A interface pode permitir:

- adicionar forma de pagamento;
- exibir bandeira e últimos quatro dígitos;
- definir cartão padrão;
- pagar compras;
- adicionar crédito Fly por Pix/cartão quando habilitado;
- solicitar ou acompanhar um futuro Fly Card.

Restrições obrigatórias:

- cartões são tokenizados pelo provedor; a Fly não armazena PAN completo nem CVV;
- “Adicionar saldo” financeiro só entra em produção por meio de PSP/BaaS e análise jurídica;
- Fly Card virtual ou físico exige emissor/parceiro regulado;
- créditos promocionais, dinheiro, reembolso e pontos são contas diferentes;
- cada conta tem ledger próprio;
- toda função regulada começa atrás de feature flag.

### 8.7 Compras e extrato

- pedidos;
- pagamentos;
- reembolsos;
- créditos;
- passeios;
- upgrades;
- produtos Fly;
- comprovantes;
- suporte do pedido.

### 8.8 Scanner de notas e Tax-Free

Fluxo:

1. cliente fotografa ou importa a nota;
2. OCR sugere loja, data, moeda, total e imposto;
3. cliente revisa;
4. sistema identifica duplicidade e elegibilidade preliminar;
5. equipe ou parceiro valida;
6. caso é consolidado;
7. cliente acompanha status, pendências e estimativa;
8. documentos oficiais são encaminhados somente por integração/parceiro autorizado.

Status:

- rascunho;
- aguardando revisão;
- pendente de informação;
- elegível preliminarmente;
- enviado ao parceiro;
- validado;
- rejeitado;
- reembolso processado.

O app não pode prometer devolução integral de 5%. Deve mostrar estimativa, taxas, elegibilidade e dependência da validação oficial.

Atalhos para cadastrar nota podem aparecer no Perfil, mas o registro financeiro oficial vive na Carteira.

---

## 9. Perfil

### 9.1 Cabeçalho

- foto;
- nome;
- Fly ID;
- QR pessoal;
- selo de verificação/conquista;
- status e plaquinha;
- posição de ranking quando autorizado.

### 9.2 Seções

- Dados pessoais;
- Preferências;
- Família e acompanhantes;
- Documentos e segurança;
- Minhas viagens;
- Conquistas;
- Ranking;
- Conteúdo e modo influenciador;
- Compras e notas, como atalhos para Carteira;
- Contato de emergência;
- Idioma;
- Notificações;
- Privacidade e consentimentos;
- Biometria;
- Ajuda;
- Quem Somos;
- Termos e políticas;
- Sair.

### 9.3 Ranking Fly

O ranking precisa ser opt-in.

Por padrão, mostrar:

- posição;
- nome autorizado;
- foto autorizada;
- nível;
- conquistas;
- pontuação pública normalizada.

Não mostrar gasto exato publicamente por padrão. O painel interno pode usar valores completos apenas para funcionários autorizados.

O ranking pode ter dimensões diferentes:

- clientes da semana;
- engajamento;
- capítulos completos;
- embaixadores/indicações;
- grupos e famílias;
- eventos.

### 9.4 Curadoria de preferências

Campos:

- como gosta de ser chamado;
- data de nascimento;
- tamanhos de camisa e calçado;
- snacks, doces e bebidas;
- comidas favoritas e recusadas;
- alergias e restrições;
- time;
- artistas e estilos musicais;
- hobbies;
- marcas e estilos;
- ocasiões especiais;
- preferência de quarto, quando aplicável;
- idioma;
- preferência de comunicação;
- contato de emergência;
- autorização de imagem;
- participação no ranking;
- preferências de presentes e surpresa.

Apresentar em etapas curtas com a mensagem: **“Ajude a Fly a cuidar dos detalhes que fazem diferença para você.”**

---

## 10. Os três sistemas de progresso

Eles devem permanecer separados em conceito e banco.

| Sistema | Representa | Exemplo |
|---|---|---|
| **Fly Status** | relacionamento e valor elegível acumulado | Elite VIP, Billionaire, placas 10K a 1MM |
| **Fly Points** | saldo resgatável | pontos de compra, desafio, evento ou indicação |
| **Jornada / Álbum** | experiências concluídas em uma viagem | Jet Ski, capítulo Deserto, Dia Completo |

Uma compra pode afetar status e pontos, mas são lançamentos independentes. Uma figurinha pode dar pontos, mas não é o próprio ponto.

---

## 11. Gastronomia e serviços

### 11.1 Refeições da viagem

Fluxo:

1. cliente vê almoço e jantar do dia seguinte;
2. escolhe opção e personalizações permitidas;
3. recebe lembrete;
4. confirma até o prazo configurado, inicialmente cinco horas;
5. equipe acompanha pendências e totais por fornecedor;
6. exceções exigem papel autorizado e ficam auditadas.

O prazo nunca pode ser hardcoded.

### 11.2 Restaurantes

- busca e curadoria;
- disponibilidade;
- reserva;
- participantes;
- preferências alimentares;
- depósito quando necessário;
- ocasião especial;
- pedido de namoro/casamento;
- concierge humano para solicitações complexas.

### 11.3 Farmácia, mercado e estilo de vida

Serviços:

- farmácia;
- mercado;
- salão;
- barbeiro;
- spa;
- lavanderia;
- compras essenciais;
- entrega na base/hotel;
- pedido a parceiro por deep link ou API.

Começar com catálogo e solicitação administrável. Ativar Noon, Careem e outros somente quando houver API, contrato e termos válidos.

---

## 12. Mapas, Bases Fly, concierge e SOS

### 12.1 Mapa

Mostrar:

- posição do cliente, mediante permissão;
- roteiro do dia;
- pontos turísticos;
- passeios;
- Bases Fly;
- parceiros;
- hospitais, clínicas e farmácias;
- pontos de Fly Quest;
- rotas e abertura no app de mapas instalado.

Futuro:

- mapa embutido avançado;
- navegação contextual;
- visualização 3D;
- disponibilidade ao vivo;
- integração contratada com mobilidade.

Não depender de Google Earth ou Citymapper para o núcleo funcionar.

### 12.2 Bases Fly

Cada base mostra:

- endereço;
- distância;
- horário;
- serviços;
- status aberta/fechada;
- fila ou disponibilidade;
- contato;
- rota;
- equipe responsável, sem expor dados pessoais desnecessários.

### 12.3 Níveis de atendimento

| Nível | Exemplo | Fluxo |
|---|---|---|
| **Conversa** | roupa, horário, indicação | chat comum |
| **Ajuda urgente** | perdeu o grupo, atraso, transfer | fila prioritária e localização opcional |
| **SOS** | saúde, risco ou emergência | alerta imediato, localização, fallback de ligação |

### 12.4 SOS

- solicitar localização no momento necessário;
- enviar última localização válida;
- confirmar recebimento;
- atribuir funcionário/equipe;
- exibir status e primeira resposta;
- manter chat no app;
- oferecer ligação quando a conexão falhar;
- mostrar contatos oficiais configuráveis;
- registrar aceite, resposta, resolução e escalonamento;
- não revelar localização exata de funcionário ao cliente;
- não prometer substituição de serviços públicos de emergência.

### 12.5 Saúde e bem-estar

- seguro viagem;
- contatos médicos;
- clínicas e farmácias;
- teleatendimento por parceiro;
- informações médicas fornecidas voluntariamente;
- alergias e condições críticas com consentimento específico;
- acesso restrito e auditável.

---

## 13. A assinatura emocional da Fly

Esta seção não é “enfeite”. Ela descreve o que diferencia a Fly de uma agência comum.

### 13.1 Álbum físico + digital

Conceito:

- cada viagem é uma temporada;
- cada dia é um capítulo;
- cada passeio tem uma ou mais figurinhas;
- o álbum físico preto e dourado conversa com o álbum digital;
- QR Codes do álbum e da experiência liberam conteúdo;
- figurinhas podem ser comuns, raras, secretas e holográficas;
- fotos e vídeos ficam vinculados ao momento;
- a figurinha do cliente pode usar sua própria imagem;
- uma figurinha especial do fundador/CEO pode existir como item secreto.

Fluxo:

1. cliente participa da experiência;
2. guia valida check-in por QR ou confirmação autorizada;
3. sistema processa o evento de desbloqueio;
4. app mostra “Você conquistou esta figurinha”;
5. mídia liberada aparece dentro da figurinha;
6. cliente compartilha um card vertical;
7. ao cumprir as regras do dia, ocorre o **Dia Completo**.

### 13.2 Dia Completo

Cada capítulo possui:

- figurinhas obrigatórias;
- figurinhas opcionais;
- missões;
- recompensa;
- mídia;
- regra de conclusão;
- horário de liberação.

O Dia Completo só acontece no servidor e conforme configuração do Fly Ops. Não pode ser inferido apenas pelo aplicativo.

Ao concluir:

- animação dourada;
- recompensa de capítulo;
- pontos opcionais;
- teaser do dia seguinte;
- arte de compartilhamento;
- atualização do álbum físico/digital.

### 13.3 Pacote de boa-noite / recompensa do capítulo

Ao voltar tarde para o hotel, o cliente pode receber:

- snack ou bebida preferida;
- item ligado a algo comentado;
- presente patrocinado;
- lembrança de aniversário/conquista;
- cartão do próximo dia;
- mensagem personalizada.

No app, mostrar apenas um teaser, como **“Seu próximo capítulo já está sendo preparado.”** Não revelar a surpresa física antes da entrega.

No Fly Ops:

- cliente elegível;
- preferências;
- insights recentes;
- orçamento;
- sugestão;
- responsável;
- prazo;
- compra;
- preparação;
- entrega;
- reação/feedback;
- patrocinador e custo.

### 13.4 Escuta ativa de encantamento

Exemplos:

- “É fã do Travis Scott.”
- “Falou que queria uma camisa específica.”
- “Está comemorando uma conquista.”
- “Sentiu falta de Coca-Cola no quarto.”

Fluxo:

1. funcionário abre o cliente no Fly Crew;
2. registra insight curto, categoria, urgência e contexto;
3. Gerência da Experiência recebe alerta;
4. insight pode virar tarefa de surpresa;
5. tarefa recebe orçamento e aprovação;
6. ação é concluída e registrada.

O cliente nunca visualiza essas anotações internas.

### 13.5 Galeria Fly

- fotos por viagem, dia e experiência;
- marcação manual no primeiro estágio;
- download em alta resolução;
- versão para redes sociais;
- controle de autorização de imagem;
- compartilhamento;
- créditos dos fotógrafos;
- collab e missão de conteúdo;
- vídeo diário;
- aftermovie;
- cápsula do tempo;
- reimpressão/álbum pós-viagem.

### 13.6 Modo Influenciador

Ativado por perfil e viagem:

- briefing;
- tarefas e entregáveis;
- collabs;
- links e códigos;
- campanhas;
- upload de conteúdo;
- aprovação;
- métricas antes e depois;
- prints do perfil profissional;
- galeria profissional;
- direitos de uso;
- status de pagamento ou contrapartida quando aplicável.

---

## 14. Gamificação avançada

### 14.1 Fly Quest

O conceito “Pokémon GO” deve virar uma propriedade original, por exemplo **Fly Quest**, **Fly Hunt** ou **Fly Drops**. Não usar nome, personagens ou identidade Pokémon.

Mecânicas:

- QR em pontos interativos;
- geofence quando confiável;
- enigmas e missões;
- check-in;
- foto;
- conteúdo patrocinado;
- pontos escondidos;
- avião dourado virtual;
- sequência diária;
- desafio em grupo;
- prêmio surpresa.

### 14.2 Segurança da gamificação

- validação no servidor;
- token com validade;
- limite de resgate;
- detecção de duplicidade;
- sinais de localização falsa;
- revisão manual;
- regras por campanha;
- ledger dos pontos;
- reversão auditada;
- limite por usuário/grupo.

### 14.3 Conquistas e placas

- locais visitados;
- viagens concluídas;
- dias completos;
- eventos;
- indicações;
- compras;
- desafios;
- conteúdo;
- recorrência;
- níveis de status.

### 14.4 Premiação semanal

O programa deve suportar:

- período;
- critérios ponderados;
- opt-in;
- ranking público seguro;
- premiação principal;
- recompensas para finalistas;
- patrocinadores;
- aprovação;
- estoque/orçamento;
- cerimônia virtual ou presencial;
- conteúdo para redes;
- regras e termos.

Nunca calcular vencedor exclusivamente no cliente.

---

## 15. Inteligência, social, tradução e planejamento

### 15.1 Assistente Fly

Pode recomendar:

- próximo passo;
- passeio;
- restaurante;
- roupa;
- horário;
- rota;
- benefício;
- atividade compatível com preferências;
- alternativa quando o roteiro muda.

Princípios:

- respostas operacionais críticas usam dados estruturados;
- IA não inventa horário, preço, ingresso ou disponibilidade;
- passaportes e dados médicos não entram no contexto de modelos genéricos;
- toda recomendação identifica quando precisa de confirmação humana;
- concierge humano assume a conversa quando necessário.

### 15.2 Tradução

- frases rápidas;
- tradução de texto;
- leitura de placas via câmera;
- idiomas do roteiro;
- mensagens do suporte;
- histórico apagável.

### 15.3 Fly Social

Opt-in por viagem:

- feed privado da turma;
- fotos compartilhadas;
- networking;
- cartões de visita/QR;
- grupos;
- stories;
- comentários e reações;
- denúncias e moderação;
- bloqueio;
- controle de visibilidade.

Não priorizar feed público antes de resolver privacidade, moderação e operação.

### 15.4 Planejador financeiro

- orçamento diário;
- gastos manuais;
- compras Fly automáticas;
- moedas;
- categorias;
- alerta de limite;
- previsão;
- tax-free estimado;
- exportação.

Não misturar gasto manual com extrato financeiro oficial.

### 15.5 Fly Talks

- workshop pré-viagem;
- cultura e etiqueta;
- mala;
- aeroporto;
- segurança;
- investimentos e oportunidades, com avisos adequados;
- podcasts;
- vídeos;
- quizzes e certificados opcionais.

---

## 16. Fly Ops: painel operacional

O painel não é opcional. Todo módulo do app precisa ter uma forma de ser operado sem alteração de código.

### 16.1 Hoje

- viagens em andamento;
- próximos compromissos;
- clientes atrasados ou sem confirmação;
- alertas críticos;
- refeições pendentes;
- SOS e ajuda;
- pedidos;
- falhas de integração;
- tarefas de encantamento;
- notificações agendadas.

### 16.2 Clientes

- busca;
- perfil;
- viagens;
- onboarding;
- documentos e pendências;
- preferências resumidas;
- acompanhantes;
- status e pontos;
- compras;
- consentimentos;
- insights internos;
- histórico de suporte;
- acesso por papel.

### 16.3 Viagens

- criar e duplicar viagem;
- destino, fuso, datas, hotel e responsáveis;
- grupos e membros;
- pacotes e inclusões;
- roteiro;
- voos, transfers e hospedagem;
- documentos;
- comunicações;
- refeições;
- álbum;
- equipe;
- fornecedores;
- contingência.

### 16.4 Roteiro

- montar por dia e ordem;
- templates;
- dependências;
- horários;
- ponto de encontro;
- conteúdo;
- QR;
- público segmentado;
- itens obrigatórios;
- mudança em massa;
- versionamento;
- confirmação de leitura;
- publicação agendada.

### 16.5 Passeios e comércio

- catálogo;
- mídia;
- categorias;
- variantes;
- agenda e inventário;
- preço e moeda;
- custo e margem com acesso restrito;
- fornecedores;
- cupons;
- pontos;
- carrinhos abandonados;
- pedidos;
- pagamentos;
- reembolsos;
- propostas especiais.

### 16.6 Carteira e fidelidade

- contas e ledgers;
- regras de pontos;
- status e placas;
- catálogo de benefícios;
- campanhas;
- validade;
- resgates;
- ranking;
- premiações;
- patrocinadores;
- ajustes com dupla aprovação.

### 16.7 Refeições e reservas

- cardápios;
- opções;
- restrições;
- prazos;
- pendências;
- total por prato;
- lista por fornecedor;
- exceções;
- reservas especiais.

### 16.8 Suporte e SOS

- filas;
- prioridade;
- atribuição;
- localização autorizada;
- chat;
- templates;
- SLA;
- escalonamento;
- ligação;
- contatos oficiais;
- incidentes;
- resolução;
- relatórios.

### 16.9 Álbum, mídia e experiência

- capítulos;
- figurinhas;
- regras de Dia Completo;
- unlock manual/QR;
- upload;
- marcação;
- liberação;
- compartilhamentos;
- insights;
- surpresas;
- orçamento;
- presentes;
- inventário de brindes;
- calendário de datas especiais.

### 16.10 Eventos

- criar evento;
- publicar/despublicar;
- categoria;
- capa;
- participantes;
- local/data;
- status;
- conteúdo;
- ingresso;
- benefício;
- CTA;
- deep link para Fly Cup;
- destaque e ordem na Home.

### 16.11 Configuração, segurança e auditoria

- papéis;
- permissões;
- equipes;
- destinos;
- feature flags;
- contatos;
- textos;
- integrações;
- chaves somente por secret manager;
- logs de auditoria;
- exportação;
- retenção;
- alertas de segurança.

---

## 17. Fly Crew: interface móvel interna

Papéis possíveis:

- guia;
- base aeroporto;
- base cidade/hotel;
- motorista/transfer;
- suporte;
- experiência;
- mídia;
- alimentação;
- gestor de viagem;
- administrador.

### Funções

- agenda do dia;
- lista de grupo;
- Ready Check;
- escanear QR;
- check-in manual com justificativa;
- emitir/revogar contingência;
- enviar atualização;
- validar refeição;
- receber SOS;
- aceitar atendimento;
- conversar;
- abrir rota;
- registrar insight;
- criar tarefa de surpresa;
- registrar entrega;
- subir mídia;
- marcar cliente;
- consultar informações estritamente necessárias.

Cada ação sensível deve gerar auditoria. A equipe vê apenas viagens e campos compatíveis com sua atribuição.

---

## 18. Papéis e permissões

| Papel | Acesso principal |
|---|---|
| **Cliente** | próprios dados e viagens autorizadas |
| **Responsável familiar** | dependentes vinculados e autorizados |
| **Influenciador** | módulos comuns mais missões e métricas próprias |
| **Guia** | viagens atribuídas, presença, QR e suporte operacional |
| **Base Fly** | atendimento e validações da base |
| **Mídia** | upload e marcação compatível com consentimento |
| **Experiência** | preferências relevantes, insights e surpresas |
| **Suporte** | chat, ajuda e SOS necessários |
| **Financeiro** | pedidos, reembolsos e ajustes autorizados |
| **Gestor de viagem** | operação integral de viagens atribuídas |
| **Administrador** | configuração global e papéis |

Princípio: o papel permite uma função; a atribuição limita a viagem; o consentimento limita o dado.

---

## 19. Modelo de dados por domínio

O Claude deve detalhar colunas, constraints, índices e políticas por migration. Esta lista define entidades mínimas.

### 19.1 Identidade

- `profiles`
- `user_roles`
- `staff_assignments`
- `devices`
- `push_tokens`
- `consents`
- `emergency_contacts`
- `companionships`
- `identity_links`

### 19.2 Preferências e relacionamento

- `customer_preferences`
- `preference_items`
- `customer_notes`
- `customer_insights`
- `special_dates`
- `surprise_tasks`
- `surprise_task_events`

### 19.3 Destinos e viagens

- `destinations`
- `fly_bases`
- `trips`
- `trip_groups`
- `trip_members`
- `trip_packages`
- `trip_inclusions`
- `itinerary_days`
- `itinerary_items`
- `itinerary_item_members`
- `itinerary_revisions`
- `meeting_points`
- `ready_checks`
- `attendance_events`
- `flights`
- `hotels`
- `transfers`

### 19.4 Documentos, tickets e QR

- `trip_documents`
- `document_access_logs`
- `tickets`
- `qr_tokens`
- `qr_scans`
- `checkins`

### 19.5 Passeios e comércio

- `tour_products`
- `tour_variants`
- `tour_availability_slots`
- `tour_inventory_holds`
- `tour_bookings`
- `favorites`
- `carts`
- `cart_items`
- `offers`
- `coupons`
- `orders`
- `order_items`
- `payments`
- `payment_events`
- `refunds`
- `suppliers`

### 19.6 Refeições e serviços

- `meal_services`
- `meal_options`
- `meal_selections`
- `dietary_restrictions`
- `service_catalog_items`
- `service_requests`
- `restaurant_reservations`

### 19.7 Suporte

- `support_threads`
- `support_thread_members`
- `support_messages`
- `support_events`
- `sos_requests`
- `sos_assignments`
- `authorized_location_events`
- `incident_reports`

### 19.8 Álbum e gamificação

- `albums`
- `album_chapters`
- `stickers`
- `sticker_requirements`
- `sticker_unlocks`
- `missions`
- `mission_locations`
- `mission_completions`
- `achievements`
- `user_achievements`
- `share_cards`

### 19.9 Mídia

- `media_assets`
- `media_collections`
- `media_tags`
- `media_access_grants`
- `content_rights`

### 19.10 Eventos

- `events`
- `event_categories`
- `event_participants`
- `event_ctas`
- `event_media`
- `event_interests`
- `event_ticket_links`

### 19.11 Carteira e fidelidade

- `wallet_accounts`
- `wallet_entries`
- `points_ledger`
- `status_tiers`
- `status_rules`
- `status_progress`
- `reward_catalog`
- `reward_inventory`
- `reward_redemptions`
- `ranking_periods`
- `ranking_scores`
- `payment_customer_refs`
- `payment_method_refs`

### 19.12 Notas e tax-free

- `receipts`
- `receipt_extractions`
- `receipt_items`
- `tax_free_cases`
- `tax_free_case_receipts`
- `tax_free_status_events`

### 19.13 Influenciadores

- `creator_profiles`
- `content_missions`
- `content_submissions`
- `social_metrics_snapshots`
- `campaign_links`

### 19.14 Conteúdo, notificações e sistema

- `content_blocks`
- `notifications`
- `notification_deliveries`
- `notification_preferences`
- `feature_flags`
- `app_config`
- `integration_connections`
- `integration_events`
- `audit_logs`
- `idempotency_keys`

### 19.15 Regras de modelagem

- nomes em `snake_case`;
- horários em `timestamptz` e fuso explícito na viagem;
- dinheiro em `numeric` e moeda ISO;
- foreign keys indexadas;
- constraints para estados e valores;
- índices compostos conforme consultas reais;
- paginação por cursor em feeds e extratos;
- IDs públicos opacos;
- ledgers append-only;
- nenhuma atualização destrutiva de saldo;
- soft delete somente quando há motivo e política clara;
- migrations pequenas, reversíveis e testadas;
- RLS em toda tabela exposta;
- testes permitidos e negados para cada papel.

---

## 20. Máquinas de estado obrigatórias

O Claude não deve representar processos importantes apenas com booleanos.

### Pedido

`draft -> awaiting_payment -> paid -> confirmed -> fulfilled`

Ramificações: `cancelled`, `refund_pending`, `refunded`, `failed`.

### Reserva de passeio

`held -> confirmed -> checked_in -> completed`

Ramificações: `expired`, `cancelled`, `no_show`.

### Refeição

`available -> selected -> confirmed -> locked -> sent_to_supplier -> delivered`

### SOS

`created -> acknowledged -> assigned -> responding -> resolved -> closed`

Ramificações: `escalated`, `cancelled_by_user`, `connection_lost`.

### Nota/Tax-Free

`draft -> extracted -> user_reviewed -> operations_review -> partner_submitted -> validated -> refunded`

Ramificações: `needs_information`, `rejected`.

### Figurinha

`locked -> eligible -> unlocked -> media_available`

### Surpresa

`insight -> proposed -> approved -> purchased -> prepared -> delivered -> recorded`

Toda transição deve validar papel, estado anterior, regra e idempotência.

---

## 21. Arquitetura técnica recomendada

### 21.1 Aplicações

- **Mobile cliente:** Expo + React Native + TypeScript + Expo Router.
- **Web contingencial do cliente:** Expo Web quando a experiência for compatível.
- **Fly Ops:** painel web React/TypeScript; se o repositório estiver vazio, usar framework web atual validado pela equipe.
- **Fly Crew:** aplicação interna Expo ou PWA responsiva conforme requisitos de câmera, push e offline.
- **Backend:** Supabase.
- **Banco:** Postgres.
- **Auth:** Supabase Auth com Fly ID.
- **Storage:** buckets privados e políticas por domínio.
- **Realtime:** chat, SOS, presença operacional limitada e atualizações críticas.
- **Lógica sensível:** Edge Functions ou backend confiável.
- **Push:** Expo Notifications/provedor validado em aparelhos reais.
- **Observabilidade:** erros, logs estruturados, performance e eventos de produto.

### 21.2 Monorepo sugerido

```text
fly-ecosystem/
  apps/
    fly-mobile/
    fly-ops/
    fly-crew/
    fly-cup/                 # somente se já fizer sentido no repositório
  packages/
    design-tokens/
    ui-mobile/
    ui-web/
    domain-types/
    validation/
    fly-id/
    analytics/
    config/
  supabase/
    migrations/
    functions/
    seed.sql
    tests/
  docs/
    product/
    architecture/
    security/
    operations/
    quality/
```

Se já existe código Fly Cup ou outro repositório, não migrar por impulso. Primeiro documentar fronteiras, SSO e contratos.

### 21.3 Camadas

- UI;
- view models/hooks;
- casos de uso;
- domínio;
- repositories;
- clientes externos;
- persistência/cache;
- telemetria.

Componentes visuais não chamam diretamente webhooks, chaves secretas ou regras de saldo.

### 21.4 Regras atuais de Supabase

- usar chave publicável no cliente;
- nunca expor chave secreta ou `service_role`;
- autorização em `app_metadata` ou tabelas protegidas, nunca em metadados editáveis pelo usuário;
- RLS e privilégios explícitos são controles diferentes e ambos precisam ser configurados;
- views expostas usam comportamento compatível com RLS;
- `UPDATE` precisa de política de leitura e de `WITH CHECK`;
- funções privilegiadas ficam fora de schema exposto, com escopo e execução restritos;
- Storage privado exige políticas para leitura, inserção e atualização;
- tipos do banco são gerados para TypeScript;
- dependências e lockfile são versionados;
- changelog e documentação oficial são consultados antes de implementar.

---

## 22. Contratos e integrações

### 22.1 Serviços internos sensíveis

Funções server-side:

- aceitar convite Fly ID;
- validar QR;
- criar/reservar inventário;
- criar checkout;
- processar webhook de pagamento;
- emitir reembolso;
- lançar/reverter pontos;
- resgatar benefício;
- calcular status;
- criar e atribuir SOS;
- enviar push segmentado;
- processar OCR;
- publicar alteração de roteiro;
- liberar figurinha;
- concluir Dia Completo;
- gerar card de compartilhamento.

Todas usam autenticação, autorização, idempotência e auditoria.

### 22.2 Integrações por adaptador

Criar interfaces para:

- pagamento;
- Pix;
- cartão/tokenização;
- mapas e rotas;
- clima;
- status de voo;
- SMS/e-mail/WhatsApp transacional;
- push;
- OCR;
- tradução;
- tax-free;
- mobilidade;
- delivery;
- telemedicina;
- mídia e processamento de vídeo;
- analytics;
- error tracking.

Cada adaptador precisa ter:

- modo mock/sandbox;
- credenciais por ambiente;
- timeout;
- retry controlado;
- circuit breaker quando aplicável;
- logs sem PII;
- status operacional;
- fallback humano;
- feature flag.

### 22.3 Deep links

Rotas mínimas:

- ativação de convite;
- viagem/dia/atividade;
- ticket;
- evento;
- passeio;
- pedido;
- carteira;
- benefício;
- suporte;
- Fly Cup.

Notificações devem abrir o contexto exato e tratar usuário deslogado ou sem permissão.

---

## 23. Segurança, privacidade e conformidade

### 23.1 Dados sensíveis

- passaporte;
- localização;
- saúde;
- contato de emergência;
- pagamento;
- gasto;
- preferências pessoais;
- fotos e biometria;
- dados de menores.

### 23.2 Regras

- coleta mínima;
- consentimento por finalidade;
- acesso por papel, atribuição e viagem;
- RLS;
- Storage privado;
- URLs assinadas e curtas;
- criptografia em trânsito e em repouso;
- cache local protegido;
- logs sem conteúdo sensível;
- trilha de auditoria;
- retenção definida;
- exclusão e exportação;
- revogação de sessão;
- bloqueio e recuperação de conta;
- processo de incidente;
- termos para ranking e imagem;
- revisão jurídica para LGPD e normas aplicáveis nos destinos.

### 23.3 Localização

- pedir permissão contextual, não no primeiro segundo do onboarding;
- distinguir “durante uso” e necessidades críticas;
- não rastrear continuamente sem motivo e consentimento;
- armazenar somente o necessário;
- mostrar quando a localização está sendo usada;
- permitir revogação;
- registrar acessos internos.

### 23.4 Biometria e reconhecimento facial

Biometria do aparelho pode proteger login e cofre. Reconhecimento facial para organizar fotos é outra finalidade e exige consentimento separado, fornecedor adequado, retenção e opção manual.

---

## 24. Offline, resiliência e contingência

Disponível offline:

- próximos compromissos;
- roteiro dos dias autorizados;
- vouchers e QR essenciais;
- contatos;
- hotel e base;
- documentos selecionados;
- instruções de emergência;
- última versão sincronizada claramente identificada.

Regras:

- fila de ações offline;
- reconciliação idempotente;
- indicador de dados desatualizados;
- limpeza no logout;
- proteção do cache;
- modo somente leitura quando a ação precisa do servidor;
- fallback de ligação;
- manual operacional impresso/digital para falha total.

---

## 25. Sistema visual

### 25.1 Direção

- preto e grafite;
- branco para legibilidade;
- dourado Fly como acento;
- fotografia cinematográfica;
- cartões escuros;
- brilho dourado discreto;
- luxo moderno, não cassino;
- movimentos suaves;
- interface calma nos momentos operacionais.

### 25.2 Tokens iniciais

```text
background.primary   #050505
background.surface   #101010
background.elevated  #181818
text.primary         #FFFFFF
text.secondary       #B8B8B8
brand.gold           #D4AF37
brand.goldSoft       #E7CC74
status.success       #35C76F
status.warning       #F4B740
status.danger        #F05454
```

Os valores finais dependem do manual da marca e de teste de contraste.

### 25.3 Componentes

- AppHeader;
- DynamicHomeHero;
- NextActionCard;
- Countdown;
- AlertBanner;
- BottomNav;
- CentralTripButton;
- FloatingActionRail;
- TourCard;
- MyToursBar;
- CartBubble;
- TripDaySelector;
- TimelineItem;
- ReadyCheck;
- TicketCard;
- QRPass;
- WalletSummary;
- LevelProgress;
- AchievementBadge;
- RewardCard;
- ReceiptCard;
- TaxFreeProgress;
- EventCard;
- MealOptionCard;
- MapPlaceCard;
- SupportComposer;
- SOSSheet;
- StickerCard;
- ChapterProgress;
- MediaGrid;
- OfflineBanner;
- EmptyState;
- ErrorState;
- LoadingSkeleton.

### 25.4 Acessibilidade

- contraste adequado;
- tamanho de texto dinâmico;
- área de toque mínima;
- rótulos;
- foco previsível;
- leitor de tela;
- estados não dependentes apenas de cor;
- redução de movimento;
- feedback tátil opcional;
- legendas em vídeo;
- idioma e leitura simples em emergências.

---

## 26. Notificações

Categorias:

- operacional crítica;
- lembrete;
- refeição;
- alteração de roteiro;
- documento;
- compra/pagamento;
- benefício/pontos;
- álbum;
- evento;
- marketing;
- suporte/SOS.

Cada notificação contém:

- público;
- prioridade;
- horário local;
- deep link;
- validade;
- deduplicação;
- preferência do usuário;
- confirmação de entrega/leitura quando necessária;
- fallback.

Marketing nunca pode silenciar alertas operacionais críticos.

---

## 27. Analytics e métricas

### Produto

- ativação do Fly ID;
- onboarding concluído;
- uso por fase da viagem;
- cliques na próxima ação;
- retenção;
- falhas por tela;
- uso offline.

### Operação

- leitura de alertas;
- presença/Ready Check;
- QR validado;
- refeição confirmada;
- alteração de roteiro recebida;
- pendências por grupo;
- SLA de fornecedores.

### Suporte

- conversas;
- ajuda urgente;
- SOS;
- tempo de aceite;
- primeira resposta;
- resolução;
- escalonamento;
- fallback externo.

### Experiência

- figurinhas;
- Dias Completos;
- fotos baixadas;
- compartilhamentos;
- surpresas entregues;
- feedback;
- NPS/CSAT quando adequado.

### Negócio

- passeio visto;
- add-to-cart;
- abandono;
- conversão;
- ticket;
- upsell;
- pontos resgatados;
- evento para viagem;
- indicação;
- recompra.

Eventos analíticos não devem transportar passaporte, mensagem privada, localização exata ou conteúdo médico.

---

## 28. Matriz de viabilidade

### Construível diretamente

- navegação;
- Home dinâmica;
- roteiro;
- documentos privados;
- QR;
- refeições;
- catálogo;
- carrinho;
- pedidos;
- pontos;
- status;
- álbum;
- eventos;
- chat;
- SOS interno;
- painel;
- modo Crew;
- recibos com revisão;
- conteúdo e notificações.

### Exige provedor, mas pode ter sandbox

- pagamento;
- Pix;
- status de voo;
- mapas avançados;
- clima;
- OCR;
- tradução;
- SMS/WhatsApp;
- vídeo automático;
- telemedicina.

### Exige contrato/parceria e revisão jurídica

- saldo financeiro armazenado;
- Fly Card;
- validação oficial de tax-free;
- integração direta Careem/Noon/Uber;
- governo e subsídio de prêmios;
- reconhecimento facial;
- rastreamento ao vivo de equipe;
- consultas médicas;
- recompensas de alto valor.

O Claude deve implementar interface, contrato, feature flag e modo sandbox sem declarar uma integração externa como concluída antes das credenciais e homologação.

---

## 29. Ideias adicionais recomendadas

1. **Modo Aeroporto:** tela de embarque limpa e offline.
2. **Ready Check:** presença antes de cada saída.
3. **Onde está meu transfer?:** rastreio contratado e fallback humano.
4. **Fly Guardian:** responsável por dependentes e viajantes que precisam de apoio.
5. **Mala Pronta:** checklist inteligente por roteiro e clima.
6. **Cartão de networking:** QR compartilhável para eventos e Fly Social.
7. **Fly Capsule:** foto, carta ou vídeo liberado meses depois.
8. **Story do Dia:** montagem vertical das experiências concluídas.
9. **Passaporte Fly:** coleção entre destinos e viagens.
10. **Drops de patrocinadores:** recompensas contextuais e mensuráveis.
11. **Fila de encantamento:** priorização por impacto, prazo e orçamento.
12. **Inventário de brindes:** press kits, presentes e produtos por base.
13. **Modo Operação Silenciosa:** resumo de pendências sem incomodar o cliente.
14. **Indicador de tranquilidade:** confirma que documentos, refeições e presença estão em ordem.
15. **Embaixador Fly:** indicação rastreada, conteúdo e benefícios.

---

## 30. Estratégia de implementação do produto completo

### Regra central

Não usar um único prompt pedindo o aplicativo inteiro. Usar este documento como memória permanente e executar uma fase por vez.

Cada fase deve entregar um corte vertical:

- interface do cliente;
- dados reais;
- regras;
- painel Fly Ops;
- ação correspondente no Fly Crew, quando aplicável;
- segurança;
- analytics;
- testes;
- documentação;
- validação em tela.

### Ordem recomendada

| Fase | Resultado |
|---|---|
| 0 | auditoria, decisões e fundação |
| 1 | design system, navegação definitiva e estados globais |
| 2 | Fly ID, onboarding, Perfil e permissões |
| 3 | Home dinâmica, eventos e notificações |
| 4 | Minha Viagem, roteiro, documentos, QR e offline |
| 5 | Passeios, carrinho, pedidos e checkout |
| 6 | Carteira, pontos, status, benefícios, compras e tax-free inicial |
| 7 | Gastronomia, reservas e serviços |
| 8 | Mapas, Bases Fly, concierge, chat, ajuda e SOS |
| 9 | Álbum, Fly Quest, galeria, encantamento e influenciadores |
| 10 | IA, tradução, social, planejador e integrações avançadas |
| 11 | Fly Ops/Fly Crew completos, relatórios e hardening operacional |
| 12 | segurança, performance, acessibilidade, lojas e lançamento |

### Por que essa ordem

- identidade e permissão vêm antes de dados sensíveis;
- Minha Viagem vem antes de comércio;
- pedidos vêm antes de extrato financeiro;
- suporte e SOS dependem de viagem, equipe e localização;
- gamificação depende de check-ins e roteiro;
- IA entra depois de existir fonte de dados confiável;
- hardening final não substitui segurança em cada fase.

### Piloto de setembro

O piloto não é uma prévia visual. É uma release de produção controlada. Para operar a viagem de 10 a 17 de setembro, priorizar as fases 0 a 4, refeições da fase 7, suporte essencial da fase 8 e álbum básico da fase 9. O restante continua na mesma arquitetura e é ativado em seguida.

---

## 31. Definition of Done global

Uma fase só termina quando:

1. requisitos e regras estão documentados;
2. UI funciona em iPhone, Android e tamanhos web aplicáveis;
3. loading, vazio, erro, offline e permissão negada foram tratados;
4. banco tem migration e seed;
5. RLS e privilégios têm testes positivos e negativos;
6. mudanças do painel aparecem no app sem republicar;
7. ações sensíveis são auditadas;
8. analytics essenciais foram adicionados sem PII;
9. lint passa;
10. typecheck passa;
11. testes passam;
12. fluxo crítico foi verificado visualmente;
13. documentação e decision log foram atualizados;
14. segredos não estão no código;
15. riscos restantes estão explícitos;
16. não existem erros conhecidos escondidos por mock;
17. o Claude não avançou para outra fase sem autorização.

---

## 32. Critérios de aceite de produto

### Navegação

- barra inferior possui exatamente os cinco destinos definidos;
- Minha Viagem é o botão central elevado;
- carrinho e Fly Assist não sobrepõem barra, teclado ou conteúdo;
- deep link abre o destino correto.

### Identidade

- convite ativa a conta correta;
- cliente A não acessa cliente B;
- funcionário não atribuído não acessa a viagem;
- dependente exige vínculo;
- biometria protege conteúdo compatível.

### Home

- estado muda por fase da viagem;
- próxima ação considera fuso local;
- evento publicado no painel aparece na Home;
- informação operacional tem prioridade.

### Minha Viagem

- alteração de roteiro aparece sem update do app;
- documentos privados permanecem privados;
- QR expira e não permite uso duplicado;
- Ready Check atualiza a equipe;
- dados essenciais funcionam offline.

### Passeios

- disponibilidade é confirmada no servidor;
- carrinho persiste;
- preço não é calculado apenas no cliente;
- pagamento duplicado não cria dois pedidos;
- compra aparece em Meus Passeios e na viagem quando aplicável.

### Carteira

- pontos usam ledger;
- reversão não apaga histórico;
- status e pontos não são confundidos;
- cartão mostra apenas referência tokenizada;
- tax-free é estimado, não garantido;
- ajustes sensíveis são auditados.

### Suporte

- chat chega à fila certa;
- SOS confirma recebimento;
- fallback funciona;
- localização é coletada apenas com permissão;
- cliente não vê posição exata da equipe.

### Álbum

- figurinha só libera por evento válido;
- Dia Completo respeita regra do painel;
- mídia respeita autorização;
- insight interno não aparece para o cliente.

---

## 33. Regras que nunca devem ser inventadas pelo Claude

- valores de status;
- fórmula de pontos;
- validade de pontos;
- critérios de ranking;
- prêmios;
- orçamento de encantamento;
- horário de roteiro;
- prazo de refeição;
- preço;
- câmbio;
- disponibilidade;
- política de cancelamento;
- contato de emergência;
- regra de tax-free;
- dado médico;
- integração governamental;
- localização de funcionário;
- papel/permissão;
- período de retenção;
- consentimento;
- texto jurídico;
- parceiro de pagamento;
- taxa financeira.

Se faltar uma regra, usar configuração/placeholder claramente marcado e registrar a decisão pendente. Nunca transformar suposição em regra de produção.

---

## 34. Prompt mestre para Claude Code

Copiar este prompt e disponibilizar este arquivo no repositório:

```text
Você é o lead engineer responsável pelo Fly App.

Antes de alterar código:
1. Leia integralmente docs/product/FLY_APP_MASTER_SPEC.md.
2. Leia CLAUDE.md, o decision log e a documentação existente.
3. Inspecione todo o repositório, worktree, scripts, versões e padrões.
4. Verifique a documentação oficial atual antes de instalar ou atualizar dependências.
5. Apresente o plano somente da fase solicitada, os arquivos afetados, riscos e critérios de aceite.

Contexto imutável:
- Fly App é o produto de viagem, concierge, comércio e relacionamento.
- Fly Cup é outro produto, focado em competições.
- Ambos compartilham Fly ID, pontos e contratos autorizados.
- A navegação inferior é Início, Passeios, Minha Viagem, Carteira e Perfil.
- Minha Viagem é o botão central elevado.
- Carrinho e Fly Assist/SOS são ações flutuantes.
- Fly Ops e Fly Crew operam o app; conteúdo crítico nunca fica hardcoded.
- A visão é o aplicativo completo, implementado em cortes verticais de produção.

Regras técnicas:
- TypeScript estrito.
- Preserve código existente e mudanças do usuário.
- Não reescreva o projeto sem decisão documentada.
- Separe UI, domínio, dados e integrações.
- Toda tela tem loading, empty, error, permission denied e offline quando aplicável.
- Use migrations versionadas e tipos gerados.
- RLS em toda tabela exposta.
- Teste acesso permitido e negado.
- Use chave publicável no cliente; nunca exponha secret/service_role.
- Papéis não usam metadados editáveis pelo usuário.
- Documentos sensíveis ficam em Storage privado.
- Dinheiro, créditos, pontos e status são domínios separados.
- Ledgers são append-only.
- Pagamentos, QR, pontos e webhooks são idempotentes.
- Nenhum preço, saldo, vencedor ou disponibilidade é confiado apenas ao cliente.
- Integrações externas usam adapter, sandbox, timeout, logs, fallback e feature flag.
- Não declare uma integração real sem credenciais, contrato, homologação e teste.
- Não implemente funcionalidades fora da fase solicitada.

Ao concluir:
1. Rode lint, typecheck, testes unitários, integração e E2E aplicáveis.
2. Execute os aplicativos afetados.
3. Faça verificação visual dos fluxos alterados.
4. Atualize documentação, schema, test matrix e decision log.
5. Informe o que foi comprovado, o que não foi testado e os riscos restantes.
6. Não avance para a próxima fase.
```

---

## 35. Prompt da Fase 0 - auditoria e fundação

```text
Execute somente a Fase 0 da especificação mestre.

Objetivo:
entender o estado real do repositório e criar uma fundação de produção para o
Fly App, Fly Ops e Fly Crew, sem reescrever código existente por impulso.

Entregas:
1. Audite estrutura, branches, worktree, dependências, ambientes, scripts e riscos.
2. Crie docs/architecture/REPO_AUDIT.md.
3. Identifique se Fly Cup está no mesmo repositório e documente a fronteira.
4. Proponha ADRs para monorepo, mobile, painel, backend, auth, offline e analytics.
5. Se o repositório estiver vazio, inicialize as aplicações com ferramentas oficiais atuais.
6. Configure TypeScript estrito, lint, format, testes e CI básico.
7. Configure variáveis por ambiente e arquivos de exemplo sem segredos.
8. Crie estrutura de packages compartilhados sem abstrações prematuras.
9. Configure banco local, migrations, seed e geração de tipos, sem criar ainda todos os domínios.
10. Crie observabilidade mínima e uma página de health/status para ambientes internos.
11. Copie a especificação para docs/product/FLY_APP_MASTER_SPEC.md.
12. Crie CLAUDE.md curto apontando para a especificação.

Não fazer:
- telas finais;
- banco inteiro em uma migration;
- pagamentos;
- carteira;
- IA;
- migração destrutiva de Fly Cup.

Critérios de aceite:
- cada aplicação inicia;
- lint, typecheck e testes base passam;
- CI executa;
- segredos estão ausentes do git;
- arquitetura e decisões estão documentadas;
- existe plano de migração seguro para qualquer código legado.
```

---

## 36. Prompt da Fase 1 - design system e navegação

```text
Execute somente a Fase 1.

Objetivo:
implementar a casca definitiva do produto com design system, rotas e estados
globais. Isto é fundação de produção, não uma demo descartável.

Entregas no Fly App:
1. Tokens preto, grafite, branco e dourado com contraste validado.
2. Tipografia, espaçamento, raio, sombra, brilho, ícones e motion tokens.
3. Barra inferior com Início, Passeios, Minha Viagem, Carteira e Perfil.
4. Botão central circular elevado para Minha Viagem.
5. Coluna flutuante com Carrinho e Fly Assist/SOS.
6. Rotas e layouts de todas as áreas principais.
7. Shell para estados loading, empty, error, offline e permission denied.
8. Tema, safe areas, teclado, leitores de tela e texto dinâmico.
9. Componentes fundamentais listados na especificação.
10. Fixtures fora dos componentes para validar estados visuais.

Entregas de qualidade:
- Storybook ou catálogo equivalente quando compatível;
- screenshots de iPhone, Android e web;
- testes de navegação;
- teste de áreas de toque;
- documentação dos tokens e componentes.

Critérios:
- cinco destinos exatos;
- central button não colide com safe area;
- ações flutuantes não escondem conteúdo;
- teclado não cobre chat/formulários;
- interface funciona em telas pequenas e grandes;
- lint, typecheck, testes e verificação visual passam.
```

---

## 37. Prompt da Fase 2 - Fly ID, onboarding e Perfil

```text
Execute somente a Fase 2.

Objetivo:
entregar identidade real, onboarding, Perfil, consentimentos e autorização.

Entregas:
1. Fly ID por convite, e-mail/telefone e deep link.
2. Sessão persistente segura e biometria quando suportada.
3. Profiles, roles, assignments, devices, consents, emergency contacts,
   companionships e preferences com migrations.
4. RLS por dono, papel, atribuição e vínculo familiar.
5. Testes positivos e negativos de cada política.
6. Onboarding em etapas e curadoria de preferências.
7. Perfil com QR pessoal, dados, preferências, viagens vazias, conquistas vazias,
   ranking opt-in, privacidade, notificações e Quem Somos.
8. Fluxo de dependentes e acompanhantes.
9. Painel Fly Ops para convidados, clientes, onboarding, papéis e consentimentos.
10. Auditoria de alterações sensíveis.
11. Exclusão, logout e revogação de sessão.

Regras:
- não guardar autorização em user_metadata;
- não tornar perfil completo público;
- preferências internas de surpresa não são visíveis a outros clientes;
- dados de menores exigem regra específica;
- QR pessoal usa identificador opaco.

Critérios:
- convite correto ativa o usuário correto;
- conta duplicada é tratada;
- cliente A não lê cliente B;
- guia sem atribuição não lê viagem/cliente;
- responsável acessa somente dependentes autorizados;
- mudança de consentimento afeta o acesso;
- fluxo funciona em iOS, Android e web aplicável.
```

---

## 38. Prompt da Fase 3 - Home, eventos e notificações

```text
Execute somente a Fase 3.

Objetivo:
entregar Home dinâmica e Acontece na Fly com dados administráveis.

Entregas:
1. Estados sem viagem, pré-viagem, durante e pós-viagem.
2. Regra server-driven para escolher o estado e a próxima ação.
3. Header com status/pontos como placeholders contratuais, sem saldo inventado.
4. Cards de alertas, memória, recomendação e atalhos contextuais.
5. Acontece na Fly com lista e detalhe.
6. Eventos, categorias, participantes, mídia, CTAs e interesses no banco.
7. Fly Ops para publicar, ordenar, segmentar e retirar eventos.
8. Deep link para Fly Cup e fallback quando não instalado.
9. Central de notificações e preferências.
10. Push e links contextuais com ambiente de teste.
11. Analytics da Home, eventos e notificações.

Fixtures/seed:
- Fly Cup Futevôlei;
- Fly Cup Fut 7;
- Fly Cup Kart, Surf, Basquete, Skate, Tênis, Paintball e Airsoft;
- Legends Dubai Cup / Showbol;
- Fly Summit;
- viagem oficial de Dubai.

Critérios:
- Home muda corretamente por estado;
- próximo passo considera fuso;
- evento publicado aparece sem nova build;
- CTA abre destino certo;
- evento encerrado respeita regra de exibição;
- notificação abre contexto ou pede login e retorna ao contexto;
- marketing não substitui alerta crítico.
```

---

## 39. Prompt da Fase 4 - Minha Viagem

```text
Execute somente a Fase 4.

Objetivo:
entregar o coração operacional: Minha Viagem, roteiro, inclusões, documentos,
voos, hotel, transfer, QR, presença e offline.

Entregas no cliente:
1. Tela raiz com Agora/Próximo, dias, timeline, alertas e progresso.
2. Hub completo de Minha Viagem.
3. Roteiro por dia e detalhe de atividade.
4. Tudo que está incluso.
5. Voos e Modo Aeroporto.
6. Hotel e transfer.
7. Cofre privado.
8. Scanner de passaporte com captura, OCR opcional e revisão.
9. Tickets e QR.
10. Ready Check, atraso e grupo não encontrado.
11. Acompanhantes.
12. cache offline protegido e indicador de versão.

Entregas no Fly Ops/Crew:
1. CRUD de viagens, grupos, membros, inclusões, dias e atividades.
2. Templates de roteiro.
3. Publicação e revisão.
4. Segmentação por cliente/grupo.
5. Upload de documento privado e grant de acesso.
6. Emissão, expiração, revogação e leitura de QR.
7. Scanner Crew e check-in manual com justificativa.
8. Painel Ready Check e presença.
9. Alteração de horário com push e confirmação.

Segurança:
- Storage privado;
- URLs temporárias;
- RLS e logs;
- token opaco;
- proteção contra uso duplicado;
- nenhuma imagem de passaporte em analytics/log.

Critérios:
- cliente vê somente a viagem correta;
- mudança no painel aparece no app;
- horário usa fuso certo;
- documento sem grant é negado;
- QR expirado/usado é recusado;
- check-in cria log;
- Ready Check atualiza Crew;
- essenciais abrem em modo avião;
- reconexão não duplica ações.
```

---

## 40. Prompt da Fase 5 - Passeios, carrinho e pedidos

```text
Execute somente a Fase 5.

Objetivo:
entregar Passeios como catálogo e canal comercial completo.

Entregas:
1. Tela Passeios com barra Meus Passeios, filtros, Trend, recomendados,
   Fly Exclusives, perto de você e ofertas.
2. Busca e paginação por cursor.
3. Card e detalhe completos.
4. Favoritos.
5. Disponibilidade, variantes e participantes.
6. Carrinho persistente com contador flutuante.
7. Reserva temporária de inventário.
8. Cupom, crédito e pontos por contratos separados.
9. Checkout com provedor em sandbox por adapter.
10. Pedido, pagamento, webhook idempotente, confirmação, cancelamento e reembolso.
11. Meus Passeios e inclusão na viagem.
12. Solicitação de proposta para experiências especiais.
13. Fly Ops para catálogo, mídia, inventário, preço, fornecedor, pedido e reembolso.

Regras:
- preço e disponibilidade no servidor;
- moeda explícita;
- hold expira;
- um webhook repetido não duplica pedido;
- cartão é tokenizado;
- segredo só no servidor;
- política de cancelamento é versionada com o pedido.

Critérios:
- busca e filtros funcionam;
- carrinho sobrevive à sessão;
- slot esgotado não vende;
- concorrência não ultrapassa inventário;
- pagamento sandbox gera um pedido;
- repetição do webhook continua em um pedido;
- pedido aparece em Meus Passeios e Carteira;
- reembolso gera evento e não apaga histórico.
```

---

## 41. Prompt da Fase 6 - Carteira e fidelidade

```text
Execute somente a Fase 6.

Objetivo:
entregar Carteira com valor rastreável, sem misturar pontos, status, crédito e dinheiro.

Entregas:
1. Resumo da Carteira.
2. Fly Points com ledger append-only.
3. Fly Status, placas e progresso.
4. Benefícios, inventário, elegibilidade e resgate.
5. Vouchers e cupons.
6. Compras, pagamentos e reembolsos vindos da Fase 5.
7. Referências tokenizadas de métodos de pagamento.
8. Feature flag e contrato para adicionar crédito financeiro.
9. Ranking opt-in e períodos.
10. Premiação configurável e finalistas.
11. Scanner de nota, OCR sandbox, revisão e detecção inicial de duplicidade.
12. Casos de tax-free com status e estimativa.
13. Fly Ops para regras, ajustes, recompensas, ranking, recibos e auditoria.

Regras:
- points_ledger, wallet_entries e status_progress são diferentes;
- nunca UPDATE destrutivo em lançamento;
- ajuste gera lançamento compensatório;
- idempotency key obrigatória;
- regra de pontos/versionamento registrada no lançamento;
- saldo financeiro e Fly Card ficam desligados sem parceiro;
- tax-free não promete 5% integral;
- ranking público não mostra gasto exato por padrão.

Critérios:
- compra elegível lança pontos uma vez;
- webhook repetido não pontua duas vezes;
- reembolso cria reversão;
- saldo fecha com o ledger;
- resgate atômico não permite saldo negativo;
- benefício sem estoque é recusado;
- usuário fora do ranking não aparece;
- nota duplicada é sinalizada;
- ajuste interno exige papel e auditoria.
```

---

## 42. Prompt da Fase 7 - gastronomia, reservas e serviços

```text
Execute somente a Fase 7.

Objetivo:
entregar refeições da viagem, restaurantes e solicitações de estilo de vida.

Entregas:
1. Cardápio por dia, refeição e fornecedor.
2. Escolha, personalização permitida e restrições.
3. Lembrete e confirmação.
4. Prazo configurável.
5. Seleção por acompanhante.
6. Estados locked, enviado ao fornecedor e entregue.
7. Reservas de restaurantes.
8. Pedidos especiais.
9. Catálogo de farmácia, mercado, beleza, spa e serviços.
10. Solicitação manual e adapters de parceiro desligados por feature flag.
11. Fly Ops para cardápio, pendências, consolidação e exceções.
12. Fly Crew para conferir e marcar entrega.

Critérios:
- cliente vê apenas refeições elegíveis;
- restrição alimentar é destacada para papel autorizado;
- prazo bloqueia alteração comum;
- exceção exige justificativa;
- painel totaliza corretamente por opção/fornecedor;
- push abre a refeição certa;
- parceiro indisponível oferece fallback humano.
```

---

## 43. Prompt da Fase 8 - mapa, concierge e SOS

```text
Execute somente a Fase 8.

Objetivo:
entregar localização contextual, Bases Fly, chat, ajuda urgente e SOS.

Entregas:
1. Mapa com atrações, roteiro, bases, parceiros, clínicas e Fly Quest.
2. Deep links de rota.
3. Bases Fly com serviços, horários e status.
4. Chat por viagem, atividade e pedido.
5. Fila Conversa, Ajuda urgente e SOS.
6. Solicitação contextual de localização.
7. Atribuição, aceite, resposta, escalonamento e resolução.
8. Fallback de ligação e contatos oficiais.
9. Fly Crew para receber, aceitar e operar casos.
10. Fly Ops com SLA, fila, incidentes e relatórios.
11. Notificações em tempo real.
12. Modo degradado/offline.

Regras:
- localização mínima e consentida;
- não mostrar posição exata de funcionário ao cliente;
- cliente só entra em threads autorizadas;
- canal Realtime é privado/autorizado;
- mensagem e localização não entram em analytics;
- SOS não promete substituir emergência pública.

Critérios:
- mensagem chega à thread correta;
- usuário estranho é negado;
- ajuda urgente recebe prioridade;
- SOS confirma recebimento;
- equipe aceita e atualiza status;
- ligação funciona sem chat;
- perda de conexão é tratada;
- tempos ficam auditados.
```

---

## 44. Prompt da Fase 9 - álbum, Fly Quest e encantamento

```text
Execute somente a Fase 9.

Objetivo:
entregar a assinatura emocional da Fly.

Entregas:
1. Álbum por viagem.
2. Capítulos por dia.
3. Figurinhas comuns, raras, secretas e holográficas.
4. Regras obrigatórias/opcionais.
5. Unlock por check-in, QR ou ação autorizada.
6. Dia Completo server-side.
7. Card vertical de compartilhamento.
8. Galeria por viagem/dia/experiência.
9. Upload e marcação manual.
10. Grants de mídia e autorização de imagem.
11. Fly Quest com missões, QR e pontos.
12. Insights de escuta ativa no Fly Crew.
13. Tarefas de surpresa, orçamento, aprovação e entrega no Fly Ops.
14. Pacote de boa-noite e teaser do próximo capítulo.
15. Modo Influenciador com missões, collabs e métricas.
16. Analytics de experiência sem expor conteúdo privado.

Critérios:
- figurinha não libera sem evento válido;
- repetição não duplica unlock/pontos;
- Dia Completo segue configuração;
- cliente vê somente mídia liberada;
- revogação de imagem afeta acesso/publicação;
- insight interno nunca chega ao app;
- surpresa segue papéis e orçamento;
- modo Influenciador aparece só para habilitados.
```

---

## 45. Prompt da Fase 10 - inteligência e integrações avançadas

```text
Execute somente a Fase 10.

Pré-condição:
os domínios de identidade, viagem, comércio, carteira e suporte têm dados confiáveis.

Objetivo:
adicionar inteligência sem permitir que IA invente operação.

Entregas:
1. Assistente Fly com ferramentas de leitura autorizada.
2. Respostas fundamentadas em roteiro, catálogo e políticas.
3. Handoff para humano.
4. Recomendações com motivo e feedback.
5. Tradução de texto e câmera por adapter.
6. Fly Social privado e opt-in com moderação.
7. Planejador financeiro separando gastos manuais e oficiais.
8. Mala Pronta por roteiro/clima.
9. Fly Capsule e Story do Dia.
10. Integrações avançadas apenas em sandbox/feature flags até homologação.
11. Avaliação de qualidade, prompt injection, privacidade e custo.

Regras:
- IA não recebe passaporte, cartão, saúde ou localização exata por padrão;
- IA não cria preço, horário, disponibilidade ou regra;
- ação mutável exige confirmação;
- toda tool tem autorização;
- conteúdo social tem denúncia, bloqueio e moderação;
- integração não homologada permanece desligada.

Critérios:
- resposta cita a fonte interna/horário correto;
- dado não autorizado não entra no contexto;
- prompt malicioso não acessa outra viagem;
- handoff preserva contexto permitido;
- recomendação pode ser recusada;
- custos e falhas são observáveis.
```

---

## 46. Prompt da Fase 11 - consolidação Fly Ops e Fly Crew

```text
Execute somente a Fase 11.

Objetivo:
garantir que toda função do cliente seja realmente operável pela equipe.

Entregas:
1. Auditoria de paridade App <-> Ops <-> Crew.
2. Dashboard Hoje.
3. Busca global e filtros.
4. Filas, tarefas e SLAs.
5. Papéis e atribuições completos.
6. Relatórios de viagem, comércio, suporte, experiência, eventos e patrocinadores.
7. Inventário de press kits, brindes e recompensas.
8. Escala e handoff de equipe.
9. Logs de auditoria legíveis.
10. Feature flags e configuração por ambiente/viagem.
11. Exportações autorizadas.
12. Runbooks e treinamento.
13. Simulação de um dia completo de operação.

Critérios:
- nenhuma mudança comum exige editar código;
- cada tela crítica tem proprietário operacional;
- papel mínimo executa a tarefa e nada além;
- ação de alto risco exige aprovação;
- relatório reconcilia com ledgers;
- equipe consegue operar falha de internet/integração;
- simulação encontra e resolve bloqueadores.
```

---

## 47. Prompt da Fase 12 - hardening e lançamento

```text
Execute somente a Fase 12. Não adicione features.

Objetivo:
preparar lançamento confiável.

Checklist:
1. Threat model e revisão de autorização.
2. Testes RLS permitidos/negados.
3. Storage e URLs assinadas.
4. Segurança de Edge Functions, webhooks, QR e deep links.
5. SAST, dependências, secrets scan e lockfile.
6. Performance mobile, banco, imagens e Realtime.
7. Índices e queries observadas.
8. Testes unitários, integração, contrato e E2E.
9. Modo avião, reconexão, timeout e parceiro indisponível.
10. Acessibilidade.
11. iPhone e Android reais.
12. Privacidade, consentimento e retenção.
13. Backup, recuperação e incident response.
14. App Store/Play Store, política e screenshots.
15. Versão web de contingência.
16. Runbook, suporte e rollback.
17. Release candidate congelada.

Somente considerar pronto com evidência dos critérios, lista de riscos aceitos e
responsáveis. Não esconder teste não realizado.
```

---

## 48. Prompt de estabilização do piloto de setembro

```text
Faça somente estabilização do piloto de 10 a 17 de setembro de 2026.
Não adicione funcionalidades.

Valide:
- convite e Fly ID;
- onboarding;
- Home durante viagem;
- Minha Viagem;
- mudança de roteiro;
- documentos;
- QR;
- Ready Check;
- refeições;
- notificações;
- chat e ajuda;
- SOS/fallback;
- álbum básico;
- evento na Home;
- modo offline;
- permissões negadas;
- logs e alertas.

Teste em iPhone e Android reais com dados dos participantes.
Treine a equipe Fly Crew.
Gere manual curto para cliente e equipe.
Congele a versão.
Registre plano de contingência e canais alternativos.
```

---

## 49. Backlog integral por horizonte

### Horizonte A - comandar a viagem

- Fly ID;
- Home;
- Minha Viagem;
- documentos;
- roteiro;
- QR;
- refeições;
- notificações;
- Ready Check;
- offline;
- suporte.

### Horizonte B - vender e fidelizar

- Passeios;
- carrinho;
- checkout;
- Carteira;
- pontos;
- status;
- benefícios;
- ranking;
- notas/tax-free;
- eventos.

### Horizonte C - encantar

- álbum;
- galeria;
- Dia Completo;
- boa-noite;
- Fly Quest;
- influenciadores;
- surpresas;
- cápsula;
- embaixadores.

### Horizonte D - superapp

- wallet financeira;
- Fly Card;
- mobilidade;
- delivery;
- telemedicina;
- mapa 3D;
- IA;
- tradução;
- Fly Social;
- marketplace;
- integrações governamentais.

Horizontes são ordem de ativação, não exclusão de escopo.

---

## 50. Decisões pendentes do dono do produto

1. Nome exibido: Fly, Fly App ou Go Fly Dubai.
2. Logo e manual final.
3. Domínio e IDs das lojas.
4. Idiomas de lançamento.
5. Provedor de pagamento.
6. Regra de Pix.
7. Parceiro para saldo/Fly Card.
8. Fórmula de pontos.
9. Níveis e validade.
10. Prêmios e orçamento.
11. Ranking público.
12. Provedor de mapa.
13. Provedor de voo.
14. Provedor de OCR.
15. Processo real de tax-free.
16. Responsável e SLA de SOS.
17. Retenção de passaporte, localização, saúde e recibos.
18. Processo de menores/acompanhantes.
19. Consentimento de imagem.
20. Integração real com Fly Cup.
21. Fluxo financeiro de upsell e reembolso.
22. Quem publica eventos.
23. Responsáveis por Fly Ops e Fly Crew.
24. Plano de contingência.

Essas decisões devem virar registros no decision log. O Claude não deve bloqueá-las todas de uma vez; deve perguntar somente o que afeta a fase atual.

---

## 51. Fontes do produto

- Livro FLY, especialmente jornada do cliente, aplicativo, press kit, bases, pré-viagem e álbum.
- Materiais Fly Cup de Futevôlei, Fut 7, Kart, Surf, Basquete, Skate, Tênis, Paintball e Airsoft.
- Calendários e documentos operacionais Fly Cup.
- Fly Summit.
- decisões anteriores sobre dois aplicativos e Fly ID único;
- álbum físico e digital;
- Dia Completo;
- pacote de boa-noite;
- escuta ativa de encantamento;
- viagem com influenciadores e métricas;
- eventos Fly e estratégia de transformar entretenimento em desejo por Dubai.

### Referências técnicas oficiais

- [Expo](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Supabase com Expo React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase API Keys](https://supabase.com/docs/guides/getting-started/api-keys)

---

## 52. Resumo final

O Fly App deve nascer com uma arquitetura capaz de chegar ao superapp, mas com cada função entregue em produção de forma comprovável.

A estrutura definitiva é:

- **Início** para orientar e conectar o ecossistema;
- **Passeios** para explorar e comprar;
- **Minha Viagem** no centro para comandar a jornada;
- **Carteira** para concentrar valor e benefícios;
- **Perfil** para identidade, status e relacionamento;
- **Carrinho** e **Fly Assist/SOS** sempre acessíveis;
- **Fly Ops** e **Fly Crew** operando tudo por trás.

O resultado não é um aplicativo de agência. É a camada digital do ecossistema Fly: conduz a viagem, aumenta receita, protege o cliente, organiza a equipe, transforma consumo em relacionamento e transforma cada dia em uma história.

**Direção final:** especificar tudo, construir por fases, testar cada corte e nunca confundir velocidade com fazer tudo em um único prompt.

