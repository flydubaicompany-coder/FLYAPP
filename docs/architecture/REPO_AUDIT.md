# Auditoria do repositório

**Data:** 24 de agosto de 2026
**Escopo:** Fase 0 da especificação mestre (§35, entrega 1 e 2)
**Autor:** Claude Code, sob revisão de Victor / Fly

---

## 1. Ponto de partida

A pasta de trabalho `/Users/psg.vito/Downloads/FLY` **não é um repositório
git**. São 265 entradas na raiz e cerca de 47 GB de material de produção:
PSD, PSB (um deles com 4,5 GB), MP4, MOV, PDF e PNG.

Rodar `git init` ali colocaria arquivos de gigabytes sob controle de versão.
Por isso o monorepo nasceu **isolado**, em `Downloads/FLY/fly-ecosystem/`,
como irmão dos projetos que já existiam — nunca como pai deles.

## 2. Projetos de código encontrados

| Projeto              | Stack                                                                      | Git                              | Deploy | Situação                                                         |
| -------------------- | -------------------------------------------------------------------------- | -------------------------------- | ------ | ---------------------------------------------------------------- |
| `appflycompany/`     | Expo 57.0.14, expo-router, React 19.2.3, RN 0.86.2, TS estrito, ~6.027 LOC | sim — 3 commits, `origin/master` | Vercel | **Outro produto.** Fora do escopo por decisão do dono (ADR 0002) |
| `fly-cup/`           | Vite 5, React 18, Tailwind 3, Supabase                                     | **nenhum**                       | Vercel | Site do Fly Cup, porta 5177                                      |
| `legends-dubai-cup/` | idem                                                                       | sim                              | Vercel | Site do Legends Dubai Cup                                        |

### 2.1 Sobre o `appflycompany`

Vale registrar o que ele é, já que o nome sugere ser o Fly App:

- abas: Início, Transporte, Alimentação, Passeios, Perfil — **não** são as cinco
  da §4 da spec (falta Minha Viagem e Carteira);
- tema branco dominante com azul `#0B72B5` de destaque — o oposto da direção
  preto/grafite/dourado da §25;
- 894 linhas de dados mockados em `src/data/mockData.ts`;
- sem Supabase, sem testes, sem lint, sem CI;
- `CLAUDE.md` de uma linha, apontando para um `AGENTS.md` que só alerta
  "Expo HAS CHANGED — leia a doc versionada".

O dono do produto classificou-o como **um app diferente**. Ele não foi copiado,
migrado nem alterado. Continua exatamente como estava.

**Colisão a registrar:** `appflycompany/app.json` declara `scheme: "fly"`, e o
novo `apps/fly-mobile/app.json` também. Em um mesmo aparelho apenas um dos dois
resolve deep links `fly://`. Se os dois forem instalados juntos, um dos schemes
precisa mudar — decisão do dono, registrada como pendente.

### 2.2 Fronteira com o Fly Cup (entrega §35.3)

`fly-cup/` e `legends-dubai-cup/` são aplicações web independentes: Vite,
React 18, Tailwind, Supabase próprio, deploy próprio. Não compartilham nenhuma
linha com o Fly App.

**Não há código legado a migrar.** A fronteira é a que a §2.3 da spec já define:
contrato de dados, deep link e Fly ID compartilhado. Detalhamento em
[ADR 0008](adr/0008-fronteira-fly-cup.md).

## 3. Ferramental da máquina

| Ferramenta     | Situação                                                         |
| -------------- | ---------------------------------------------------------------- |
| Node           | v24.14.0                                                         |
| npm            | 11.9.0                                                           |
| GitHub CLI     | 2.98.0                                                           |
| Supabase CLI   | **ausente** → instalada como devDependency do monorepo (2.115.0) |
| Vercel CLI     | ausente                                                          |
| Docker         | **ausente** — bloqueia `supabase start`                          |
| Postgres local | ausente                                                          |

