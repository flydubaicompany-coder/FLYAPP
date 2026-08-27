# ADR 0005 — Autenticação e a base do Fly ID

**Status:** aceito · **Data:** 24/08/2026 · **Fase:** 0

## Contexto

A §2.2 define o Fly ID: uma identidade para Fly App e Fly Cup, com perfil
único, SSO por deep link, ledger central de pontos e papéis distintos.

A §21.4 é categórica: autorização vive em `app_metadata` ou em tabela
protegida, **nunca** em metadado editável pelo usuário.

## Decisão

Autenticação pelo Supabase Auth. Papel em `public.user_roles`, tabela protegida.

- `raw_user_meta_data` é editável pelo próprio usuário e **não** guarda papel.
- Helpers `fly_private.has_role()` e `fly_private.is_staff()` são
  `security definer` com `search_path = ''` fixado — sem isso, um schema no
  caminho de busca do chamador poderia sequestrar a resolução de nomes.
- `user_roles` não tem policy de INSERT, UPDATE ou DELETE para cliente algum.
  Conceder papel é operação de servidor, auditada.
- `profiles` nasce por trigger em `auth.users`, não por chamada do cliente.

O enum `public.fly_role` espelha `FLY_ROLES` em
`packages/domain-types/src/roles.ts`. Os dois mudam juntos.

## Alternativas consideradas

- **Papel em JWT custom claim** — mais rápido de ler, mas o token fica obsoleto
  entre renovações e revogar acesso deixa de ser imediato. Reavaliar quando
  houver volume de leitura que justifique; hoje é otimização prematura.

## Consequências

- Toda decisão de acesso custa uma consulta a `user_roles`, mitigada pelo
  índice e pelo `stable` das funções.
- A lista de papéis no TypeScript é dica de roteamento de UI, **não** controle
  de segurança. O servidor decide de novo, sempre.
- O Fly ID de verdade — convite, vínculo familiar, consentimentos, SSO com o
  Fly Cup — é entrega da Fase 2. Aqui só está a âncora que faz a RLS significar
  alguma coisa.
