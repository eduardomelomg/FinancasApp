-- ============================================================
-- Grana — adiciona o campo "paid" (fatura paga) na tabela entries.
-- Rode em: Supabase > SQL Editor > New query > Run
-- Necessário para o recurso "marcar fatura como paga" (libera o limite).
-- ============================================================

alter table public.entries
  add column if not exists paid boolean not null default false;
