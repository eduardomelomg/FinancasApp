-- Migração Finanças v5 — Garante RLS ativo em todas as tabelas. Rode no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- Importante rodar isso antes de deixar o repositório GitHub público, já que a
-- anon key fica embutida no bundle público e é ela quem faz as queries — sem
-- RLS, qualquer pessoa com essa key conseguiria ler/escrever dados de outros usuários.

do $$
declare
  t text;
begin
  foreach t in array array['categories', 'entries', 'cards', 'category_rules', 'accounts']
  loop
    -- Ativa RLS na tabela (idempotente).
    execute format('alter table public.%I enable row level security;', t);

    -- Cria a policy padrão de dono só se ainda não existir.
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = t || '_owner'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
        t || '_owner', t
      );
    end if;
  end loop;
end $$;

-- Conferência: lista RLS habilitado e policies por tabela.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in ('categories', 'entries', 'cards', 'category_rules', 'accounts')
group by c.relname, c.relrowsecurity
order by c.relname;