Consequência direta: as migrations e os testes de RLS foram escritos e
versionados, mas **não puderam ser executados nesta máquina**. Ver a seção 6.

## 4. Segredos

Varredura feita antes do primeiro commit.

- `appflycompany/.env.local` contém apenas `VERCEL_OIDC_TOKEN` e está coberto
  pelo `.gitignore` daquele projeto (`.env*`). Nada exposto.
- `fly-cup/` e `legends-dubai-cup/` têm `.env.local` e `.env.local.example`.
- Uma chave **publicável** do Supabase (`sb_publishable_…`, projeto
  `ezfmvblirhmootdvqmsr`) aparece dentro de uma regra de permissão em
  `.claude/settings.local.json`. Chave publicável não é segredo — ela é
  desenhada para ir ao cliente — mas está registrada no
  [threat model](../security/THREAT_MODEL.md) porque revela qual projeto
  Supabase os sites usam.
- **Nenhum segredo versionado foi encontrado.**

No monorepo novo, `.env*` está no `.gitignore` com exceção explícita para
`.env.example`, e a esteira de CI falha se algum `.env` for versionado.

## 5. Design importado

Projeto Claude Design **"Fly App mobile premium"**
(`8687d656-962d-4c07-a041-d985666c3d1d`), acessível com permissão de escrita.

| Arquivo             | Papel                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `Fly App.dc.html`   | Página de canvas: paleta, Fly Status, tipografia, material e geometria |
| `Fly Phone.dc.html` | O protótipo navegável, 67 KB, com as telas de verdade                  |
| `assets/`           | 4 PNGs de marca e 5 fotos                                              |
| `uploads/`          | 5 imagens enviadas pelo dono                                           |
| `support.js`        | Runtime do canvas do Claude Design — não é código do produto           |

Os dois `.dc.html` foram versionados em `docs/design/canvas/`.

**O achado que mais importa:** o protótipo já implementa a navegação definitiva
da §4 — telas `home`, `passeios`, `meus`, `viagem`, `carteira`, `perfil`, com
botão central, carrinho com contador, folha de SOS, chips de categoria e
carrossel arrastável. Ele é um alvo válido e concreto para a Fase 1.

O protótipo declara, no próprio texto, que "passeios, eventos, preços e datas
são fictícios". Nada dali vira dado de produção (spec §33).

## 6. O que foi comprovado

| Item                                                   | Situação                                             |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `npm run verify` (lint + tipos + 66 testes)            | **Executado, passa**                                 |
| `npm run build` das três aplicações                    | **Executado, passa**                                 |
| `npm audit`                                            | **Executado, zero vulnerabilidades**                 |
| Migration aplicada em banco real                       | **Executada** no projeto `ewgbseesocekvhiiscnb`      |
| RLS: 22 asserções positivas e negativas                | **Executadas, todas OK** — ver seção 6.1             |
| Tipos gerados do banco                                 | **Gerados** e versionados em `packages/domain-types` |
| Paridade entre `FLY_ROLES` e o enum `fly_role`         | **Testada** — quebra o build se divergir             |
| Seed aplicado                                          | **Executado** — 5 flags e 5 chaves de config         |
| Advisor de segurança do Supabase                       | **Executado** — 1 aviso INFO, intencional (ver 6.2)  |
| Fly Ops contra o backend real, `/health` "Operacional" | **Executado, verificado em tela**                    |
| Fly Crew sobe e serve `/health`                        | **Executado**                                        |

### 6.1 O que a execução da RLS revelou

Rodar de verdade encontrou um **bug no teste**, não na policy — e vale registrar,
porque é uma armadilha fácil de repetir.

Duas asserções usavam `throws_ok` para "cliente não escreve em `app_config`".
Elas falharam. Investigando: **RLS em `UPDATE` filtra linhas, não lança
exceção.** Um `UPDATE` sem linha visível afeta zero linhas e retorna sucesso.

Reteste com a pergunta certa — quantas linhas foram afetadas, e o valor mudou?

