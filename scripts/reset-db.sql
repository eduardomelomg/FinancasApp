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

-- 2) Arquivos do Storage (bucket "avatars") NÃO podem ser apagados por SQL —
--    o Supabase bloqueia delete direto em storage.objects (protect_delete).
--    Esvazie o bucket por um destes caminhos:
--
--    a) Painel: Storage > avatars > selecionar tudo > Delete.
--
--    b) Script Node com a SERVICE ROLE KEY (nunca no app/frontend):
--         import { createClient } from "@supabase/supabase-js";
--         const s = createClient(URL, SERVICE_ROLE_KEY);
--         const { data } = await s.storage.from("avatars").list("", { limit: 1000 });
--         // liste subpastas (uma por user_id) e remova os arquivos:
--         // await s.storage.from("avatars").remove([`${userId}/avatar.jpg`, ...]);
--
--    Como cada foto fica em {user_id}/avatar.jpg, sobrescrever no próximo
--    upload já substitui a antiga — limpar é opcional para "zerar".

-- Observação: as categorias padrão são recriadas automaticamente
-- para cada usuário no próximo login (seedIfEmpty em src/db.js),
-- então cada conta começa zerada, com as categorias iniciais.
