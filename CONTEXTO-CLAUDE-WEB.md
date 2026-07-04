# Contexto — App de Finanças Pessoais ("Grana") — alterações de 2026-07-04

> Cole este documento no Claude web para dar contexto. É um resumo das mudanças
> feitas hoje. Se precisar do código real de um trecho, peça que eu extraio.

## Visão geral do projeto
- **Nome:** Grana (PWA de finanças pessoais, em português).
- **Stack:** Vite 6 + React 18 (JavaScript, sem TypeScript), PWA via
  `vite-plugin-pwa`. Gráficos com `recharts`, ícones `lucide-react`.
- **Dados:** Supabase (Postgres + Auth + RLS). Camada de acesso isolada em
  `src/db.js` com interface `getAll/put/remove/exportAll/importAll`. O app
  converte camelCase (app) ↔ snake_case (banco).
- **Deploy:** VPS própria com **Coolify** (build via Dockerfile de 2 estágios:
  Node builder + nginx). Push na branch `main` do GitHub dispara o build.
  (Existe um `vercel.json` no repo, mas o deploy real é Coolify.)
- **Estrutura:** quase tudo vive em `src/App.jsx` (~5.500 linhas, um único
  arquivo com todos os componentes e um bloco de CSS em template string).
  Outros: `src/db.js`, `src/lib/import.js`, `src/AuthContext.jsx`,
  `src/Login.jsx`, `src/supabaseClient.js`, `src/main.jsx`.

## Modelo de dados (Supabase)
Tabelas: `categories`, `entries` (lançamentos), `investments`, `goals`,
`cards` (cartões de crédito), `category_rules` (novo hoje), `accounts` (novo hoje).

Campos relevantes de `entries`:
- `date`, `category_id`, `type` ("receita"|"despesa"), `value`, `descr`,
  `payment_method` ("pix"|"debit"|"credit_card"), `paid`.
- Cartão: `card_id`, `installment_group_id`, `installment_number`,
  `installments_total`, `invoice_month`, `invoice_year`, `invoice_due_date`.
- Novos hoje: `recurring_group_id`, `import_fitid`, `account_id`.

Regra central de cartão: a competência da despesa é o **mês da fatura**
(`invoice_month`/`invoice_year`), calculado a partir do dia de compra + dia de
fechamento + dia de vencimento do cartão — não o mês da data da compra.

## Migrações SQL criadas hoje (precisam rodar no Supabase)
- `supabase-migration-v2.sql`: adiciona `entries.recurring_group_id`,
  `entries.import_fitid`; cria tabela `category_rules` (id, user_id, pattern,
  category_id, created_at) com RLS.
- `supabase-migration-v3.sql`: cria tabela `accounts` (id, user_id, name, kind,
  bank_id, acct_id, color, active, created_at) com RLS; adiciona
  `entries.account_id`.

Decisão de segurança: em `src/db.js`, os campos novos (`recurring_group_id`,
`import_fitid`, `account_id`) só são enviados no upsert **quando preenchidos**,
para que lançamentos normais continuem salvando mesmo se a migração ainda não
tiver rodado (PostgREST falharia com coluna inexistente).

## Commits de hoje (mais recente primeiro)
1. `e7a763b` — **Contas/Bancos + toggle Mês/Ano no Panorama (v0.3.0)**
2. `bae3da9` — **Correção de fuso**: datas sem hora caíam no mês anterior
3. `a372b17` — PWA: banner de update virou **modal animado (v0.2.3)**
4. `fd5a647` — Importação: remove filtro de tipo do input (**iPhone acinzentava
   .ofx**) + aviso de PDF
5. `6c427d7` — Docker: builder **Node 22** + `npm ci --no-audit --no-fund`
6. `4767c2d` — PWA: checa atualização ao voltar ao **primeiro plano (v0.2.1)**
7. `c113221` — Sincroniza `package-lock` (corrige `npm ci` no Coolify)
8. `95082fa` — **Finanças v2**: recorrência, importação OFX/CSV, carrossel de
   cartões, update PWA

## Features implementadas hoje (detalhe)

### 1. Correção de bugs de data (fuso horário) — crítico
`new Date("2025-07-01")` era interpretado como meia-noite UTC → no Brasil
(UTC-3) virava 30/06, jogando o lançamento no mês anterior (ex.: salário de
01/07 aparecia em junho). Criadas duas helpers em `App.jsx`:
- `localDate(dateStr)`: interpreta "YYYY-MM-DD" ao meio-dia local.
- `todayISO()`: "hoje" no fuso local.
Aplicadas no Panorama, aba Mês, `entryCompetence` e nos defaults de data dos
formulários.

