-- Sincronización. Cada competición es un grupo en la nube: sus miembros, con su rol, son
-- los únicos que ven y escriben sus registros.

create table public.members (
  competition_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('organizer', 'scorer', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);

-- Una fila por registro de la app (competición, equipo, jugador, jornada, partida o gol),
-- con el registro completo en `data`. Así el formato de la app puede cambiar sin migrar
-- el servidor, y la sincronización sube y baja los registros tal cual.
create table public.records (
  table_name text not null
    check (table_name in ('competitions', 'teams', 'players', 'jornadas', 'matches', 'goals')),
  id text not null,
  competition_id text not null,
  -- Vacío cuando el registro está borrado.
  data jsonb,
  -- Reloj del teléfono que hizo el cambio: decide qué versión gana.
  updated_at timestamptz not null,
  deleted_at timestamptz,
  -- Reloj del servidor: los otros teléfonos bajan lo que cambió desde su última vez.
  synced_at timestamptz not null default clock_timestamp(),
  updated_by uuid default auth.uid(),
  -- La clave incluye la competición: un grupo no puede ocupar los IDs de otro.
  primary key (competition_id, table_name, id),
  check ((data is null) = (deleted_at is not null)),
  check (table_name <> 'competitions' or id = competition_id)
);

create index records_by_sync on public.records (competition_id, synced_at);

-- Rol del usuario actual en un grupo (null si no es miembro). `security definer` para que
-- las políticas de `members` no se consulten a sí mismas.
create function public.member_role(cid text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.members where competition_id = cid and user_id = auth.uid()
$$;

-- Gana el cambio más reciente. Un teléfono con la hora adelantada no puede ganarle a
-- todos para siempre: su fecha se recorta a la del servidor.
create function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(new.updated_at, now() + interval '1 minute');
  if tg_op = 'UPDATE' then
    if new.competition_id <> old.competition_id then
      raise exception 'Un registro no puede cambiar de competición';
    end if;
    if new.updated_at < old.updated_at then
      return old;
    end if;
  end if;
  new.synced_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end
$$;

create trigger records_before_write
before insert or update on public.records
for each row execute function public.records_before_write();

-- El organizador (con email, no anónimo) sube su competición: queda como dueño del grupo.
create function public.create_group(cid text)
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
    if public.member_role(cid) = 'organizer' then
      return;
    end if;
    raise exception 'Esa competición ya está en la nube con otro organizador';
  end if;
  insert into public.members (competition_id, user_id, role) values (cid, auth.uid(), 'organizer');
end
$$;

alter table public.members enable row level security;
alter table public.records enable row level security;

create policy "Cada uno ve sus grupos; el organizador ve a todos los miembros"
on public.members for select to authenticated
using (user_id = auth.uid() or public.member_role(competition_id) = 'organizer');

create policy "Los miembros leen los registros de su grupo"
on public.records for select to authenticated
using (public.member_role(competition_id) is not null);

create policy "Organizador y anotador crean registros"
on public.records for insert to authenticated
with check (public.member_role(competition_id) in ('organizer', 'scorer'));

create policy "Organizador y anotador modifican registros"
on public.records for update to authenticated
using (public.member_role(competition_id) in ('organizer', 'scorer'))
with check (public.member_role(competition_id) in ('organizer', 'scorer'));

-- Nadie borra filas: los borrados son lápidas (`deleted_at`).
revoke all on public.members, public.records from anon;
revoke delete on public.records from authenticated;
revoke insert, update, delete on public.members from authenticated;
revoke execute on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
revoke execute on function public.member_role(text) from public, anon;
grant execute on function public.member_role(text) to authenticated;
