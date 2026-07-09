// src/db.js — VERSÃO SUPABASE (finanças)
// Interface: getAll/put/remove/exportAll/importAll.
// Cada operação usa o usuário logado com RLS no Supabase.

import { supabase } from "./supabaseClient";

// Mapa: nome lógico -> tabela real no Supabase
const TABLES = {
  categories: "categories",
  entries: "entries",
  investments: "investments",
  goals: "goals",
  cards: "cards",
  categoryRules: "category_rules",
  accounts: "accounts",
};

// Converte camelCase do app para snake_case do banco
const toDB = (store, item) => {
  const base = {
    ...item,
    user_id: undefined,
    userId: undefined,
  };

  if (store === "entries") {
    const row = {
      id: item.id,
      date: item.date,
      category_id: item.categoryId,
      type: item.type,
      value: item.value,
      descr: item.desc || "",
      payment_method: item.paymentMethod || "pix",
      card_id: item.cardId || null,
      installment_group_id: item.installmentGroupId || null,
      installment_number: Number(item.installmentNumber || 1),
      installments_total: Number(item.installmentsTotal || 1),
      paid: item.paid === true,
      invoice_month:
        item.invoiceMonth !== undefined && item.invoiceMonth !== null
          ? Number(item.invoiceMonth)
          : null,
      invoice_year:
        item.invoiceYear !== undefined && item.invoiceYear !== null
          ? Number(item.invoiceYear)
          : null,
      invoice_due_date: item.invoiceDueDate || null,
    };

    // Campos novos (Fase 2/3): só enviados quando preenchidos, para que
    // lançamentos normais continuem salvando mesmo se a coluna ainda não
    // existir no Supabase (migração pendente).
    if (item.recurringGroupId) row.recurring_group_id = item.recurringGroupId;
    if (item.importFitid) row.import_fitid = item.importFitid;
    if (item.accountId) row.account_id = item.accountId;
    if (item.purchaseDate) row.purchase_date = item.purchaseDate;

    return row;
  }

  if (store === "accounts") {
    return {
      id: item.id,
      name: item.name,
      kind: item.kind || "checking",
      bank_id: item.bankId || null,
      acct_id: item.acctId || null,
      color: item.color || "#4A6FA5",
      active: item.active !== false,
    };
  }

  if (store === "categoryRules") {
    return {
      id: item.id,
      pattern: (item.pattern || "").toLowerCase(),
      category_id: item.categoryId,
      created_at: item.createdAt || new Date().toISOString(),
    };
  }

  if (store === "cards") {
    return {
      id: item.id,
      name: item.name,
      limit_value: Number(item.limit || item.limitValue || 0),
      closing_day: Number(item.closingDay || 1),
      due_day: Number(item.dueDay || 1),
      color: item.color || "#2E8B7C",
      active: item.active !== false,
    };
  }

  return base;
};

// Converte snake_case do banco para camelCase do app
const fromDB = (store, row) => {
  if (store === "entries") {
    return {
      id: row.id,
      date: row.date,
      categoryId: row.category_id,
      type: row.type,
      value: Number(row.value),
      desc: row.descr || "",
      paymentMethod: row.payment_method || "pix",
      cardId: row.card_id || "",
      installmentGroupId: row.installment_group_id || "",
      installmentNumber: Number(row.installment_number || 1),
      installmentsTotal: Number(row.installments_total || 1),
      paid: row.paid === true,
      invoiceMonth:
        row.invoice_month !== undefined && row.invoice_month !== null
          ? Number(row.invoice_month)
          : null,
      invoiceYear:
        row.invoice_year !== undefined && row.invoice_year !== null
          ? Number(row.invoice_year)
          : null,
      invoiceDueDate: row.invoice_due_date || "",
      purchaseDate: row.purchase_date || "",
      recurringGroupId: row.recurring_group_id || "",
      importFitid: row.import_fitid || "",
      accountId: row.account_id || "",
    };
  }

  if (store === "accounts") {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind || "checking",
      bankId: row.bank_id || "",
      acctId: row.acct_id || "",
      color: row.color || "#4A6FA5",
      active: row.active !== false,
      createdAt: row.created_at,
    };
  }

  if (store === "categoryRules") {
    return {
      id: row.id,
      pattern: row.pattern || "",
      categoryId: row.category_id,
      createdAt: row.created_at,
    };
  }

  if (store === "cards") {
    return {
      id: row.id,
      name: row.name,
      limit: Number(row.limit_value || 0),
      limitValue: Number(row.limit_value || 0),
      closingDay: Number(row.closing_day || 1),
      dueDay: Number(row.due_day || 1),
      color: row.color || "#2E8B7C",
      active: row.active !== false,
      createdAt: row.created_at,
    };
  }

  if (store === "investments" || store === "goals") {
    return {
      ...row,
      value: row.value != null ? Number(row.value) : undefined,
      target: row.target != null ? Number(row.target) : undefined,
      current: row.current != null ? Number(row.current) : undefined,
    };
  }

  return row;
};

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function getAll(store) {
  const table = TABLES[store];

  if (!table) {
    console.warn(`Store desconhecida: ${store}`);
    return [];
  }

  const { data, error } = await supabase.from(table).select("*");

  if (error) {
    console.error(error);
    return [];
  }

  return data.map((row) => fromDB(store, row));
}

export async function put(store, item) {
  const table = TABLES[store];

  if (!table) {
    throw new Error(`Store desconhecida: ${store}`);
  }

  const user_id = await uid();

  if (!user_id) {
    throw new Error("Usuário não autenticado.");
  }

  const row = {
    ...toDB(store, item),
    user_id,
  };

  const { error } = await supabase.from(table).upsert(row);

  if (error) {
    console.error(error);
    throw error;
  }

  return item;
}

export async function remove(store, id) {
  const table = TABLES[store];

  if (!table) {
    throw new Error(`Store desconhecida: ${store}`);
  }

  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    console.error(error);
    throw error;
  }
}

// Semeia categorias padrão na primeira vez que o usuário loga
export async function seedIfEmpty() {
  const cats = await getAll("categories");

  if (cats.length > 0) return;

  const mkId = () => Math.random().toString(36).slice(2, 10);

  const defaults = [
    { name: "Salário", type: "receita", color: "#2E8B7C" },
    { name: "Freelance / Sistemas", type: "receita", color: "#D3A44B" },
    { name: "Moradia", type: "despesa", color: "#8B6F47" },
    { name: "Alimentação", type: "despesa", color: "#C1543C" },
    { name: "Transporte", type: "despesa", color: "#4A6FA5" },
    { name: "Assinaturas", type: "despesa", color: "#5C7A99" },
    { name: "Lazer", type: "despesa", color: "#B08968" },
  ];

  for (const c of defaults) {
    await put("categories", {
      id: mkId(),
      ...c,
    });
  }
}

// Backup/export do Supabase
export async function exportAll() {
  const stores = Object.keys(TABLES);
  const out = {};

  for (const store of stores) {
    out[store] = await getAll(store);
  }

  return {
    app: "financas-pessoais",
    exportedAt: new Date().toISOString(),
    data: out,
  };
}

export async function importAll(payload) {
  const data = payload?.data || {};

  for (const store of Object.keys(TABLES)) {
    for (const item of data[store] || []) {
      await put(store, item);
    }
  }
}