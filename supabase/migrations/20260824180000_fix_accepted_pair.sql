-- =============================================================================
-- Correção: a constraint de convite aceito impedia excluir conta
--
-- A versão original exigia que `accepted_at` e `accepted_by` fossem nulos
-- juntos. `accepted_by` tem `on delete set null`; apagar o usuário zerava a
-- coluna, deixava `accepted_at` preenchido, e a checagem abortava a exclusão
-- inteira — com uma mensagem que não dizia nada sobre convites.
--
-- São dois fatos diferentes: "o convite foi aceito" continua verdade depois de
-- a conta sumir; "sabemos quem aceitou" não. O invariante que importa é o
-- inverso do que eu tinha escrito.
-- =============================================================================

alter table public.invitations
  drop constraint invitations_accepted_pair;

alter table public.invitations
  add constraint invitations_accepted_pair
  check (accepted_by is null or accepted_at is not null);

comment on column public.invitations.accepted_by is
  'Fica null quando a conta e excluida. accepted_at permanece: o convite foi usado.';
