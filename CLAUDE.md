# CLAUDE.md — ecossistema Fly

A fonte oficial do produto é **[docs/product/FLY_APP_MASTER_SPEC.md](docs/product/FLY_APP_MASTER_SPEC.md)**.
Leia-a antes de alterar código. Este arquivo não a substitui nem a resume: ele
lista as regras que nunca mudam e diz onde procurar o resto.

## Onde o trabalho parou

**Sempre leia [docs/ESTADO.md](docs/ESTADO.md) primeiro.** Ele diz qual fase
está aberta, o que falta nela e o que já foi provado — e é mantido a cada
fase. Sem ele, uma sessão nova refaz o que existe ou pula o que falta.

## Antes de tocar em código

1. Leia a especificação mestre.
2. Leia o [decision log](docs/architecture/DECISION_LOG.md) e os [ADRs](docs/architecture/adr/).
3. Leia a [auditoria do repositório](docs/architecture/REPO_AUDIT.md).
4. Confira a documentação oficial e versionada antes de instalar ou atualizar dependência.
5. Apresente o plano **apenas da fase pedida**, com arquivos afetados, riscos e critérios de aceite.

## Contexto imutável

- **Fly App** é o produto de viagem, concierge, comércio e relacionamento.
- **Fly Cup** é outro produto, focado em competições. Fronteira: contrato, deep link e Fly ID — ver [ADR 0008](docs/architecture/adr/0008-fronteira-fly-cup.md).
- A navegação inferior é **Início · Passeios · Minha Viagem · Carteira · Perfil**.
- **Minha Viagem** é o botão central elevado.
- **Carrinho** e **Fly Assist/SOS** são ações flutuantes.
- Fly Ops e Fly Crew operam o app. Conteúdo crítico **nunca** fica hardcoded.
- A visão é o app completo, entregue em cortes verticais de produção.

## Regras técnicas

- TypeScript estrito em todo lugar.
- Preserve o código existente e as mudanças do usuário. Não reescreva o projeto sem decisão registrada.
- Separe UI, domínio, dados e integrações.
- Toda tela trata carregando, vazio, erro, permissão negada e offline quando aplicável.
- Migrations versionadas e tipos gerados (`npm run db:types`).
- RLS em toda tabela exposta. RLS e GRANT são controles diferentes — configure os dois.
- Teste acesso permitido **e** negado.
- No cliente, só a chave **publicável**. Nunca a secreta, nunca a `service_role`.
- Papel vive em tabela protegida, jamais em metadado editável pelo usuário.
- Documentos sensíveis ficam em Storage privado.
- Dinheiro, créditos, pontos e status são domínios separados. Ledgers são append-only.
- Pagamento, QR, pontos e webhook são idempotentes.
- Preço, saldo, vencedor e disponibilidade nunca são decididos só no cliente.
- Integração externa usa adapter, sandbox, timeout, log, fallback e feature flag.
- Não declare integração real sem credencial, contrato, homologação e teste.
- **Não implemente nada fora da fase pedida.**

## O que nunca inventar

Valores de status, fórmula e validade de pontos, critérios de ranking, prêmios,
orçamento de encantamento, horário de roteiro, prazo de refeição, preço, câmbio,
disponibilidade, política de cancelamento, contato de emergência, regra de
tax-free, dado médico, integração governamental, localização de funcionário,
papel ou permissão, período de retenção, consentimento, texto jurídico, parceiro
de pagamento, taxa financeira.

Faltando uma regra: use configuração ou placeholder marcado e registre a
pendência no decision log. Suposição não vira regra de produção. (Spec §33.)

## Design

O visual vem do Claude Design, versionado em `docs/design/canvas/`. Os tokens
estão em `packages/design-tokens` e são conferidos contra o arquivo do design
nos testes daquele package. Procedência e ressincronização: [docs/design/DESIGN_SOURCE.md](docs/design/DESIGN_SOURCE.md).

O dourado `#DFC98A` aparece em **cinco lugares e em nenhum outro**: kicker do
evento, selo Exclusivo Fly, chip selecionado, progresso para o próximo nível de
Fly Points e o anel do botão central. Um sexto uso precisa de decisão
registrada.

**Pacote e nível são escalas diferentes.** Standard, Black e Billionaire são o
**pacote** que o cliente adquiriu. Basic, prime e elite são o **nível de Fly
Points**, que se sobe acumulando. Estiveram misturados até 27/08/2026 — ver
D95.

## Comandos

```bash
npm install          # instala o workspace inteiro
npm run verify       # lint + typecheck + testes
npm run build        # build de todas as aplicações
npm run dev:ops      # Fly Ops   em http://localhost:5180
npm run dev:crew     # Fly Crew  em http://localhost:5181
npm run dev:mobile   # Fly App   (Expo)
npm run db:start     # Supabase local (exige Docker)
npm run db:reset     # aplica migrations + seed
npm run db:test      # testes de RLS
npm run db:types     # regenera packages/domain-types/src/database.types.ts
```

## Ao concluir uma fase

1. Rode lint, typecheck e testes.
2. Execute as aplicações afetadas.
3. Verifique visualmente os fluxos alterados.
4. Atualize documentação, schema, [test matrix](docs/quality/TEST_MATRIX.md) e decision log.
5. Informe **o que foi comprovado, o que não foi testado e os riscos restantes**.
6. **Não avance para a próxima fase.**