| Verificação                             | Resultado             |
| --------------------------------------- | --------------------- |
| cliente `UPDATE` em `app_config`        | 0 linhas afetadas     |
| cliente `INSERT` em `app_config`        | bloqueado com exceção |
| cliente `DELETE` em `app_config`        | 0 linhas afetadas     |
| guia `UPDATE` em `app_config`           | 0 linhas afetadas     |
| valor de `teste.publico` depois de tudo | intacto               |
| valor de `teste.interno` depois de tudo | intacto               |
| chave injetada pelo cliente             | não existe            |

**As policies estavam corretas.** O teste em
`supabase/tests/foundation_rls.test.sql` foi corrigido para checar o efeito em
vez da exceção, com um comentário explicando por quê — para que ninguém
"conserte" a policy achando que o teste estava certo.

### 6.2 O aviso do advisor

`rls_enabled_no_policy` em `public.idempotency_keys`, nível INFO.
**Intencional:** a tabela é de uso exclusivo do servidor. Ela tem RLS ligada,
`force row level security`, nenhuma policy e nenhum `GRANT` — três camadas
dizendo a mesma coisa. O teste `NEGATIVO: idempotency_keys inacessivel`
confirma que o cliente esbarra em `42501`.

### 6.3 A esteira fechou o que faltava

O CI tem Docker. Na primeira execução verde, a suíte pgTAP completa rodou:

```
foundation_rls.test.sql .. ok
All tests successful.
Files=1, Tests=31, Result: PASS
```

Com isso, migrations, seed, lint de schema e as 31 asserções de RLS passaram a
ser verificados a cada push — sem depender de Docker na máquina de ninguém.

### 6.4 O que continua não comprovado

| Item                                         | Bloqueio                                                            |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Supabase local na máquina de desenvolvimento | Docker ausente. O CI cobre; o ciclo local depende do projeto remoto |
| Rollback da migration                        | precisa de banco descartável, logo de Docker local                  |
| Fly App em simulador iOS ou aparelho Android | não executado; validado no navegador a 375×812                      |
| Testes de componente do React Native         | `jest-expo` entra na Fase 2                                         |

## 7. Riscos abertos

| #   | Risco                                                                                                                                                                       | Gravidade |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| R1  | **Prazo.** O piloto é 10–17/09/2026 e hoje é 24/08. Restam 17 dias para as Fases 0–4 mais partes da 7, 8 e 9 (§30). Levantado com o dono, que decidiu seguir.               | Alta      |
| R2  | Docker ausente: sem banco local, o ciclo de desenvolvimento depende do projeto remoto — arriscado quando houver dado real.                                                  | Média     |
| R3  | `fly-cup/` sem controle de versão — qualquer alteração ali é irreversível.                                                                                                  | Média     |
| R4  | O monorepo mora em `Downloads`, pasta sujeita a limpeza. Mitigado: já existe remote no GitHub.                                                                              | Baixa     |
| R5  | O scaffold do Expo traz `uuid@7` vulnerável (GHSA-w5hq-g745-h8pq) por baixo de `@expo/config-plugins`. Resolvido com `overrides` para `uuid@^11.1.1`; reavaliar a cada SDK. | Baixa     |
| R6  | Colisão de `scheme: "fly"` entre `appflycompany` e `apps/fly-mobile`.                                                                                                       | Baixa     |
| R7  | `typescript-eslint` estável ainda não suporta TypeScript 7. O monorepo ficou em TS 6.0.3 — ver [ADR 0001](adr/0001-monorepo.md).                                            | Baixa     |
| R8  | O projeto Supabase é único: sem ambiente separado de staging e produção. Resolver antes de dado real de cliente.                                                            | Média     |

## 8. O que este repositório não faz

Nada fora de `fly-ecosystem/` foi criado, alterado ou removido. Os ~47 GB de
mídia, `appflycompany/`, `fly-cup/` e `legends-dubai-cup/` estão exatamente
como estavam antes desta fase.
