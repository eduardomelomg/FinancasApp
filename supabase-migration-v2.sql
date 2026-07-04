-- Migração Finanças v2 — rode isto no SQL Editor do Supabase ANTES de usar
-- as funcionalidades novas (recorrência, importação OFX e regras de categoria).
-- É idempotente: pode rodar mais de uma vez sem quebrar.

-- 1) Novas colunas em entries (recorrência + deduplicação de importação)
alter table public.entries
  add column if not exists recurring_group_id text,
  add column if not exists import_fitid text;

-- Índice para deduplicação rápida por FITID dentro de cada usuário.
create index if not exists entries_user_fitid_idx
  on public.entries (user_id, import_fitid);

-- 2) Tabela de regras de categorização aprendidas ("contém X -> categoria Y")
create table if not exists public.category_rules (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern text not null,
  category_id text,
  created_at timestamptz default now()
);

-- 3) Row Level Security: cada usuário só enxerga suas próprias regras.
alter table public.category_rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'category_rules'
      and policyname = 'category_rules_owner'
  ) then
    create policy category_rules_owner on public.category_rules
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
