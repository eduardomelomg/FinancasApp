# Grana · suas finanças no controle (PWA)

App de controle financeiro pessoal: receitas, despesas, categorias, cartões,
investimentos e metas. Roda como **PWA instalável** e usa **Supabase** (Auth + Postgres
com RLS) como backend multiusuário. Tem tour guiado de primeiro acesso e splash.

## Variáveis de ambiente

Crie um arquivo `.env` na raiz (veja `.env.example`):

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

## Rodar localmente

```bash
npm install
npm run dev
```

## Build + testar PWA

```bash
npm run build
npm run preview
```

## Deploy na Vercel
1. Importe o repositório em vercel.com (framework detectado: **Vite**).
2. Em **Settings → Environment Variables**, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Build command: `npm run build` · Output: `dist` (já é o padrão do Vite).
4. O `vercel.json` já faz o fallback de SPA para `index.html`.

## Instalar no iPhone
Abra a URL publicada no **Safari** → Compartilhar → **Adicionar à Tela de Início**.

## Backup
Botões no topo (↓ exporta `.json`, ↑ importa). Os dados vivem só no aparelho até
você plugar um banco.

---

## Como transformar em PRODUTO pago (roteiro)

O código já foi escrito pensando nisso. Cada registro carrega um `userId`
(hoje fixo em `"local"`). Passos para escalar:

### 1. Banco: Supabase (grátis pra começar)
- Crie um projeto em supabase.com.
- Crie as tabelas `categories`, `entries`, `investments`, `goals` com uma coluna
  `user_id uuid`.
- **Ligue Row Level Security** em cada tabela com a policy:
  `user_id = auth.uid()`
  Isso garante que **cada usuário só enxerga os próprios dados** — resolve o
  problema de sobrescrita/vazamento que uma planilha compartilhada teria.

### 2. Login
- Use Supabase Auth (e-mail/senha, Google, magic link). Já vem pronto.
- Ao logar, troque a constante `CURRENT_USER` em `src/db.js` pelo `auth.uid()`.

### 3. Trocar a camada de dados
- Em `src/db.js`, substitua `getAll/put/remove` por `supabase.from(...).select/upsert/delete`.
- A interface (`App.jsx`) **não muda** — ela só chama a `api`, não sabe de onde vêm os dados.

### 4. Cobrança (quando tiver usuários ativos)
- Modelo recomendado: **freemium + assinatura**.
  - Grátis: lançamentos do mês + categorias limitadas.
  - Premium (~R$ 9,90–14,90/mês ou ~R$ 90/ano): panorama do ano, metas,
    investimentos, exportar, multi-dispositivo.
- Ferramenta: Stripe (internacional) ou, no Brasil, um gateway com Pix
  (Asaas, Pagar.me). Comece só quando houver dezenas de usuários ativos —
  cobrança traz suporte e obrigações que não valem a pena cedo demais.

### Ordem de prioridade sugerida
1. Validar com usuários grátis (você já vai fazer isso).
2. Se engajarem, adicionar login + Supabase.
3. Só então ligar cobrança.
