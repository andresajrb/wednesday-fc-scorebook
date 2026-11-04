-- Ajustes del linter de Supabase.

-- `member_role` solo la usan las políticas y `create_group`: fuera del esquema expuesto
-- por la API, nadie la llama por `/rest/v1/rpc`. Las políticas siguen apuntando a ella.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.member_role(text) set schema private;

create or replace function public.create_group(cid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Para subir una competición hay que entrar con email';
  end if;
  if exists (select 1 from public.members where competition_id = cid) then
    if private.member_role(cid) = 'organizer' then
      return;
    end if;
    raise exception 'Esa competición ya está en la nube con otro organizador';
  end if;
  insert into public.members (competition_id, user_id, role) values (cid, auth.uid(), 'organizer');
end
$$;

-- `auth.uid()` una vez por consulta, no por fila.
drop policy "Cada uno ve sus grupos; el organizador ve a todos los miembros" on public.members;
create policy "Cada uno ve sus grupos; el organizador ve a todos los miembros"
on public.members for select to authenticated
using (user_id = (select auth.uid()) or private.member_role(competition_id) = 'organizer');

create index members_by_user on public.members (user_id);
