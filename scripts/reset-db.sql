-- ============================================================
-- Grana — RESET do banco (zera todos os dados de todos os usuários)
-- Rode em: Supabase > SQL Editor > New query > Run
-- ATENÇÃO: isto APAGA TUDO. Não dá pra desfazer.
-- ============================================================

-- 1) Zera as tabelas do app.
--    RESTART IDENTITY reinicia sequências; CASCADE respeita FKs.
truncate table
  entries,
  investments,
  goals,
  cards,
  categories
restart identity cascade;

-- 2) Remove os arquivos de avatar do Storage (bucket "avatars").
delete from storage.objects
where bucket_id = 'avatars';

-- Observação: as categorias padrão são recriadas automaticamente
-- para cada usuário no próximo login (seedIfEmpty em src/db.js),
-- então cada conta começa zerada, com as categorias iniciais.
