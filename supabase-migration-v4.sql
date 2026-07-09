-- Migração Finanças v4 — Data da compra nas parcelas. Rode no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez.

-- Parcelamentos gravam em "date" a data de VENCIMENTO de cada parcela, não a da
-- compra. Sem a data original não dá para recalcular em que fatura a série cai
-- (reprocessar trataria o vencimento como se fosse a compra e empurraria tudo um
-- mês adiante, de forma cumulativa). Guardamos a data da compra à parte.
alter table public.entries
  add column if not exists purchase_date date;

-- Backfill do que dá para reconstruir com segurança: numa série parcelada, a
-- parcela 1 vence uma fatura depois da compra, então sua própria data não serve.
-- Mas lançamentos NÃO parcelados já têm "date" = data da compra.
update public.entries
   set purchase_date = date
 where purchase_date is null
   and coalesce(installments_total, 1) = 1;

create index if not exists entries_user_purchase_date_idx
  on public.entries (user_id, purchase_date);
