-- En vivo: los teléfonos se enteran al instante de los cambios de su grupo (Realtime
-- respeta las políticas: cada uno recibe solo lo que puede leer).
alter publication supabase_realtime add table public.records;

-- Un anotador por partida. La partida guarda quién la anota (`scorerId`); los goles y los
-- cambios de la partida de cualquier otro se rechazan, salvo que tome el control (se pone
-- él como `scorerId`).
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me text := auth.uid()::text;
  owner text;
  match_id text;
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

  if new.table_name = 'matches' and tg_op = 'UPDATE' then
    owner := old.data ->> 'scorerId';
    if owner is not null and owner <> me
       and (new.data is null or new.data ->> 'scorerId' is distinct from me) then
      raise exception 'Otra persona está anotando esta partida';
    end if;
  elsif new.table_name = 'goals' then
    match_id := case when tg_op = 'UPDATE' then coalesce(new.data, old.data) else new.data end
      ->> 'matchId';
    if match_id is not null then
      select r.data ->> 'scorerId' into owner
      from public.records r
      where r.competition_id = new.competition_id and r.table_name = 'matches' and r.id = match_id;
      if owner is not null and owner <> me then
        raise exception 'Otra persona está anotando esta partida';
      end if;
    end if;
  end if;

  new.synced_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end
$$;
