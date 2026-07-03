-- ============================================================
-- Grana — RLS (Row Level Security) para isolamento por usuário
-- Rode em: Supabase > SQL Editor > New query > Run
-- Cada usuário só enxerga/edita os próprios registros (user_id = auth.uid()).
-- Seguro rodar mais de uma vez (dropa a policy antes de recriar).
-- ============================================================

-- Garante a coluna user_id em cada tabela (caso ainda não exista).
alter table public.categories  add column if not exists user_id uuid default auth.uid();
alter table public.entries     add column if not exists user_id uuid default auth.uid();
alter table public.investments add column if not exists user_id uuid default auth.uid();
alter table public.goals       add column if not exists user_id uuid default auth.uid();
alter table public.cards       add column if not exists user_id uuid default auth.uid();

-- Liga o RLS em todas as tabelas.
alter table public.categories  enable row level security;
alter table public.entries     enable row level security;
alter table public.investments enable row level security;
alter table public.goals       enable row level security;
alter table public.cards       enable row level security;

-- Uma policy "dona" por tabela: vale para SELECT/INSERT/UPDATE/DELETE.
-- USING filtra o que já existe; WITH CHECK valida o que é gravado.
do $$
declare
  t text;
begin
  foreach t in array array['categories','entries','investments','goals','cards']
  loop
    execute format('drop policy if exists "own rows" on public.%I;', t);
    execute format($f$
      create policy "own rows" on public.%I
        for all
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ============================================================
-- Storage: bucket "avatars"
-- (crie o bucket como PUBLIC em Storage > New bucket antes de rodar)
-- Cada usuário só escreve/atualiza/apaga arquivos na própria pasta:
--   {user_id}/avatar.jpg
-- ============================================================

drop policy if exists "avatars public read"  on storage.objects;
drop policy if exists "avatars user insert"   on storage.objects;
drop policy if exists "avatars user update"   on storage.objects;
drop policy if exists "avatars user delete"   on storage.objects;

create policy "avatars public read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "avatars user insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars user update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars user delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
