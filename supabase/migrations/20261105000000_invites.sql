-- Invitaciones por link. El organizador comparte un link (por WhatsApp); quien lo abre
-- entra con una sesión anónima y queda como miembro con el rol del link.

alter table public.members add column display_name text;

-- Del link solo se guarda el hash: con la tabla no se puede armar un link válido.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  competition_id text not null,
  role text not null check (role in ('scorer', 'viewer')),
  token_hash text not null unique,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  -- Admin: personal, un solo uso, 7 días. Espectador: sin límite hasta que se revoque.
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  revoked_at timestamptz
);

create index invites_by_competition on public.invites (competition_id);
create index invites_by_creator on public.invites (created_by);

alter table public.invites enable row level security;

create policy "El organizador ve las invitaciones de su grupo"
on public.invites for select to authenticated
using (private.member_role(competition_id) = 'organizer');

revoke all on public.invites from anon;
revoke insert, update, delete on public.invites from authenticated;

create function public.create_invite(cid text, invite_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if private.member_role(cid) is distinct from 'organizer' then
    raise exception 'Solo el organizador puede invitar';
  end if;
  if invite_role not in ('scorer', 'viewer') then
    raise exception 'Rol inválido';
  end if;
  token := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
  insert into public.invites (competition_id, role, token_hash, expires_at, max_uses)
  values (
    cid,
    invite_role,
    encode(extensions.digest(token, 'sha256'), 'hex'),
    case when invite_role = 'scorer' then now() + interval '7 days' end,
    case when invite_role = 'scorer' then 1 end
  );
  return token;
end
$$;

-- Entrar con un link. Nunca baja de rol: un admin que abre el link de espectadores sigue
-- siendo admin, y el organizador sigue siendo organizador.
create function public.redeem_invite(token text, name text)
returns table (competition_id text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  current_role_name text;
  rank_of constant jsonb := '{"viewer": 1, "scorer": 2, "organizer": 3}';
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión para entrar';
  end if;
  select * into inv from public.invites
  where token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  for update;
  if inv.id is null or inv.revoked_at is not null
     or (inv.expires_at is not null and inv.expires_at < now())
     or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
    raise exception 'El link no es válido o ya venció';
  end if;

  current_role_name := private.member_role(inv.competition_id);
  if current_role_name is not null
     and (rank_of ->> current_role_name)::int >= (rank_of ->> inv.role)::int then
    update public.members m set display_name = coalesce(nullif(trim(name), ''), m.display_name)
    where m.competition_id = inv.competition_id and m.user_id = auth.uid();
    return query select inv.competition_id, current_role_name;
    return;
  end if;

  insert into public.members (competition_id, user_id, role, display_name)
  values (inv.competition_id, auth.uid(), inv.role, nullif(trim(name), ''))
  on conflict on constraint members_pkey do update
    set role = excluded.role,
        display_name = coalesce(excluded.display_name, public.members.display_name);
  update public.invites set uses = uses + 1 where id = inv.id;
  return query select inv.competition_id, inv.role;
end
$$;

create function public.revoke_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid text;
begin
  select competition_id into cid from public.invites where id = invite_id;
  if cid is null or private.member_role(cid) is distinct from 'organizer' then
    raise exception 'Solo el organizador puede desactivar links';
  end if;
  update public.invites set revoked_at = now() where id = invite_id and revoked_at is null;
end
$$;

create function public.remove_member(cid text, member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.member_role(cid) is distinct from 'organizer' then
    raise exception 'Solo el organizador puede sacar miembros';
  end if;
  if member_id = auth.uid() then
    raise exception 'El organizador no se puede sacar a sí mismo';
  end if;
  delete from public.members where competition_id = cid and user_id = member_id;
end
$$;

revoke execute on function public.create_invite(text, text) from public, anon;
revoke execute on function public.redeem_invite(text, text) from public, anon;
revoke execute on function public.revoke_invite(uuid) from public, anon;
revoke execute on function public.remove_member(text, uuid) from public, anon;
grant execute on function public.create_invite(text, text) to authenticated;
grant execute on function public.redeem_invite(text, text) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.remove_member(text, uuid) to authenticated;
