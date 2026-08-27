# Runbook — Fly Ops

Estado em 24/08/2026. Na Fase 0 o Fly Ops ainda não opera nada: ele sobe, se
identifica e reporta saúde. Este runbook cobre o que existe e reserva o lugar
do que vem.

## Subir o ambiente

```bash
npm install
npm run dev:ops     # http://localhost:5180
npm run dev:crew    # http://localhost:5181
npm run dev:mobile  # Expo
```

Antes do primeiro `dev`, copie `.env.example` para `.env.local` em cada app e
preencha. Sem isso a aplicação sobe e mostra, de propósito, uma tela dizendo
qual variável falta — falhar em silêncio seria pior.

## Banco

```bash
npm run db:start   # Supabase local (exige Docker)
npm run db:reset   # aplica migrations + seed
npm run db:test    # RLS: casos permitidos e negados
npm run db:types   # regenera packages/domain-types/src/database.types.ts
npm run db:stop
```

**Docker ainda não está instalado nesta máquina** (pendência P01). Até que
esteja, migrations e RLS permanecem não verificadas.

Depois de qualquer alteração de migration, rode `npm run db:types` e versione o
resultado — a CI falha se os tipos estiverem desatualizados.

## Health

Cada aplicação serve `/health` com serviço, ambiente, versão, commit, host do
backend e resultado das sondas.

| Status          | Significado                            | O que fazer                                                 |
| --------------- | -------------------------------------- | ----------------------------------------------------------- |
| **Operacional** | tudo respondeu                         | nada                                                        |
| **Degradado**   | backend respondeu acima de 1,5 s       | observar; se persistir, checar a região do projeto Supabase |
| **Fora do ar**  | HTTP de erro, timeout ou falha de rede | conferir `.env.local`, o status do Supabase e a rede        |

`/health` não mostra PII, chave, nem contagem de registros. Se alguma dessas
coisas aparecer ali, é bug de segurança — trate como incidente.

## Diagnóstico rápido

| Sintoma                                       | Causa provável                                                            | Ação                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "Ambiente incompleto" na tela                 | falta `.env.local`                                                        | copiar do `.env.example`                                                                                        |
| Boot falha com `ClientSecretLeakError`        | variável de servidor no ambiente do cliente                               | remover a variável do build; **isto é proteção funcionando**                                                    |
| `npm run lint` reclama de arquivo do design   | `docs/design/canvas/` está ignorado; verifique se o arquivo saiu do lugar | —                                                                                                               |
| Teste de token quebra                         | tokens divergiram do Claude Design                                        | ressincronizar (ver `docs/design/DESIGN_SOURCE.md`) ou registrar ADR. **Não** edite o token para o teste passar |
| CI falha em "Tipos gerados estão atualizados" | migration alterada sem regenerar                                          | `npm run db:types` e commitar                                                                                   |

## O que este runbook ainda não cobre

Porque ainda não existe: gestão de clientes e viagens · roteiro · passeios e
comércio · carteira e fidelidade · refeições · suporte e SOS · álbum e mídia ·
eventos · papéis e permissões · plantão e escalonamento.

Cada seção entra junto com a fase que a criar (§16).
