-- Reversao da migration 20260824000000_foundation.
--
-- Migrations do Supabase são forward-only por convenção; este arquivo existe
-- para que a fundação seja comprovadamente reversível em ambiente de
-- desenvolvimento (critério de aceite da Fase 0). NUNCA rode em produção com
-- dados: ele derruba as tabelas.

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.idempotency_keys;
drop table if exists public.audit_logs;
drop table if exists public.feature_flags;
drop table if exists public.app_config;
drop table if exists public.user_roles;
drop table if exists public.profiles;

drop type if exists public.fly_role;

drop function if exists fly_private.handle_new_user();
drop function if exists fly_private.is_staff();
drop function if exists fly_private.has_role(public.fly_role);
drop function if exists fly_private.touch_updated_at();

drop schema if exists fly_private;