### 2. Recorrência (despesas/receitas fixas)
No form de lançamento: "Repetir todo mês?" + nº de meses. Gera N lançamentos com
`recurringGroupId`. Ao excluir, pergunta "série toda ou só este mês". Badge
"🔁 Fixo" na lista.

### 3. Importação de extrato OFX/CSV (`src/lib/import.js`, zero-dependência)
- Parser OFX 1.x/2.x (regex em `<STMTTRN>`) e CSV (detecção de colunas).
- Tela de revisão: data e valor vêm prontos do arquivo; o usuário só escolhe a
  categoria (e opcionalmente cartão/conta).
- **Deduplicação** por `FITID` (OFX) ou assinatura data+valor+desc (CSV).
- **Categorização que aprende**: regras "contém X → categoria Y"
  (case-insensitive, a mais longa vence). Sugestão de padrão semiautomática na
  importação; aba "Regras de categoria" para criar/editar/excluir.
- **Fatura de cartão de uma vez**: seletor "Aplicar a todas" → todas as despesas
  caem na competência de fatura correta.
- **Auto-detecção de banco/conta** (novo): `parseAccountInfo` lê BANKID/ACCTID/
  ORG do OFX; pré-seleciona conta existente ou oferece "Criar conta".

### 4. Cartões: carrossel + modal de fatura (estilo Nubank)
Carrossel horizontal (scroll-snap CSS) no topo da aba Mês, um card por cartão
(fatura atual, "Fecha X · Vence Y", barra de limite se houver). Toque abre modal
(bottom sheet) com as despesas da fatura e navegação ‹ › entre meses (passados e
futuros, incluindo parcelas/recorrências projetadas).

### 5. Aba "A pagar" (compromissos futuros)
Soma tudo comprometido em meses futuros (parcelas + recorrências + faturas),
agrupado por competência.

### 6. Contas / Bancos (novo hoje)
Nova aba: cadastro (nome, tipo: corrente/poupança/carteira, cor), editar,
excluir. Por conta mostra entradas, despesas e saldo do **mês selecionado** →
**despesas separadas por banco**. Lançamentos não-cartão podem ser vinculados a
uma conta. Importação associa a conta detectada. (Saldo é baseado nos
lançamentos registrados, não há saldo de abertura.)

### 7. Panorama: toggle Mês / Ano
Botão no topo alterna entre o mês selecionado (padrão) e o ano todo. Cards,
gráficos e rótulos se ajustam. Cálculos usam a competência (fatura para cartão).

### 8. PWA / versão / robustez
- Versão exposta via `__APP_VERSION__` (Vite `define`) e mostrada num rodapé
  ("Grana vX.Y.Z"). Versão atual: **0.3.0**.
- `registerType: "prompt"`; **modal animado** "Nova versão disponível" com
  "Atualizar agora" e "Agora não". Fechar aplica no próximo restart do app
  (ciclo natural do service worker; não força reload no meio de um lançamento).
- Checagem de atualização também em `visibilitychange`/`focus` (o timer de 60s
  congela em segundo plano no celular).
- Backup automático (últimos 3) antes de operações em lote (importação/restore).

## Pontos em aberto / decisões conhecidas
- **Cartão de crédito** não tem auto-detecção completa: o OFX não traz dia de
  **fechamento** nem **limite** — só o usuário sabe; continuam manuais.
- **Build no Coolify** falhou algumas vezes cedo no `npm ci` (exit 255),
  provavelmente **OOM/RAM da VPS**; mitigações aplicadas (Node 22, npm ci mais
  leve). Se repetir, avaliar swap/aumento de RAM na VPS.
- **PWA update na virada atual**: quem está numa versão antiga só pega a nova ao
  encerrar e reabrir o app (o código do modal/banner não existe no SW antigo).
- `src/App.jsx` é um arquivo único muito grande (~5.500 linhas); candidato a
  refatoração/modularização no futuro.
- Sincronizar `package-lock.json` a cada bump de versão é obrigatório, senão o
  `npm ci` do Docker quebra.

## Como pedir código específico
Este documento é resumo. Se quiser ver a implementação real de algo (ex.: a
função `calculateInvoiceInfo`, o parser OFX, o componente `Contas`, o modal de
update), peça o trecho e eu colo aqui.
