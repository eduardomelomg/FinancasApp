-- Migração Finanças v3 — Contas/Bancos. Rode no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez.

-- 1) Tabela de contas (banco/carteira). Cartão de crédito continua em "cards".
create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text default 'checking',        -- checking | savings | wallet
  bank_id text,                         -- BANKID/ORG do OFX (auto-detecção)
  acct_id text,                         -- ACCTID do OFX (auto-detecção)
  color text default '#4A6FA5',
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accounts'
      and policyname = 'accounts_owner'
  ) then
    create policy accounts_owner on public.accounts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 2) Vínculo do lançamento à conta (dinheiro/pix/débito). Cartão usa card_id.
alter table public.entries
  add column if not exists account_id text;

create index if not exists entries_user_account_idx
  on public.entries (user_id, account_id);
