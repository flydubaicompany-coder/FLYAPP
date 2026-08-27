# Threat model

Versão inicial, Fase 0. Cresce a cada fase que introduzir dado ou fluxo novo.

## Dados sensíveis (§23.1)

Passaporte · localização · saúde · contato de emergência · pagamento · gasto ·
preferências pessoais · fotos e biometria · **dados de menores**.

Nenhum deles é coletado ainda. As defesas abaixo existem para que o primeiro
que chegar já encontre o caminho seguro pronto.

## Ameaças e o que já está no lugar

| #   | Ameaça                                            | Defesa hoje                                                                            | Aberto                               |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| T01 | Cliente A lê dados do cliente B                   | RLS por `auth.uid()` em `profiles` e `user_roles`; teste negativo dedicado             | testes não executados (falta Docker) |
| T02 | Usuário se promove a admin                        | papel em tabela protegida, sem policy de escrita; **nunca** em `raw_user_meta_data`    | —                                    |
| T03 | Chave secreta vaza para o bundle                  | `assertNoServerSecrets` falha o boot; `.gitignore` cobre `.env*`; CI varre versionados | —                                    |
| T04 | PII em log                                        | logger redige recursivamente 20+ padrões de campo antes de emitir                      | lista precisa crescer com o modelo   |
| T05 | Trilha de auditoria adulterada                    | `audit_logs` sem policy de UPDATE/DELETE, nem para admin; `force row level security`   | escrita server-side ainda não existe |
| T06 | Sequestro de `search_path` em função privilegiada | `security definer` com `set search_path = ''`                                          | —                                    |
| T07 | Função privilegiada exposta pela API              | `fly_private` fora dos schemas expostos no `config.toml`                               | —                                    |
| T08 | Acesso anônimo a tabela nova                      | `revoke all ... from anon`; GRANT tabela a tabela                                      | conferir a cada migration            |
| T09 | Requisição duplicada cria dois pedidos            | `idempotency_keys` existe, sem GRANT para cliente                                      | uso real chega na Fase 5             |
| T10 | Dependência vulnerável                            | `npm audit` limpo; `overrides` de `uuid` documentado                                   | reavaliar a cada SDK do Expo         |
| T11 | Health expõe informação demais                    | só host do backend, nunca a URL completa nem a chave; teste garante                    | —                                    |
| T12 | Passaporte em bucket público                      | Storage privado com URLs assinadas curtas (§7.7)                                       | **não implementado** — Fase 4        |
| T13 | Passaporte enviado a modelo de IA genérico        | proibição explícita da §7.7 e §15.1                                                    | **sem controle técnico** — Fase 10   |
| T14 | QR resgatado duas vezes                           | token opaco, expiração, escopo, log de leitura (§7.8)                                  | **não implementado** — Fase 4        |
| T15 | Localização de funcionário revelada ao cliente    | proibição da §12.4                                                                     | **não implementado** — Fase 8        |

## Observação da auditoria

Uma chave **publicável** do Supabase aparece em `.claude/settings.local.json`,
fora deste repositório. Chave publicável não é segredo — ela é feita para ir ao
cliente e a proteção real é a RLS. Fica registrada porque revela qual projeto
Supabase os sites usam, o que é informação de reconhecimento.

## Princípios que não se negociam (§23.2)

Coleta mínima · consentimento por finalidade · acesso por papel, atribuição e
viagem · RLS · Storage privado · URLs assinadas e curtas · criptografia em
trânsito e repouso · cache local protegido · logs sem conteúdo sensível ·
trilha de auditoria · retenção definida · exclusão e exportação · revogação de
sessão · processo de incidente · revisão jurídica para LGPD e para as normas
dos destinos.

## Pendências de segurança

- **P01** — Docker, para que a RLS deixe de ser teoria.
- **P21** — períodos de retenção de passaporte, localização, saúde e recibos.
- **P22** — processo de menores e acompanhantes.
- **P23** — consentimento de imagem.
- Revisão jurídica de LGPD e das normas dos Emirados, antes do piloto.
