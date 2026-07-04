import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Plus,
  Trash2,
  Wallet,
  Tags,
  CalendarRange,
  TrendingUp,
  Target,
  PiggyBank,
  Download,
  Upload,
  LogOut,
  Settings,
  X,
  ImagePlus,
  Palette,
  CreditCard,
  MoreHorizontal,
  Pencil,
  CalendarClock,
  FileUp,
  Sparkles,
  Landmark,
} from "lucide-react";
import { getAll, put, remove, exportAll, importAll, seedIfEmpty } from "./db.js";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  parseStatement,
  parseAccountInfo,
  suggestPattern,
  matchRule,
} from "./lib/import.js";

// Versão do app, injetada em build time pelo Vite (define). Em dev cai no fallback.
const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
import { useAuth } from "./AuthContext.jsx";
import { openDB } from "idb";

const INK = "#1C2431";
const NAVY = "#22304A";
const TEAL = "#2E8B7C";
const GOOD = "#2E8B7C";
const BAD = "#C1543C";
const GOLD = "#D3A44B";

const fmt = (n) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const pct = (n) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;
const uid = () => Math.random().toString(36).slice(2, 10);

// Converte um valor digitado (aceita "1.200,50", "1200.5", "200,00" etc.)
// para número. Trata "." como separador de milhar e "," como decimal no
// formato pt-BR, mas também aceita ponto decimal simples ("200.5").
const parseMoney = (input) => {
  if (typeof input === "number") return isFinite(input) ? input : 0;

  let s = String(input ?? "").trim();
  if (!s) return 0;

  const hasComma = s.includes(",");

  if (hasComma) {
    // Formato pt-BR: pontos são milhar, vírgula é decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Sem vírgula: o ponto (se houver) já é o separador decimal — nada a fazer.

  const n = Number(s.replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
};

// Divide um valor total em N parcelas somando exatamente o total.
// As parcelas iniciais recebem os centavos que sobram, evitando que a
// soma das parcelas fique diferente do valor da compra.
const splitInstallments = (total, count) => {
  const n = Math.max(1, Math.floor(count));
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;

  return Array.from({ length: n }, (_, i) => {
    const cents = baseCents + (i < remainder ? 1 : 0);
    return cents / 100;
  });
};

const thisYear = new Date().getFullYear();

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MABR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function Card({ children, className = "", style = {}, ...rest }) {
  return (
    <div className={`card ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <Card className="p-4 col gap-1">
      <div className="row gap-2" style={{ color: accent || "var(--teal)" }}>
        <Icon size={18} />
        <span className="stat-label">{label}</span>
      </div>

      <div className="stat-value">{value}</div>

      {sub && <div className="stat-sub">{sub}</div>}
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return <input {...props} className="inp" />;
}

function NumberInput(props) {
  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      {...props}
      className="inp"
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select {...props} className="inp sel">
      {children}
    </select>
  );
}

function Btn({
  children,
  onClick,
  variant = "accent",
  className = "",
  disabled = false,
  ...rest
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Tab({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`tab ${active ? "tab-active" : ""}`}>
      <Icon size={22} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </button>
  );
}

function DeleteButton({ onClick, title = "Excluir" }) {
  return (
    <button className="delete-btn" onClick={onClick} title={title}>
      <Trash2 size={17} />
    </button>
  );
}

// Fase 6.1: banner "Nova versão disponível". Checa atualização a cada 60s.
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const check = () => registration.update().catch(() => {});

      // Checagem periódica (roda com o app aberto em primeiro plano).
      setInterval(check, 60 * 1000);

      // No celular o timer congela em segundo plano; então checamos também
      // quando o app volta ao primeiro plano — é aí que o usuário reabre e
      // conseguimos mostrar o aviso na hora.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("focus", check);
    },
  });

  const [dismissed, setDismissed] = useState(false);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="update-overlay" onClick={() => setDismissed(true)}>
      <div className="update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-icon">
          <Sparkles size={34} />
        </div>

        <h3 className="update-title">Nova versão disponível! ✨</h3>

        <p className="update-msg">
          Melhoramos o Grana com novidades e correções. Atualize agora para
          aproveitar tudo — leva só um instante.
        </p>

        <div className="update-actions">
          <button
            className="update-btn-primary"
            onClick={() => updateServiceWorker(true)}
          >
            Atualizar agora
          </button>

          <button className="update-btn-ghost" onClick={() => setDismissed(true)}>
            Agora não
          </button>
        </div>

        <p className="update-hint">
          Se fechar, a atualização acontece sozinha na próxima vez que você abrir
          o app.
        </p>
      </div>
    </div>
  );
}

function EditButton({ onClick, title = "Editar" }) {
  return (
    <button className="edit-btn" onClick={onClick} title={title}>
      <Pencil size={16} />
    </button>
  );
}

function fileToResizedDataUrl(file, maxSize = 420, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nenhum arquivo selecionado."));
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Selecione uma imagem válida."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);

        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = () => reject(new Error("Não consegui carregar a imagem."));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      onClose();
    }, 2800);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type || "success"}`}>
      <div>
        <strong>{toast.title || "Tudo certo"}</strong>
        <span>{toast.message}</span>
      </div>

      <button onClick={onClose} title="Fechar">
        <X size={16} />
      </button>
    </div>
  );
}

function Logo({ size = 36, radius = 12 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block", borderRadius: radius }}
      aria-label="Grana"
    >
      <rect width="512" height="512" rx="112" fill="#22304A" />
      <rect x="120" y="286" width="64" height="90" rx="18" fill="#2E8B7C" />
      <rect x="224" y="226" width="64" height="150" rx="18" fill="#2E8B7C" />
      <rect x="328" y="166" width="64" height="210" rx="18" fill="#2E8B7C" />
      <circle cx="360" cy="150" r="70" fill="#D3A44B" />
      <text
        x="360"
        y="150"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="66"
        fontWeight="700"
        fill="#22304A"
        textAnchor="middle"
        dominantBaseline="central"
      >
        R$
      </text>
    </svg>
  );
}

const ONBOARDING_KEY = "grana-onboarded-v1";

// Passos do tour guiado. `selector` aponta para um elemento real da tela
// (marcado com data-tour). `tab` faz o tour trocar de aba sozinho.
const TOUR_STEPS = [
  {
    tab: "panorama",
    title: "Bem-vindo ao Grana 👋",
    text: "Vou te mostrar rapidinho como usar o app — leva menos de um minuto. É só ir tocando em Próximo.",
    icon: TrendingUp,
  },
  {
    tab: "mensal",
    selector: '[data-tour="entry-card"]',
    title: "Registre no dia a dia",
    text: "É aqui, na aba Mês, que você lança cada receita ou despesa. Comece escolhendo a data, o tipo e a categoria.",
    placement: "bottom",
  },
  {
    tab: "mensal",
    selector: '[data-tour="entry-value"]',
    title: "Valor da compra",
    text: "Digite o valor total. Pode usar centavos, ex.: 1.200,50. Se for parcelado, informe o total — o app divide pra você.",
    placement: "bottom",
  },
  {
    tab: "mensal",
    selector: '[data-tour="entry-payment"]',
    title: "Forma de pagamento",
    text: "Pix, débito ou cartão de crédito. No crédito você pode parcelar, e cada parcela cai na fatura do mês certo.",
    placement: "bottom",
  },
  {
    tab: "mensal",
    selector: '[data-tour="entry-add"]',
    title: "Adicionar",
    text: "Toque em Adicionar e pronto: o lançamento aparece na lista logo abaixo, no mês selecionado.",
    placement: "top",
  },
  {
    tab: "cartoes",
    selector: '[data-tour="cards-card"]',
    title: "Seus cartões",
    text: "Cadastre seus cartões com o dia de fechamento e vencimento. Assim o app acompanha a fatura e o limite usado.",
    placement: "bottom",
  },
  {
    tab: "panorama",
    title: "Tudo pronto! 🎉",
    text: "Na aba Panorama você acompanha receitas x despesas do ano, gastos por categoria e quanto foi pro cartão. Bom uso!",
    icon: Target,
  },
];

function Tour({ tab, setTab, onFinish }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const step = TOUR_STEPS[i];
  const isLast = i === TOUR_STEPS.length - 1;

  // Troca de aba assim que o passo pede outra aba.
  useEffect(() => {
    if (step.tab && step.tab !== tab) setTab(step.tab);
  }, [i, step.tab, tab, setTab]);

  // Mede o elemento alvo (com retry, pois a aba pode ainda estar montando).
  useLayoutEffect(() => {
    if (!step.selector) {
      setRect(null);
      return;
    }

    let frame;
    let tries = 0;

    const measure = () => {
      const el = document.querySelector(step.selector);

      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else if (tries++ < 40) {
        frame = requestAnimationFrame(measure);
      } else {
        setRect(null);
      }
    };

    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [i, step.selector, tab]);

  // Reposiciona o destaque ao rolar/redimensionar.
  useEffect(() => {
    if (!step.selector) return;

    const update = () => {
      const el = document.querySelector(step.selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [i, step.selector]);

  const next = () => (isLast ? onFinish() : setI((v) => v + 1));
  const back = () => setI((v) => Math.max(0, v - 1));

  const pad = 8;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Posição do balão: perto do alvo (acima/abaixo) ou centralizado.
  let tipStyle;
  if (spotlight) {
    const below =
      step.placement === "bottom" ||
      (step.placement !== "top" &&
        spotlight.top + spotlight.height < window.innerHeight * 0.5);

    const maxW = Math.min(340, window.innerWidth - 24);
    let left = spotlight.left + spotlight.width / 2 - maxW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - maxW - 12));

    tipStyle = below
      ? { top: spotlight.top + spotlight.height + 14, left, width: maxW }
      : {
          top: undefined,
          bottom: window.innerHeight - spotlight.top + 14,
          left,
          width: maxW,
        };
  } else {
    tipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.min(340, window.innerWidth - 24),
    };
  }

  const Icon = step.icon;

  return (
    <div className="tour-root">
      {spotlight ? (
        <div className="tour-spot" style={spotlight} />
      ) : (
        <div className="tour-dim" />
      )}

      <div className="tour-tip" style={tipStyle}>
        {Icon && (
          <div className="tour-icon">
            <Icon size={22} />
          </div>
        )}

        <div className="tour-step-count">
          Passo {i + 1} de {TOUR_STEPS.length}
        </div>

        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-text">{step.text}</p>

        <div className="tour-dots">
          {TOUR_STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`onb-dot ${idx === i ? "onb-dot-active" : ""}`}
            />
          ))}
        </div>

        <div className="tour-actions">
          {i > 0 ? (
            <button className="onb-back" onClick={back}>
              Voltar
            </button>
          ) : (
            <button className="onb-back" onClick={onFinish}>
              Pular
            </button>
          )}

          <Btn onClick={next}>{isLast ? "Concluir" : "Próximo"}</Btn>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { signOut, user, updateProfile, uploadAvatar, deleteAvatar } = useAuth();

  const [tab, setTab] = useState("mensal");
  const [month, setMonth] = useState(new Date().getMonth());
  const navRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [cards, setCards] = useState([]);
  const [categoryRules, setCategoryRules] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [loaded, setLoaded] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");

  const [hideMigrationBanner, setHideMigrationBanner] = useState(
    () => localStorage.getItem("hide-financas-migration-banner") === "true"
  );

  const [darkMode, setDarkMode] = useState(
    // Escuro por padrão; só fica claro se o usuário escolher explicitamente.
    () => localStorage.getItem("theme") !== "light"
  );

  const [toast, setToast] = useState(null);

  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) !== "true"
  );

  const finishOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
  }, []);

  const showToast = useCallback((message, type = "success", title = "Tudo certo") => {
    setToast({
      id: Date.now(),
      message,
      type,
      title,
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Mede a altura real do menu e reserva exatamente esse espaço no rodapé,
  // via a variável CSS --nav-h. Assim o conteúdo respeita o menu em qualquer
  // tela/aparelho (safe-area, tamanho de fonte, etc.).
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const setNavHeight = () =>
      document.documentElement.style.setProperty("--nav-h", `${el.offsetHeight}px`);

    setNavHeight();

    const observer = new ResizeObserver(setNavHeight);
    observer.observe(el);
    window.addEventListener("resize", setNavHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", setNavHeight);
    };
  }, [loaded]);

  const chartTextColor = darkMode ? "#E3E1DA" : "#1C2431";
  const chartGridColor = darkMode ? "#1F2937" : "#E3E1DA";

  const profileName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || "";

  const profilePic =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  const reload = useCallback(async () => {
    const [c, e, i, g, ca, rules, acc] = await Promise.all([
      getAll("categories"),
      getAll("entries"),
      getAll("investments"),
      getAll("goals"),
      getAll("cards"),
      getAll("categoryRules"),
      getAll("accounts"),
    ]);

    setCategories(c);
    setEntries(e);
    setInvestments(i);
    setGoals(g);
    setCards(ca);
    setCategoryRules(rules);
    setAccounts(acc);
    setLoaded(true);
  }, []);

  useEffect(() => {
    async function checkLocal() {
      try {
        const db = await openDB("financas-pessoais", 1);
        const stores = ["categories", "entries", "investments", "goals", "cards"];
        let found = false;

        for (const s of stores) {
          if (db.objectStoreNames.contains(s)) {
            const count = await db.count(s);

            if (count > 0) {
              found = true;
              break;
            }
          }
        }

        setHasLocalData(found);
      } catch (e) { }
    }

    checkLocal();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await seedIfEmpty();
      } catch (e) {
        console.error("Error seeding categories:", e);
      }

      await reload();
    })();
  }, [reload]);

  const safeCall = async (fn, ...args) => {
    try {
      const result = await fn(...args);
      await reload();
      return result;
    } catch (e) {
      console.error("Erro no safeCall:", e);

      showToast(
        e?.message || "Não consegui salvar/remover. Verifique sua conexão.",
        "error",
        "Erro"
      );

      throw e;
    }
  };

  const api = {
    addCategory: async (x) => {
      await safeCall(put, "categories", x);
      showToast("Categoria adicionada com sucesso.");
    },

    delCategory: async (id) => {
      await safeCall(remove, "categories", id);
      showToast("Categoria excluída.");
    },

    addEntry: async (x) => {
      await safeCall(put, "entries", x);
      showToast("Lançamento adicionado com sucesso.");
    },

    addEntries: async (items) => {
      try {
        for (const item of items) {
          await put("entries", item);
        }

        await reload();

        showToast(
          items.length > 1
            ? `${items.length} parcelas adicionadas com sucesso.`
            : "Lançamento adicionado com sucesso."
        );
      } catch (e) {
        console.error("Erro ao salvar lançamentos:", e);

        showToast(
          e?.message || "Erro ao salvar lançamentos.",
          "error",
          "Erro"
        );

        throw e;
      }
    },

    delEntry: async (id) => {
      await safeCall(remove, "entries", id);
      showToast("Lançamento excluído.");
    },

    // Exclui todos os lançamentos de um grupo (série recorrente ou parcelamento).
    delEntryGroup: async (field, groupId) => {
      try {
        const targets = entries.filter((e) => e[field] === groupId);
        for (const e of targets) await remove("entries", e.id);
        await reload();
        showToast(`Série removida (${targets.length} lançamentos).`);
      } catch (e) {
        console.error("Erro ao remover série:", e);
        showToast(e?.message || "Erro ao remover a série.", "error", "Erro");
        throw e;
      }
    },

    saveAccount: async (x) => {
      await safeCall(put, "accounts", x);
      showToast("Conta salva com sucesso.");
    },

    delAccount: async (id) => {
      await safeCall(remove, "accounts", id);
      showToast("Conta excluída.");
    },

    saveRule: async (x) => {
      await safeCall(put, "categoryRules", x);
      showToast("Regra salva.");
    },

    delRule: async (id) => {
      await safeCall(remove, "categoryRules", id);
      showToast("Regra excluída.");
    },

    addInvest: async (x) => {
      await safeCall(put, "investments", x);
      showToast("Investimento adicionado.");
    },

    delInvest: async (id) => {
      await safeCall(remove, "investments", id);
      showToast("Investimento excluído.");
    },

    saveGoal: async (x) => {
      await safeCall(put, "goals", x);
      showToast("Meta salva com sucesso.");
    },

    delGoal: async (id) => {
      await safeCall(remove, "goals", id);
      showToast("Meta excluída.");
    },

    saveCard: async (x) => {
      await safeCall(put, "cards", x);
      showToast("Cartão salvo com sucesso.");
    },

    delCard: async (id) => {
      await safeCall(remove, "cards", id);
      showToast("Cartão excluído.");
    },

    // Marca (ou reabre) uma fatura: atualiza o campo paid dos lançamentos.
    setInvoicePaid: async (entriesList, paid) => {
      try {
        for (const entry of entriesList) {
          await put("entries", { ...entry, paid });
        }

        await reload();
        showToast(paid ? "Fatura marcada como paga." : "Fatura reaberta.");
      } catch (e) {
        console.error("Erro ao atualizar fatura:", e);
        showToast(e?.message || "Erro ao atualizar a fatura.", "error", "Erro");
        throw e;
      }
    },
  };

  const handleMigration = async () => {
    if (
      !confirm(
        "Deseja migrar todos os dados locais salvos neste navegador para a sua conta no Supabase?"
      )
    ) {
      return;
    }

    setMigrationStatus("migrating");

    try {
      const db = await openDB("financas-pessoais", 1).catch(() => null);

      if (!db) {
        alert("Nenhum banco de dados local encontrado.");
        setMigrationStatus("");
        return;
      }

      const stores = ["categories", "entries", "investments", "goals", "cards"];
      let count = 0;

      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) continue;

        const items = await db.getAll(store);
        const localItems = items.filter((r) => r.userId === "local" || !r.userId);

        for (const item of localItems) {
          await put(store, item);
          count++;
        }
      }

      alert(`Migrado com sucesso! ${count} registros copiados.`);
      setMigrationStatus("done");
      setHasLocalData(false);
      reload();
    } catch (err) {
      console.error(err);
      alert("Erro ao migrar dados: " + err.message);
      setMigrationStatus("error");
    }
  };

  const closeMigrationBanner = () => {
    setHideMigrationBanner(true);
    localStorage.setItem("hide-financas-migration-banner", "true");
  };

  // Fase 6-G: snapshot silencioso antes de qualquer restauração em lote,
  // guardando os últimos 3 no localStorage (rede de segurança, sem UI extra).
  const saveAutoBackup = async () => {
    try {
      const snapshot = await exportAll();
      const key = "financas-auto-backups";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.unshift(snapshot);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 3)));
    } catch (err) {
      console.error("Falha ao criar backup automático:", err);
    }
  };

  const doExport = async () => {
    const d = await exportAll();
    const b = new Blob([JSON.stringify(d, null, 2)], {
      type: "application/json",
    });

    const u = URL.createObjectURL(b);
    const a = document.createElement("a");

    a.href = u;
    a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(u);
  };

  const doImport = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const r = new FileReader();

    r.onload = async () => {
      try {
        const payload = JSON.parse(r.result);
        await saveAutoBackup();
        await importAll(payload);
        reload();
        alert("Backup restaurado!");
      } catch {
        alert("Arquivo inválido.");
      }
    };

    r.readAsText(f);
  };

  const data = {
    categories,
    entries,
    investments,
    goals,
    cards,
    categoryRules,
    accounts,
  };

  if (!loaded) {
    // Estilos inline (sem depender do <style> abaixo) para casar com a splash
    // do boot — navy + logo, sem tela branca nem texto "carregando".
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignItems: "center",
          justifyContent: "center",
          background: "#151E2E",
        }}
      >
        <Logo size={76} radius={22} />
        <span style={{ color: "#8A94A6", fontSize: 12, letterSpacing: 0.5 }}>
          Grana v{APP_VERSION}
        </span>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{CSS}</style>
      <Toast toast={toast} onClose={closeToast} />
      <UpdatePrompt />

      {showOnboarding && (
        <Tour tab={tab} setTab={setTab} onFinish={finishOnboarding} />
      )}

      <header className="hdr">
        <div className="row gap-2">
          {profilePic ? (
            <img
              src={profilePic}
              alt="Perfil"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Logo size={36} radius={12} />
          )}

          <div>
            <h1>
              {profileName ? `Olá, ${profileName.split(" ")[0]}` : "Grana"}
            </h1>
            <p>ano {thisYear}</p>
          </div>

          <div className="row gap-1" style={{ marginLeft: "auto" }}>
            <button
              className="icon-btn"
              onClick={() => setTab("config")}
              title="Ajustes"
            >
              <Settings size={18} color="#fff" />
            </button>
          </div>
        </div>
      </header>

      {hasLocalData && migrationStatus !== "done" && !hideMigrationBanner && (
        <div className="migration-banner">
          <div className="migration-text">
            Você possui dados locais salvos neste navegador. Deseja migrar para
            sua conta Supabase?
          </div>

          <div className="migration-actions">
            <Btn
              onClick={handleMigration}
              disabled={migrationStatus === "migrating"}
              variant="solid"
              className="migration-btn"
            >
              {migrationStatus === "migrating" ? "Migrando..." : "Migrar Dados"}
            </Btn>

            <button
              className="migration-close"
              onClick={closeMigrationBanner}
              title="Fechar aviso"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      <main>
        {tab === "mensal" && (
          <Mensal data={data} api={api} month={month} setMonth={setMonth} showToast={showToast} beforeBulk={saveAutoBackup} />
        )}

        {tab === "panorama" && (
          <Panorama
            data={data}
            api={api}
            month={month}
            darkMode={darkMode}
            chartTextColor={chartTextColor}
            chartGridColor={chartGridColor}
          />
        )}

        {tab === "carteira" && (
          <Carteira data={data} api={api} month={month} />
        )}

        {tab === "config" && (
          <Ajustes
            data={data}
            api={api}
            user={user}
            updateProfile={updateProfile}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            showToast={showToast}
            onReplayTour={() => setShowOnboarding(true)}
            uploadAvatar={uploadAvatar}
            deleteAvatar={deleteAvatar}
            doExport={doExport}
            doImport={doImport}
            signOut={signOut}
          />
        )}

        <p className="app-version">Grana v{APP_VERSION}</p>
      </main>

      <nav className="nav" ref={navRef}>
        <Tab
          active={tab === "mensal"}
          onClick={() => setTab("mensal")}
          icon={CalendarRange}
          label="Início"
        />

        <Tab
          active={tab === "panorama"}
          onClick={() => setTab("panorama")}
          icon={TrendingUp}
          label="Panorama"
        />

        <Tab
          active={tab === "carteira"}
          onClick={() => setTab("carteira")}
          icon={Wallet}
          label="Carteira"
        />
      </nav>
    </div>
  );
}

// Modal genérico (bottom sheet) para detalhes/CRUD que não merecem aba própria.
function DetailSheet({ title, onClose, children }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet detail-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="row between mb-2">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="detail-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// Aba CARTEIRA: cartões + contas juntos ("onde meu dinheiro está / de onde sai").
// Reutiliza os componentes existentes de gestão, só empilhados numa página.
function Carteira({ data, api, month }) {
  return (
    <div className="col gap-4">
      <h2 className="section-h">Cartões</h2>
      <Cartoes data={data} api={api} month={month} />

      <h2 className="section-h">Contas / Bancos</h2>
      <Contas data={data} api={api} month={month} />
    </div>
  );
}

function Panorama({ data, api, month, darkMode, chartTextColor, chartGridColor }) {
  const [detail, setDetail] = useState(null);

  // A pagar: total de despesas comprometidas em meses futuros (por competência).
  const now = new Date();
  const curKey = now.getFullYear() * 12 + now.getMonth();
  const futureTotal = data.entries
    .filter((e) => e.type === "despesa")
    .reduce((a, e) => {
      const { year, month: m } = entryCompetence(e);
      return year * 12 + m > curKey ? a + e.value : a;
    }, 0);
  const investedTotal = data.investments.reduce((a, i) => a + i.value, 0);
  // Toggle Mês / Ano. Padrão: mês (a visão que o usuário mais espera).
  const [view, setView] = useState("month");
  const isMonth = view === "month";

  // Escopo por competência (cartão cai na fatura, resto na data). Ano = ano
  // todo; Mês = o mês selecionado na aba Mês.
  const scope = data.entries.filter((e) => {
    const { year, month: m } = entryCompetence(e);
    if (year !== thisYear) return false;
    return isMonth ? m === month : true;
  });

  const rec = scope
    .filter((e) => e.type === "receita")
    .reduce((a, e) => a + e.value, 0);

  const des = scope
    .filter((e) => e.type === "despesa")
    .reduce((a, e) => a + e.value, 0);

  const saldo = rec - des;
  const inv = data.investments.reduce((a, i) => a + i.value, 0);

  const creditCard = scope
    .filter((e) => e.paymentMethod === "credit_card")
    .reduce((a, e) => a + e.value, 0);

  const bm = MESES.map((_, idx) => {
    const es = data.entries.filter((e) => {
      const { year, month: m } = entryCompetence(e);
      return year === thisYear && m === idx;
    });

    return {
      mes: MABR[idx],
      receita: es
        .filter((e) => e.type === "receita")
        .reduce((a, e) => a + e.value, 0),
      despesa: es
        .filter((e) => e.type === "despesa")
        .reduce((a, e) => a + e.value, 0),
    };
  });

  const cm = Object.fromEntries(data.categories.map((c) => [c.id, c]));
  const bc = {};

  for (const e of scope.filter((e) => e.type === "despesa")) {
    const c = cm[e.categoryId];
    const n = c?.name || "Outros";
    bc[n] = (bc[n] || 0) + e.value;
  }

  const pie = Object.entries(bc).map(([name, value]) => ({ name, value }));
  const pcs = data.categories.map((c) => c.color);

  const sfx = isMonth ? MABR[month] : "ano";

  return (
    <div className="col gap-4">
      <div className="panorama-toggle">
        <button
          className={isMonth ? "pt-active" : ""}
          onClick={() => setView("month")}
        >
          {MESES[month]}
        </button>
        <button
          className={!isMonth ? "pt-active" : ""}
          onClick={() => setView("year")}
        >
          Ano {thisYear}
        </button>
      </div>

      <div className="grid2 gap-3">
        <StatCard
          icon={TrendingUp}
          label={`Receitas (${sfx})`}
          value={fmt(rec)}
          accent={GOOD}
        />

        <StatCard
          icon={TrendingUp}
          label={`Despesas (${sfx})`}
          value={fmt(des)}
          accent={BAD}
        />

        <StatCard
          icon={Wallet}
          label={`Saldo (${sfx})`}
          value={fmt(saldo)}
          accent={saldo >= 0 ? GOOD : BAD}
        />

        <StatCard
          icon={CreditCard}
          label={`Cartão (${sfx})`}
          value={fmt(creditCard)}
          accent={GOLD}
        />

        <StatCard
          icon={PiggyBank}
          label="Investido"
          value={fmt(inv)}
          accent={GOLD}
        />
      </div>

      <Card className="p-4">
        <h3>Receitas x Despesas por mês</h3>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bm}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />

            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: chartTextColor }}
            />

            <YAxis tick={{ fontSize: 10, fill: chartTextColor }} width={40} />

            <Tooltip
              formatter={(v) => fmt(v)}
              contentStyle={{
                background: darkMode ? "#111827" : "#FFFFFF",
                borderColor: chartGridColor,
                color: chartTextColor,
              }}
            />

            <Bar dataKey="receita" fill={TEAL} radius={[3, 3, 0, 0]} />
            <Bar dataKey="despesa" fill={BAD} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {pie.length > 0 && (
        <Card className="p-4">
          <h3>Despesas por categoria ({sfx})</h3>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                label={{ fontSize: 10, fill: chartTextColor }}
              >
                {pie.map((_, i) => (
                  <Cell key={i} fill={pcs[i % pcs.length]} />
                ))}
              </Pie>

              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{
                  background: darkMode ? "#111827" : "#FFFFFF",
                  borderColor: chartGridColor,
                  color: chartTextColor,
                }}
              />

              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Consultas ocasionais viram cards; o detalhe/CRUD abre em modal. */}
      <div className="grid2 gap-3">
        <button className="link-card" onClick={() => setDetail("futuro")}>
          <div className="row between">
            <span className="lc-label">A pagar (futuro)</span>
            <CalendarClock size={16} />
          </div>
          <strong className="lc-value">{fmt(futureTotal)}</strong>
          <span className="lc-hint">Comprometido nos próximos meses ›</span>
        </button>

        <button className="link-card" onClick={() => setDetail("invest")}>
          <div className="row between">
            <span className="lc-label">Investido</span>
            <PiggyBank size={16} />
          </div>
          <strong className="lc-value">{fmt(investedTotal)}</strong>
          <span className="lc-hint">Ver carteira ›</span>
        </button>

        <button className="link-card" onClick={() => setDetail("metas")}>
          <div className="row between">
            <span className="lc-label">Metas</span>
            <Target size={16} />
          </div>
          <strong className="lc-value">{data.goals.length}</strong>
          <span className="lc-hint">Ver progresso ›</span>
        </button>
      </div>

      {scope.length === 0 && (
        <Card className="p-5">
          <p style={{ fontSize: 14, opacity: 0.6, margin: 0 }}>
            Registre lançamentos na aba <b>Início</b> para o panorama se preencher.
          </p>
        </Card>
      )}

      {detail === "futuro" && (
        <DetailSheet title="A pagar / compromissos futuros" onClose={() => setDetail(null)}>
          <Futuro data={data} />
        </DetailSheet>
      )}

      {detail === "invest" && (
        <DetailSheet title="Investimentos" onClose={() => setDetail(null)}>
          <Investimentos
            data={data}
            api={api}
            darkMode={darkMode}
            chartTextColor={chartTextColor}
            chartGridColor={chartGridColor}
          />
        </DetailSheet>
      )}

      {detail === "metas" && (
        <DetailSheet title="Metas" onClose={() => setDetail(null)}>
          <Metas data={data} api={api} />
        </DetailSheet>
      )}
    </div>
  );
}

function addMonthsToDate(date, monthsToAdd) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + monthsToAdd);
  return next;
}

function getSafeDay(year, monthIndex, day) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(Number(day || 1), 1), lastDayOfMonth);
}

function formatDateISO(date) {
  return date.toISOString().slice(0, 10);
}

// Interpreta "YYYY-MM-DD" no fuso LOCAL (meio-dia), evitando que datas sem hora
// sejam lidas como meia-noite UTC e "voltem" um dia (ex.: 01/07 virar 30/06 no
// Brasil, UTC-3). Use SEMPRE isto para extrair mês/ano de um lançamento.
function localDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const s = String(dateStr);
  return new Date(s.length > 10 ? s : `${s}T12:00:00`);
}

// "Hoje" no fuso local como "YYYY-MM-DD" (evita gravar o dia seguinte perto da
// meia-noite, que é o que toISOString faria por usar UTC).
function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

function calculateInvoiceInfo(purchaseDateString, card, installmentIndex = 0) {
  const purchaseDate = new Date(`${purchaseDateString}T12:00:00`);
  const purchaseDay = purchaseDate.getDate();

  const closingDay = Number(card?.closingDay || 1);
  const dueDay = Number(card?.dueDay || 1);

  let invoiceBase = new Date(
    purchaseDate.getFullYear(),
    purchaseDate.getMonth(),
    1
  );

  if (purchaseDay > closingDay) {
    invoiceBase = addMonthsToDate(invoiceBase, 1);
  }

  invoiceBase = addMonthsToDate(invoiceBase, installmentIndex);

  const closeYear = invoiceBase.getFullYear();
  const closeMonth = invoiceBase.getMonth();

  // A competência mostrada ao usuário ("fatura de agosto") é o mês de
  // VENCIMENTO, não o mês em que a fatura fecha — é assim que a pessoa pensa
  // sobre a compra ("isso eu pago em agosto"), mesmo quando fechamento e
  // vencimento caem em meses diferentes (ex.: fecha dia 28, vence dia 5).
  let dueYear = closeYear;
  let dueMonth = closeMonth;

  if (dueDay <= closingDay) {
    const dueBase = addMonthsToDate(new Date(closeYear, closeMonth, 1), 1);
    dueYear = dueBase.getFullYear();
    dueMonth = dueBase.getMonth();
  }

  const safeDueDay = getSafeDay(dueYear, dueMonth, dueDay);
  const dueDate = new Date(dueYear, dueMonth, safeDueDay, 12, 0, 0);

  return {
    invoiceMonth: dueMonth,
    invoiceYear: dueYear,
    invoiceDueDate: formatDateISO(dueDate),
  };
}

// Competência efetiva de um lançamento: para cartão usa a fatura
// (invoiceMonth/invoiceYear); para os demais, o mês da própria data.
function entryCompetence(e) {
  if (
    e.paymentMethod === "credit_card" &&
    e.invoiceMonth !== null &&
    e.invoiceMonth !== undefined &&
    e.invoiceYear !== null &&
    e.invoiceYear !== undefined
  ) {
    return { year: Number(e.invoiceYear), month: Number(e.invoiceMonth) };
  }
  const d = localDate(e.date);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// Contas/Bancos: cadastro, saldo e despesas por banco (do mês selecionado).
const ACCOUNT_KINDS = {
  checking: "Conta corrente",
  savings: "Poupança",
  wallet: "Carteira / Dinheiro",
  credit: "Cartão de crédito",
};

function Contas({ data, api, month }) {
  const empty = {
    id: "",
    name: "",
    kind: "checking",
    color: "#4A6FA5",
    active: true,
  };
  const [f, setF] = useState(empty);
  const editing = !!f.id;

  const save = () => {
    if (!f.name.trim()) {
      alert("Informe o nome da conta/banco.");
      return;
    }
    api.saveAccount({
      id: f.id || uid(),
      name: f.name.trim(),
      kind: f.kind || "checking",
      bankId: f.bankId || "",
      acctId: f.acctId || "",
      color: f.color || "#4A6FA5",
      active: f.active !== false,
    });
    setF(empty);
  };

  // Lançamentos do mês selecionado, por competência (cartão usa fatura).
  const monthEntries = data.entries.filter((e) => {
    const { year, month: m } = entryCompetence(e);
    return year === thisYear && m === month;
  });

  const statsFor = (accountId) => {
    const items = monthEntries.filter((e) => e.accountId === accountId);
    const entradas = items
      .filter((e) => e.type === "receita")
      .reduce((a, e) => a + e.value, 0);
    const saidas = items
      .filter((e) => e.type === "despesa")
      .reduce((a, e) => a + e.value, 0);
    return { entradas, saidas, saldo: entradas - saidas, count: items.length };
  };

  const totalSaidas = data.accounts.reduce(
    (a, acc) => a + statsFor(acc.id).saidas,
    0
  );
  const semConta = statsFor("").saidas; // despesas sem banco definido

  return (
    <div className="col gap-4">
      <div className="grid2 gap-3">
        <StatCard
          icon={Landmark}
          label={`Contas cadastradas`}
          value={String(data.accounts.length)}
          accent={TEAL}
        />
        <StatCard
          icon={TrendingUp}
          label={`Despesas em ${MESES[month]}`}
          value={fmt(totalSaidas)}
          accent={BAD}
        />
      </div>

      <Card className="p-4">
        <h3>{editing ? "Editar conta" : "Nova conta / banco"}</h3>

        <div className="grid2 gap-3 mt-2">
          <Field label="Nome">
            <TextInput
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Nubank, Itaú, Carteira..."
            />
          </Field>

          <Field label="Tipo">
            <SelectInput
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value })}
            >
              <option value="checking">Conta corrente</option>
              <option value="savings">Poupança</option>
              <option value="wallet">Carteira / Dinheiro</option>
            </SelectInput>
          </Field>

          <Field label="Cor">
            <div className="color-picker-wrap">
              <div className="color-preview" style={{ background: f.color }}>
                <Palette size={16} />
              </div>
              <input
                type="color"
                value={f.color}
                onChange={(e) => setF({ ...f, color: e.target.value })}
                className="color-inp"
              />
              <span className="color-value">{f.color}</span>
            </div>
          </Field>

          <Field label="Status">
            <SelectInput
              value={f.active ? "active" : "inactive"}
              onChange={(e) => setF({ ...f, active: e.target.value === "active" })}
            >
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </SelectInput>
          </Field>
        </div>

        <div className="row gap-2 mt-3">
          <Btn onClick={save}>
            <Plus size={16} />
            {editing ? "Salvar alterações" : "Adicionar conta"}
          </Btn>
          {editing && (
            <Btn variant="ghost" onClick={() => setF(empty)}>
              Cancelar
            </Btn>
          )}
        </div>
      </Card>

      <div className="col gap-3">
        {data.accounts.length === 0 && (
          <p className="empty">
            Nenhuma conta ainda. Cadastre seus bancos para ver as despesas
            separadas por conta.
          </p>
        )}

        {data.accounts.map((acc) => {
          const s = statsFor(acc.id);
          return (
            <Card key={acc.id} className="p-4">
              <div className="row between mb-2">
                <div className="row gap-2">
                  <div
                    className="card-color-badge"
                    style={{ background: acc.color || "#4A6FA5" }}
                  >
                    <Landmark size={18} />
                  </div>
                  <div>
                    <h4>{acc.name}</h4>
                    <p className="item-sub">
                      {ACCOUNT_KINDS[acc.kind] || "Conta"}
                      {acc.active === false ? " · inativa" : ""}
                    </p>
                  </div>
                </div>

                <div className="row gap-2">
                  <EditButton
                    onClick={() =>
                      setF({
                        id: acc.id,
                        name: acc.name,
                        kind: acc.kind || "checking",
                        bankId: acc.bankId || "",
                        acctId: acc.acctId || "",
                        color: acc.color || "#4A6FA5",
                        active: acc.active !== false,
                      })
                    }
                  />
                  <DeleteButton onClick={() => api.delAccount(acc.id)} />
                </div>
              </div>

              <div className="card-stats">
                <div>
                  <span>Entradas ({MABR[month]})</span>
                  <strong className="good-text">{fmt(s.entradas)}</strong>
                </div>
                <div>
                  <span>Despesas ({MABR[month]})</span>
                  <strong className="bad-text">{fmt(s.saidas)}</strong>
                </div>
                <div>
                  <span>Saldo do mês</span>
                  <strong className={s.saldo >= 0 ? "good-text" : "bad-text"}>
                    {fmt(s.saldo)}
                  </strong>
                </div>
                <div>
                  <span>Lançamentos</span>
                  <strong>{s.count}</strong>
                </div>
              </div>
            </Card>
          );
        })}

        {semConta > 0 && (
          <Card className="p-3 row between">
            <span className="item-sub">
              Despesas sem banco definido em {MESES[month]}
            </span>
            <strong className="bad-text">{fmt(semConta)}</strong>
          </Card>
        )}
      </div>
    </div>
  );
}

// Fase 2.2: soma tudo já comprometido em meses FUTUROS (parcelas +
// recorrências + faturas), agrupado por competência.
function Futuro({ data }) {
  const now = new Date();
  const curKey = now.getFullYear() * 12 + now.getMonth();

  const buckets = {};
  for (const e of data.entries) {
    if (e.type !== "despesa") continue;
    const { year, month } = entryCompetence(e);
    const key = year * 12 + month;
    if (key <= curKey) continue; // só o que ainda está por vir
    (buckets[key] = buckets[key] || { year, month, total: 0, items: [] });
    buckets[key].total += e.value;
    buckets[key].items.push(e);
  }

  const cm = Object.fromEntries(data.categories.map((c) => [c.id, c]));
  const months = Object.values(buckets).sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  );
  const grandTotal = months.reduce((a, m) => a + m.total, 0);

  return (
    <div className="col gap-4">
      <p className="viewing-month">
        Compromissos futuros · <strong>{fmt(grandTotal)}</strong> no total
      </p>

      {months.length === 0 && (
        <Card className="p-5">
          <p style={{ fontSize: 14, opacity: 0.6, margin: 0 }}>
            Nada comprometido nos próximos meses. Parcelas e despesas fixas
            aparecem aqui automaticamente.
          </p>
        </Card>
      )}

      {months.map((m) => (
        <Card key={`${m.year}-${m.month}`} className="p-4">
          <div className="row between mb-2">
            <h4>
              {MESES[m.month]} de {m.year}
            </h4>
            <strong className="bad-text">{fmt(m.total)}</strong>
          </div>

          <div className="col gap-2">
            {m.items
              .sort((a, b) => b.value - a.value)
              .map((e) => {
                const c = cm[e.categoryId];
                const isInstallment = Number(e.installmentsTotal || 1) > 1;
                return (
                  <div key={e.id} className="row between future-item">
                    <span className="item-sub" style={{ minWidth: 0 }}>
                      {c?.name || "?"}
                      {e.desc ? ` · ${e.desc}` : ""}
                      {isInstallment
                        ? ` · ${e.installmentNumber}/${e.installmentsTotal}`
                        : ""}
                      {e.recurringGroupId ? " · 🔁" : ""}
                    </span>
                    <span className="item-sub" style={{ whiteSpace: "nowrap" }}>
                      {fmt(e.value)}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      ))}
    </div>
  );
}

// Lançamentos de uma fatura (cartão + competência year/month).
function invoiceEntriesFor(entries, cardId, year, month) {
  return entries.filter((e) => {
    if (e.cardId !== cardId) return false;
    const { year: y, month: m } = entryCompetence(e);
    return y === year && m === month;
  });
}

// Fase 5.2: modal (bottom sheet) com o detalhe da fatura e navegação entre meses.
function FaturaModal({ card, data, startYear, startMonth, onClose }) {
  const [ym, setYm] = useState({ year: startYear, month: startMonth });
  const cm = Object.fromEntries(data.categories.map((c) => [c.id, c]));

  const items = invoiceEntriesFor(data.entries, card.id, ym.year, ym.month).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
  const total = items.reduce((a, e) => a + e.value, 0);

  const shift = (delta) => {
    const idx = ym.year * 12 + ym.month + delta;
    setYm({ year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 });
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet fatura-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="row between mb-2">
          <div className="row gap-2">
            <div
              className="card-color-badge"
              style={{ background: card.color || TEAL }}
            >
              <CreditCard size={18} />
            </div>
            <div>
              <h4>{card.name}</h4>
              <p className="item-sub">
                Fecha dia {card.closingDay} · Vence dia {card.dueDay}
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="fatura-nav">
          <button onClick={() => shift(-1)} className="icon-btn">‹</button>
          <div className="fatura-nav-label">
            Fatura de {MESES[ym.month]}/{ym.year}
            <strong>{fmt(total)}</strong>
          </div>
          <button onClick={() => shift(1)} className="icon-btn">›</button>
        </div>

        <div className="col gap-2 fatura-list">
          {items.length === 0 && (
            <p className="empty">Sem lançamentos nesta fatura.</p>
          )}
          {items.map((e) => {
            const c = cm[e.categoryId];
            const isInstallment = Number(e.installmentsTotal || 1) > 1;
            return (
              <div key={e.id} className="row between future-item">
                <span className="item-sub" style={{ minWidth: 0 }}>
                  {c?.name || "?"}
                  {e.desc ? ` · ${e.desc}` : ""}
                  {isInstallment
                    ? ` · ${e.installmentNumber}/${e.installmentsTotal}`
                    : ""}
                </span>
                <span className="item-sub" style={{ whiteSpace: "nowrap" }}>
                  {fmt(e.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Fase 5.1: carrossel horizontal de cartões (olhar rápido) + abre a fatura.
function CartoesCarrossel({ data, year, month }) {
  const [openCard, setOpenCard] = useState(null);
  const cards = data.cards.filter((c) => c.active !== false);
  if (cards.length === 0) return null;

  return (
    <div>
      <div className="carousel">
        {cards.map((card) => {
          const items = invoiceEntriesFor(data.entries, card.id, year, month);
          const invoiceTotal = items.reduce((a, e) => a + e.value, 0);

          const limit = Number(card.limit || card.limitValue || 0);
          // "Usado" = faturas ainda não pagas do cartão.
          const used = data.entries
            .filter((e) => e.cardId === card.id && !e.paid)
            .reduce((a, e) => a + e.value, 0);
          const available = limit - used;
          const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

          return (
            <button
              key={card.id}
              className="carousel-card"
              style={{ background: card.color || TEAL }}
              onClick={() => setOpenCard(card)}
            >
              <div className="row between">
                <span className="cc-name">{card.name}</span>
                <CreditCard size={18} />
              </div>

              <div className="cc-invoice">
                <span>Fatura de {MABR[month]}</span>
                <strong>{fmt(invoiceTotal)}</strong>
              </div>

              <div className="cc-dates">
                Fecha {String(card.closingDay).padStart(2, "0")} · Vence{" "}
                {String(card.dueDay).padStart(2, "0")}
              </div>

              {limit > 0 && (
                <div className="cc-limit">
                  <div className="cc-bar">
                    <div className="cc-bar-fill" style={{ width: `${usedPct}%` }} />
                  </div>
                  <div className="cc-limit-row">
                    <span>Usado {fmt(used)}</span>
                    <span>Disp. {fmt(available)}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {openCard && (
        <FaturaModal
          card={openCard}
          data={data}
          startYear={year}
          startMonth={month}
          onClose={() => setOpenCard(null)}
        />
      )}
    </div>
  );
}

// Fase 3: importação de extrato OFX/CSV com revisão, dedup e aprendizado.
function Importar({ data, api, showToast, beforeBulk }) {
  const [rows, setRows] = useState([]);
  const [dupCount, setDupCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const cardMap = Object.fromEntries(data.cards.map((c) => [c.id, c]));

  const existingFitids = new Set(
    data.entries.map((e) => e.importFitid).filter(Boolean)
  );
  const existingSigs = new Set(
    data.entries.map((e) => `${e.date}|${e.value}|${(e.desc || "").toLowerCase()}`)
  );

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // PDF não é suportado (é binário, não dá pra extrair transações de forma
      // confiável). Avisa o usuário a exportar o extrato como OFX ou CSV.
      if (/\.pdf$/i.test(file.name) || text.startsWith("%PDF")) {
        showToast(
          "PDF não é suportado. No app do banco, exporte o extrato/fatura como OFX ou CSV.",
          "error",
          "Formato inválido"
        );
        setRows([]);
        return;
      }

      const txs = parseStatement(text, file.name);

      if (txs.length === 0) {
        showToast(
          "Não encontrei transações nesse arquivo. Confirme que é um OFX/CSV de extrato.",
          "error",
          "Arquivo"
        );
        setRows([]);
        return;
      }

      // Auto-detecção da conta/banco a partir do OFX. Se já existe uma conta
      // com o mesmo acctId, pré-seleciona; senão guarda os dados p/ criar.
      const acctInfo = parseAccountInfo(text);
      setDetected(acctInfo);
      if (acctInfo) {
        const match = data.accounts.find(
          (a) => acctInfo.acctId && a.acctId === acctInfo.acctId
        );
        if (match) setBulkAccount(match.id);
      }

      let dups = 0;
      const prepared = txs.map((t) => {
        const sig = `${t.date}|${Math.abs(t.amount)}|${t.desc.toLowerCase()}`;
        const isDup =
          (t.fitid && existingFitids.has(t.fitid)) ||
          (!t.fitid && existingSigs.has(sig));
        if (isDup) dups++;

        const rule = matchRule(t.desc, data.categoryRules);
        const cats = data.categories.filter((c) => c.type === t.type);
        const categoryId = rule?.categoryId || cats[0]?.id || "";

        return {
          ...t,
          skip: isDup,
          categoryId,
          cardId: "",
          createRule: false,
          rulePattern: suggestPattern(t.desc),
        };
      });

      setDupCount(dups);
      setRows(prepared);
    } catch (e) {
      console.error(e);
      showToast("Não consegui ler o arquivo.", "error", "Erro");
    } finally {
      event.target.value = "";
    }
  };

  const update = (i, patch) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Fase 4: aplica um cartão a TODAS as despesas de uma vez (fatura por cartão).
  const assignAllToCard = (cardId) =>
    setRows((rs) =>
      rs.map((r) => (r.type === "despesa" ? { ...r, cardId } : r))
    );

  const [bulkCard, setBulkCard] = useState("");
  const [bulkAccount, setBulkAccount] = useState("");
  const [detected, setDetected] = useState(null);

  // Cria uma conta a partir dos dados detectados no OFX e a seleciona.
  const createDetectedAccount = async () => {
    if (!detected) return;
    const id = uid();
    await api.saveAccount({
      id,
      name: detected.org || detected.bankId || "Conta importada",
      kind: detected.kind === "credit" ? "checking" : detected.kind || "checking",
      bankId: detected.bankId || "",
      acctId: detected.acctId || "",
      color: "#4A6FA5",
      active: true,
    });
    setBulkAccount(id);
  };

  const importar = async () => {
    const toImport = rows.filter((r) => !r.skip && r.categoryId);
    if (toImport.length === 0) {
      showToast("Nada para importar.", "error", "Importação");
      return;
    }

    setBusy(true);
    try {
      await beforeBulk?.(); // backup automático (Fase 6-G)

      const entries = [];
      const rules = [];

      for (const r of toImport) {
        const card = r.cardId ? cardMap[r.cardId] : null;
        const invoiceInfo = card
          ? calculateInvoiceInfo(r.date, card, 0)
          : { invoiceMonth: null, invoiceYear: null, invoiceDueDate: "" };

        entries.push({
          id: uid(),
          date: r.date,
          categoryId: r.categoryId,
          desc: r.desc,
          value: Math.abs(r.amount),
          type: r.type,
          paymentMethod: card ? "credit_card" : "pix",
          cardId: card ? r.cardId : "",
          accountId: card ? "" : bulkAccount,
          installmentGroupId: "",
          installmentNumber: 1,
          installmentsTotal: 1,
          importFitid: r.fitid || "",
          ...invoiceInfo,
        });

        if (r.createRule && r.rulePattern.trim()) {
          rules.push({
            id: uid(),
            pattern: r.rulePattern.trim().toLowerCase(),
            categoryId: r.categoryId,
            createdAt: new Date().toISOString(),
          });
        }
      }

      for (const rule of rules) await put("categoryRules", rule);
      await api.addEntries(entries);

      showToast(
        `${entries.length} lançamentos importados` +
          (dupCount ? ` · ${dupCount} ignorados (já existiam)` : "") +
          (rules.length ? ` · ${rules.length} regras criadas` : "")
      );
      setRows([]);
      setDupCount(0);
      setBulkCard("");
      setBulkAccount("");
      setDetected(null);
    } catch (e) {
      console.error(e);
      showToast(e?.message || "Erro ao importar.", "error", "Erro");
    } finally {
      setBusy(false);
    }
  };

  const importCount = rows.filter((r) => !r.skip && r.categoryId).length;

  return (
    <div className="col gap-4">
      <Card className="p-4">
        <h3>Importar extrato</h3>
        <p className="item-sub" style={{ marginTop: 4 }}>
          Aceita <b>.ofx</b> (extrato do banco ou fatura do cartão) e <b>.csv</b>.
          <b> PDF não funciona</b> — no app do banco, procure "exportar/compartilhar"
          e escolha OFX ou CSV. A data e o valor vêm prontos; você só confere a
          categoria. Para fatura de cartão, use "Aplicar a todas" e as despesas
          caem na competência certa automaticamente.
        </p>

        {/*
          Sem "accept": o iOS/iPhone acinzenta arquivos .ofx (extensão que ele
          não reconhece), impedindo a seleção. Como detectamos o formato pelo
          conteúdo do arquivo, não filtramos por extensão aqui.
        */}
        <input
          ref={fileRef}
          type="file"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        <Btn className="mt-3" onClick={() => fileRef.current?.click()}>
          <FileUp size={16} />
          Escolher arquivo
        </Btn>
      </Card>

      {rows.length > 0 && (
        <>
          <Card className="p-3 col gap-3">
            <div className="row between">
              <span className="item-sub">
                {rows.length} transações · {importCount} a importar
                {dupCount ? ` · ${dupCount} já existiam` : ""}
              </span>
              <Btn onClick={importar} disabled={busy || importCount === 0}>
                {busy ? "Importando..." : `Importar ${importCount}`}
              </Btn>
            </div>

            {data.cards.filter((c) => c.active !== false).length > 0 && (
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                <span className="item-sub" style={{ whiteSpace: "nowrap" }}>
                  Fatura de cartão? Aplicar a todas:
                </span>
                <SelectInput
                  value={bulkCard}
                  onChange={(e) => {
                    setBulkCard(e.target.value);
                    assignAllToCard(e.target.value);
                  }}
                  style={{ flex: 1, minWidth: 140 }}
                >
                  <option value="">Dinheiro/Pix/Débito</option>
                  {data.cards
                    .filter((c) => c.active !== false)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Cartão {c.name}
                      </option>
                    ))}
                </SelectInput>
              </div>
            )}

            {/* Conta/banco de destino (para lançamentos que não são de cartão) */}
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="item-sub" style={{ whiteSpace: "nowrap" }}>
                Conta / banco:
              </span>
              <SelectInput
                value={bulkAccount}
                onChange={(e) => setBulkAccount(e.target.value)}
                style={{ flex: 1, minWidth: 140 }}
              >
                <option value="">Sem conta definida</option>
                {data.accounts
                  .filter((a) => a.active !== false)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </SelectInput>
            </div>

            {detected &&
              !data.accounts.some(
                (a) => detected.acctId && a.acctId === detected.acctId
              ) && (
                <div className="import-detected">
                  <span className="item-sub">
                    Detectei a conta{" "}
                    <b>{detected.org || detected.bankId || "do extrato"}</b>
                    {detected.acctId ? ` (conta ${detected.acctId})` : ""}. Criar
                    e usar nesta importação?
                  </span>
                  <Btn variant="ghost" onClick={createDetectedAccount}>
                    <Plus size={14} />
                    Criar conta
                  </Btn>
                </div>
              )}
          </Card>

          <div className="col gap-2">
            {rows.map((r, i) => {
              const cats = data.categories.filter((c) => c.type === r.type);
              return (
                <Card
                  key={i}
                  className="p-3 col gap-2"
                  style={{ opacity: r.skip ? 0.5 : 1 }}
                >
                  <div className="row between">
                    <div style={{ minWidth: 0 }}>
                      <div className="item-title">{r.desc}</div>
                      <div className="item-sub">
                        {r.date} ·{" "}
                        <b className={r.type === "receita" ? "good-text" : "bad-text"}>
                          {fmt(Math.abs(r.amount))}
                        </b>{" "}
                        · {r.type}
                        {r.skip ? " · já importado" : ""}
                      </div>
                    </div>
                    <label className="row gap-1 item-sub" style={{ whiteSpace: "nowrap" }}>
                      <input
                        type="checkbox"
                        checked={!r.skip}
                        onChange={(e) => update(i, { skip: !e.target.checked })}
                      />
                      incluir
                    </label>
                  </div>

                  {!r.skip && (
                    <div className="grid2 gap-2">
                      <SelectInput
                        value={r.categoryId}
                        onChange={(e) => update(i, { categoryId: e.target.value })}
                      >
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </SelectInput>

                      {r.type === "despesa" && (
                        <SelectInput
                          value={r.cardId}
                          onChange={(e) => update(i, { cardId: e.target.value })}
                        >
                          <option value="">Dinheiro/Pix/Débito</option>
                          {data.cards
                            .filter((c) => c.active !== false)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                Cartão {c.name}
                              </option>
                            ))}
                        </SelectInput>
                      )}
                    </div>
                  )}

                  {!r.skip && (
                    <label className="row gap-2 item-sub">
                      <input
                        type="checkbox"
                        checked={r.createRule}
                        onChange={(e) => update(i, { createRule: e.target.checked })}
                      />
                      Lembrar: contém
                      <input
                        className="rule-inline-input"
                        value={r.rulePattern}
                        onChange={(e) => update(i, { rulePattern: e.target.value })}
                        disabled={!r.createRule}
                      />
                    </label>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Fase 3.6: gerenciar as regras de categorização aprendidas.
function Regras({ data, api }) {
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState(
    data.categories[0]?.id || ""
  );

  const cm = Object.fromEntries(data.categories.map((c) => [c.id, c]));
  const rules = [...data.categoryRules].sort((a, b) =>
    a.pattern.localeCompare(b.pattern)
  );

  const add = () => {
    if (!pattern.trim() || !categoryId) {
      alert("Informe o padrão e a categoria.");
      return;
    }
    api.saveRule({
      id: uid(),
      pattern: pattern.trim().toLowerCase(),
      categoryId,
      createdAt: new Date().toISOString(),
    });
    setPattern("");
  };

  return (
    <div className="col gap-4">
      <Card className="p-4">
        <h3>Nova regra</h3>
        <p className="item-sub" style={{ marginTop: 4 }}>
          Quando a descrição <b>contém</b> o texto, a categoria é sugerida
          automaticamente na próxima importação.
        </p>

        <div className="grid2 gap-3 mt-3">
          <Field label="Contém (texto)">
            <TextInput
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="ifood"
            />
          </Field>

          <Field label="Categoria">
            <SelectInput
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Btn onClick={add} className="mt-3">
          <Plus size={16} />
          Adicionar regra
        </Btn>
      </Card>

      <div className="col gap-2">
        {rules.length === 0 && (
          <p className="empty">Nenhuma regra ainda.</p>
        )}

        {rules.map((r) => (
          <Card key={r.id} className="p-3 row between">
            <span className="item-title" style={{ minWidth: 0 }}>
              contém <b>{r.pattern}</b> →{" "}
              {cm[r.categoryId]?.name || "categoria removida"}
            </span>
            <DeleteButton onClick={() => api.delRule(r.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function Mensal({ data, api, month, setMonth }) {
  const getFirstCategoryByType = (type) =>
    data.categories.find((category) => category.type === type)?.id || "";

  const getFirstActiveCard = () =>
    data.cards.find((card) => card.active !== false)?.id || "";

  const [f, setF] = useState({
    date: todayISO(),
    categoryId: getFirstCategoryByType("despesa"),
    desc: "",
    value: "",
    type: "despesa",
    paymentMethod: "pix",
    cardId: "",
    accountId: "",
    isInstallment: false,
    installmentsTotal: "1",
    isRecurring: false,
    recurringMonths: "12",
  });

  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);

  useEffect(() => {
    const validCategory = data.categories.some(
      (category) => category.id === f.categoryId && category.type === f.type
    );

    if (!validCategory) {
      setF((current) => ({
        ...current,
        categoryId: getFirstCategoryByType(current.type),
      }));
    }
  }, [data.categories, f.categoryId, f.type]);

  useEffect(() => {
    if (f.paymentMethod === "credit_card" && !f.cardId && data.cards.length > 0) {
      setF((current) => ({
        ...current,
        cardId: getFirstActiveCard(),
      }));
    }

    if (f.paymentMethod !== "credit_card" && f.cardId) {
      setF((current) => ({
        ...current,
        cardId: "",
        isInstallment: false,
        installmentsTotal: "1",
      }));
    }
  }, [f.paymentMethod, f.cardId, data.cards]);

  const me = data.entries
    .filter((e) => {
      // Despesas de cartão caem no mês da FATURA (invoiceMonth/invoiceYear),
      // não no mês da data da compra — senão a compra aparece no mês errado
      // quando o cartão fecha perto da virada do mês.
      if (
        e.paymentMethod === "credit_card" &&
        e.invoiceMonth !== null &&
        e.invoiceMonth !== undefined &&
        e.invoiceYear !== null &&
        e.invoiceYear !== undefined
      ) {
        return Number(e.invoiceMonth) === month && Number(e.invoiceYear) === thisYear;
      }

      const d = localDate(e.date);
      return d.getMonth() === month && d.getFullYear() === thisYear;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const cm = Object.fromEntries(data.categories.map((c) => [c.id, c]));
  const cardMap = Object.fromEntries(data.cards.map((card) => [card.id, card]));
  const filteredCategories = data.categories.filter((c) => c.type === f.type);
  const activeCards = data.cards.filter((card) => card.active !== false);
  const activeAccounts = data.accounts.filter((acc) => acc.active !== false);

  const add = async () => {
    // Trava síncrona: evita gravação duplicada por toque duplo (dois taps
    // disparam antes do React atualizar o estado; o ref é imediato).
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(true);

    try {
      if (!f.value || !f.categoryId) {
        alert("Informe o valor e selecione uma categoria.");
        return;
      }

      if (f.paymentMethod === "credit_card" && !f.cardId) {
        alert("Selecione um cartão para lançar no crédito.");
        return;
      }

      const rawValue = parseMoney(f.value);

      if (!rawValue || rawValue <= 0) {
        alert("Informe um valor válido.");
        return;
      }

      const selectedCard = cardMap[f.cardId];
      const isCreditCard = f.paymentMethod === "credit_card";

      if (isCreditCard && !selectedCard) {
        alert("Cartão não encontrado. Cadastre ou selecione outro cartão.");
        return;
      }

      const installmentsTotal =
        isCreditCard && f.isInstallment
          ? Math.max(1, Number(f.installmentsTotal || 1))
          : 1;

      if (isCreditCard && f.isInstallment && installmentsTotal < 2) {
        alert("Para parcelar, informe pelo menos 2 parcelas.");
        return;
      }

      const installmentGroupId = installmentsTotal > 1 ? uid() : "";
      const installmentAmounts = splitInstallments(rawValue, installmentsTotal);

      const entriesToSave = [];

      // Recorrência (Fase 2.1): só para lançamentos não parcelados. Gera uma
      // ocorrência por mês, avançando a data e recalculando a fatura por mês.
      const isRecurring = f.isRecurring && !(isCreditCard && f.isInstallment);
      const recurringMonths = isRecurring
        ? Math.max(2, Math.min(60, Number(f.recurringMonths || 12)))
        : 1;

      if (installmentsTotal === 1 && isRecurring) {
        const recurringGroupId = uid();
        const baseDate = new Date(`${f.date}T12:00:00`);
        const baseDay = baseDate.getDate();

        for (let index = 0; index < recurringMonths; index++) {
          const occYear = baseDate.getFullYear();
          const occMonth = baseDate.getMonth() + index;
          const safeDay = getSafeDay(occYear, occMonth, baseDay);
          const occDate = new Date(occYear, occMonth, safeDay, 12, 0, 0);
          const occIso = formatDateISO(occDate);

          const invoiceInfo =
            isCreditCard && selectedCard
              ? calculateInvoiceInfo(occIso, selectedCard, 0)
              : { invoiceMonth: null, invoiceYear: null, invoiceDueDate: "" };

          entriesToSave.push({
            id: uid(),
            date: occIso,
            categoryId: f.categoryId,
            desc: f.desc,
            value: rawValue,
            type: f.type,
            paymentMethod: f.paymentMethod,
            cardId: isCreditCard ? f.cardId : "",
            accountId: isCreditCard ? "" : f.accountId,
            installmentGroupId: "",
            installmentNumber: 1,
            installmentsTotal: 1,
            recurringGroupId,
            ...invoiceInfo,
          });
        }
      } else if (installmentsTotal === 1) {
        const invoiceInfo =
          isCreditCard && selectedCard
            ? calculateInvoiceInfo(f.date, selectedCard, 0)
            : {
              invoiceMonth: null,
              invoiceYear: null,
              invoiceDueDate: "",
            };

        entriesToSave.push({
          id: uid(),
          date: f.date,
          categoryId: f.categoryId,
          desc: f.desc,
          value: rawValue,
          type: f.type,
          paymentMethod: f.paymentMethod,
          cardId: isCreditCard ? f.cardId : "",
          accountId: isCreditCard ? "" : f.accountId,
          installmentGroupId: "",
          installmentNumber: 1,
          installmentsTotal: 1,
          ...invoiceInfo,
        });
      } else {
        for (let index = 0; index < installmentsTotal; index++) {
          const invoiceInfo = calculateInvoiceInfo(f.date, selectedCard, index);
          const installmentDate = invoiceInfo.invoiceDueDate || f.date;

          entriesToSave.push({
            id: uid(),
            date: installmentDate,
            categoryId: f.categoryId,
            desc: `${f.desc || "Compra parcelada"} (${index + 1}/${installmentsTotal})`,
            value: installmentAmounts[index],
            type: f.type,
            paymentMethod: "credit_card",
            cardId: f.cardId,
            installmentGroupId,
            installmentNumber: index + 1,
            installmentsTotal,
            ...invoiceInfo,
          });
        }
      }

      await api.addEntries(entriesToSave);

      setF({
        ...f,
        desc: "",
        value: "",
        isInstallment: false,
        installmentsTotal: "1",
        isRecurring: false,
        recurringMonths: "12",
        cardId: f.paymentMethod === "credit_card" ? f.cardId : "",
      });
    } catch (error) {
      console.error("Erro ao adicionar lançamento:", error);
      alert(error?.message || "Erro ao adicionar lançamento.");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const rec = me
    .filter((e) => e.type === "receita")
    .reduce((a, e) => a + e.value, 0);

  const des = me
    .filter((e) => e.type === "despesa")
    .reduce((a, e) => a + e.value, 0);

  const creditTotal = me
    .filter((e) => e.paymentMethod === "credit_card")
    .reduce((a, e) => a + e.value, 0);

  const paymentLabels = {
    pix: "Pix/Dinheiro",
    debit: "Débito",
    credit_card: "Crédito",
  };

  return (
    <div className="col gap-4">
      <p className="viewing-month">
        Vendo: <strong>{MESES[month]} de {thisYear}</strong>
      </p>

      <div className="months">
        {MABR.map((m, idx) => (
          <button
            key={m}
            onClick={() => setMonth(idx)}
            className={`month-chip ${month === idx ? "month-chip-active" : ""}`}
          >
            {m}
          </button>
        ))}
      </div>

      <CartoesCarrossel data={data} year={thisYear} month={month} />

      <div className="grid2 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Receitas"
          value={fmt(rec)}
          accent={GOOD}
        />

        <StatCard
          icon={TrendingUp}
          label="Despesas"
          value={fmt(des)}
          accent={BAD}
        />

        <StatCard
          icon={CreditCard}
          label="Cartão"
          value={fmt(creditTotal)}
          accent={GOLD}
        />
      </div>

      <Card className="p-4" data-tour="entry-card">
        <h3>Novo lançamento - {MESES[month]}</h3>

        <div className="grid2 gap-3">
          <Field label="Data da compra">
            <TextInput
              type="date"
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </Field>

          <Field label="Tipo">
            <SelectInput
              value={f.type}
              onChange={(e) => {
                const nextType = e.target.value;

                setF({
                  ...f,
                  type: nextType,
                  categoryId: getFirstCategoryByType(nextType),
                  paymentMethod:
                    nextType === "receita" && f.paymentMethod === "credit_card"
                      ? "pix"
                      : f.paymentMethod,
                  cardId:
                    nextType === "receita" && f.paymentMethod === "credit_card"
                      ? ""
                      : f.cardId,
                  isInstallment:
                    nextType === "receita" ? false : f.isInstallment,
                  installmentsTotal:
                    nextType === "receita" ? "1" : f.installmentsTotal,
                });
              }}
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </SelectInput>
          </Field>

          <Field label="Categoria">
            <SelectInput
              value={f.categoryId}
              onChange={(e) => setF({ ...f, categoryId: e.target.value })}
            >
              {filteredCategories.length === 0 ? (
                <option value="">Nenhuma categoria disponível</option>
              ) : (
                filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </SelectInput>
          </Field>

          <Field label="Valor total">
            <NumberInput
              value={f.value}
              onChange={(e) => setF({ ...f, value: e.target.value })}
              placeholder="0,00"
              data-tour="entry-value"
            />
          </Field>

          <Field label="Forma de pagamento">
            <SelectInput
              data-tour="entry-payment"
              value={f.paymentMethod}
              onChange={(e) => {
                const method = e.target.value;

                setF({
                  ...f,
                  paymentMethod: method,
                  cardId: method === "credit_card" ? getFirstActiveCard() : "",
                  isInstallment: method === "credit_card" ? f.isInstallment : false,
                  installmentsTotal:
                    method === "credit_card" ? f.installmentsTotal : "1",
                });
              }}
            >
              <option value="pix">Pix/Dinheiro</option>
              <option value="debit">Débito</option>

              {f.type === "despesa" && (
                <option value="credit_card">Cartão de crédito</option>
              )}
            </SelectInput>
          </Field>

          {f.paymentMethod === "credit_card" && (
            <Field label="Cartão">
              <SelectInput
                value={f.cardId}
                onChange={(e) => setF({ ...f, cardId: e.target.value })}
              >
                {activeCards.length === 0 ? (
                  <option value="">Cadastre um cartão primeiro</option>
                ) : (
                  activeCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))
                )}
              </SelectInput>
            </Field>
          )}

          {f.paymentMethod !== "credit_card" && activeAccounts.length > 0 && (
            <Field label="Conta / Banco">
              <SelectInput
                value={f.accountId}
                onChange={(e) => setF({ ...f, accountId: e.target.value })}
              >
                <option value="">Sem conta definida</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}

          {f.paymentMethod === "credit_card" && (
            <Field label="Compra parcelada?">
              <SelectInput
                value={f.isInstallment ? "yes" : "no"}
                onChange={(e) =>
                  setF({
                    ...f,
                    isInstallment: e.target.value === "yes",
                    installmentsTotal:
                      e.target.value === "yes" ? f.installmentsTotal : "1",
                  })
                }
              >
                <option value="no">Não</option>
                <option value="yes">Sim</option>
              </SelectInput>
            </Field>
          )}

          {f.paymentMethod === "credit_card" && f.isInstallment && (
            <Field label="Quantidade de parcelas">
              <NumberInput
                value={f.installmentsTotal}
                onChange={(e) =>
                  setF({ ...f, installmentsTotal: e.target.value })
                }
                min="2"
                max="48"
              />
            </Field>
          )}

          {!(f.paymentMethod === "credit_card" && f.isInstallment) && (
            <Field label="Repetir todo mês?">
              <SelectInput
                value={f.isRecurring ? "yes" : "no"}
                onChange={(e) =>
                  setF({ ...f, isRecurring: e.target.value === "yes" })
                }
              >
                <option value="no">Não</option>
                <option value="yes">Sim (fixo)</option>
              </SelectInput>
            </Field>
          )}

          {f.isRecurring && !(f.paymentMethod === "credit_card" && f.isInstallment) && (
            <Field label="Por quantos meses">
              <NumberInput
                value={f.recurringMonths}
                onChange={(e) => setF({ ...f, recurringMonths: e.target.value })}
                min="2"
                max="60"
              />
            </Field>
          )}

          <Field label="Descrição">
            <TextInput
              value={f.desc}
              onChange={(e) => setF({ ...f, desc: e.target.value })}
              placeholder="opcional"
            />
          </Field>
        </div>

        {f.paymentMethod === "credit_card" && f.isInstallment && parseMoney(f.value) > 0 && (() => {
          const total = parseMoney(f.value);
          const count = Math.max(1, Number(f.installmentsTotal || 1));
          const parts = splitInstallments(total, count);
          const first = parts[0];
          const last = parts[parts.length - 1];
          const uneven = first !== last;

          return (
            <div className="installment-preview">
              {count}x de <strong>{fmt(first)}</strong>
              {uneven && (
                <>
                  {" "}
                  (últimas de <strong>{fmt(last)}</strong>)
                </>
              )}
              {" · total "}
              {fmt(total)}
            </div>
          );
        })()}

        {f.paymentMethod === "credit_card" && f.cardId && f.date && (() => {
          const card = cardMap[f.cardId];
          if (!card) return null;

          const info = calculateInvoiceInfo(f.date, card, 0);

          return (
            <div className="installment-preview">
              Essa compra entra na fatura de{" "}
              <strong>{MESES[info.invoiceMonth]} de {info.invoiceYear}</strong>
              {" "}(vence {info.invoiceDueDate?.split("-").reverse().join("/")})
            </div>
          );
        })()}

        <Btn onClick={add} className="mt-3" data-tour="entry-add" disabled={adding}>
          <Plus size={16} />
          {adding ? "Adicionando..." : "Adicionar"}
        </Btn>
      </Card>

      <div className="col gap-2">
        {me.map((e) => {
          const c = cm[e.categoryId];
          const card = e.cardId ? cardMap[e.cardId] : null;
          const hasInvoice = e.invoiceDueDate && e.paymentMethod === "credit_card";
          const isInstallment = Number(e.installmentsTotal || 1) > 1;
          const isRecurring = !!e.recurringGroupId;

          return (
            <Card key={e.id} className="p-3 row between">
              <div className="row gap-2" style={{ minWidth: 0, flex: 1 }}>
                <span className="dot" style={{ background: c?.color || "#999" }} />

                <div style={{ minWidth: 0 }}>
                  <div className="item-title">
                    {c?.name || "?"}
                    {e.desc ? ` · ${e.desc}` : ""}
                  </div>

                  <div className="item-sub">
                    {e.date}
                    {" · "}
                    {paymentLabels[e.paymentMethod || "pix"] || "Pix/Dinheiro"}
                    {card ? ` · ${card.name}` : ""}
                    {isInstallment
                      ? ` · Parcela ${e.installmentNumber}/${e.installmentsTotal}`
                      : ""}
                    {isRecurring ? " · 🔁 Fixo" : ""}
                    {hasInvoice ? ` · Vence ${e.invoiceDueDate}` : ""}
                    {e.paid ? " · " : ""}
                    {e.paid && <b className="good-text">paga ✓</b>}
                  </div>
                </div>
              </div>

              <div className="row gap-3" style={{ flexShrink: 0 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    color: e.type === "receita" ? GOOD : BAD,
                  }}
                >
                  {e.type === "receita" ? "+" : "-"}
                  {fmt(e.value)}
                </span>

                <DeleteButton
                  onClick={() => {
                    if (isRecurring || isInstallment) {
                      const field = isRecurring
                        ? "recurringGroupId"
                        : "installmentGroupId";
                      const groupId = e[field];
                      const label = isRecurring ? "recorrência fixa" : "parcelamento";
                      const all = confirm(
                        `Este lançamento faz parte de um ${label}.\n\n` +
                          "OK = excluir a série toda\nCancelar = excluir só este mês"
                      );
                      if (all) api.delEntryGroup(field, groupId);
                      else api.delEntry(e.id);
                    } else {
                      api.delEntry(e.id);
                    }
                  }}
                />
              </div>
            </Card>
          );
        })}

        {me.length === 0 && (
          <p className="empty">Nenhum lançamento em {MESES[month]}.</p>
        )}
      </div>
    </div>
  );
} function Categorias({ data, api }) {
  const [f, setF] = useState({
    name: "",
    type: "despesa",
    color: TEAL,
  });

  const add = () => {
    if (!f.name) return;

    api.addCategory({
      id: uid(),
      ...f,
    });

    setF({
      name: "",
      type: f.type,
      color: TEAL,
    });
  };

  return (
    <div className="col gap-4">
      <Card className="p-4">
        <h3>Nova categoria</h3>

        <div className="grid2 gap-3">
          <Field label="Nome">
            <TextInput
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Educação"
            />
          </Field>

          <Field label="Tipo">
            <SelectInput
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </SelectInput>
          </Field>

          <Field label="Cor">
            <div className="color-picker-wrap">
              <div className="color-preview" style={{ background: f.color }}>
                <Palette size={16} />
              </div>

              <input
                type="color"
                value={f.color}
                onChange={(e) => setF({ ...f, color: e.target.value })}
                className="color-inp"
              />

              <span className="color-value">{f.color}</span>
            </div>
          </Field>
        </div>

        <Btn onClick={add} className="mt-3">
          <Plus size={16} />
          Adicionar categoria
        </Btn>
      </Card>

      {["receita", "despesa"].map((type) => (
        <div key={type}>
          <h4 className="section">
            {type === "receita" ? "Receitas" : "Despesas"}
          </h4>

          <div className="col gap-2">
            {data.categories
              .filter((c) => c.type === type)
              .map((c) => (
                <Card key={c.id} className="p-3 row between">
                  <div className="row gap-2">
                    <span className="dot" style={{ background: c.color }} />
                    <span className="item-title">{c.name}</span>
                  </div>

                  <DeleteButton onClick={() => api.delCategory(c.id)} />
                </Card>
              ))}
          </div>
        </div>
      ))}

      <h4 className="section">Regras de categorização (importação)</h4>
      <Regras data={data} api={api} />
    </div>
  );
}

const EMPTY_CARD_FORM = {
  name: "",
  limit: "",
  closingDay: "25",
  dueDay: "2",
  color: "#7C3AED",
  active: true,
};

function Cartoes({ data, api, month }) {
  const [f, setF] = useState(EMPTY_CARD_FORM);
  const [editingId, setEditingId] = useState(null);

  const startEdit = (card) => {
    setEditingId(card.id);
    setF({
      name: card.name || "",
      limit: String(card.limit || card.limitValue || ""),
      closingDay: String(card.closingDay || 25),
      dueDay: String(card.dueDay || 2),
      color: card.color || "#7C3AED",
      active: card.active !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setF(EMPTY_CARD_FORM);
  };

  const add = () => {
    if (!f.name) {
      alert("Informe o nome do cartão.");
      return;
    }

    api.saveCard({
      id: editingId || uid(),
      name: f.name,
      limit: +(f.limit || 0),
      closingDay: Math.min(31, Math.max(1, +(f.closingDay || 1))),
      dueDay: Math.min(31, Math.max(1, +(f.dueDay || 1))),
      color: f.color || "#2E8B7C",
      active: f.active !== false,
    });

    setEditingId(null);
    setF(EMPTY_CARD_FORM);
  };

  const invoiceEntries = data.entries.filter((entry) => {
    if (entry.paymentMethod !== "credit_card") return false;

    if (
      entry.invoiceMonth !== null &&
      entry.invoiceMonth !== undefined &&
      entry.invoiceYear !== null &&
      entry.invoiceYear !== undefined
    ) {
      return (
        Number(entry.invoiceMonth) === month &&
        Number(entry.invoiceYear) === thisYear
      );
    }

    const date = new Date(`${entry.date}T12:00:00`);

    return date.getMonth() === month && date.getFullYear() === thisYear;
  });

  const creditEntries = data.entries.filter(
    (entry) => entry.paymentMethod === "credit_card"
  );

  const totalLimit = data.cards
    .filter((card) => card.active !== false)
    .reduce((acc, card) => acc + Number(card.limit || 0), 0);

  // Total comprometido no limite: parcelas ainda NÃO pagas.
  // Ao marcar a fatura como paga, essas parcelas liberam o limite.
  const totalLimitUsed = creditEntries
    .filter((entry) => !entry.paid)
    .reduce((acc, entry) => acc + entry.value, 0);

  // Valor da fatura do mês selecionado.
  const totalInvoice = invoiceEntries.reduce((acc, entry) => acc + entry.value, 0);

  const totalAvailable = totalLimit - totalLimitUsed;

  const getInvoiceByCard = (cardId) =>
    invoiceEntries
      .filter((entry) => entry.cardId === cardId)
      .reduce((acc, entry) => acc + entry.value, 0);

  const getLimitUsedByCard = (cardId) =>
    creditEntries
      .filter((entry) => entry.cardId === cardId && !entry.paid)
      .reduce((acc, entry) => acc + entry.value, 0);

  // Lançamentos da fatura do mês, por cartão (para marcar como paga).
  const getInvoiceEntriesByCard = (cardId) =>
    invoiceEntries.filter((entry) => entry.cardId === cardId);

  return (
    <div className="col gap-4">
      <div className="grid2 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Fatura do mês"
          value={fmt(totalInvoice)}
          accent={BAD}
        />

        <StatCard
          icon={CreditCard}
          label="Limite usado"
          value={fmt(totalLimitUsed)}
          accent={BAD}
        />

        <StatCard
          icon={Wallet}
          label="Disponível"
          value={fmt(totalAvailable)}
          accent={totalAvailable >= 0 ? GOOD : BAD}
        />
      </div>

      <Card className="p-4" data-tour="cards-card">
        <h3>{editingId ? "Editar cartão" : "Novo cartão"}</h3>

        <div className="grid2 gap-3">
          <Field label="Nome">
            <TextInput
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Nubank"
            />
          </Field>

          <Field label="Limite">
            <NumberInput
              value={f.limit}
              onChange={(e) => setF({ ...f, limit: e.target.value })}
              placeholder="4000"
            />
          </Field>

          <Field label="Fecha dia">
            <NumberInput
              value={f.closingDay}
              onChange={(e) => setF({ ...f, closingDay: e.target.value })}
              min="1"
              max="31"
            />
          </Field>

          <Field label="Vence dia">
            <NumberInput
              value={f.dueDay}
              onChange={(e) => setF({ ...f, dueDay: e.target.value })}
              min="1"
              max="31"
            />
          </Field>

          <Field label="Cor">
            <div className="color-picker-wrap">
              <div className="color-preview" style={{ background: f.color }}>
                <Palette size={16} />
              </div>

              <input
                type="color"
                value={f.color}
                onChange={(e) => setF({ ...f, color: e.target.value })}
                className="color-inp"
              />

              <span className="color-value">{f.color}</span>
            </div>
          </Field>

          <Field label="Status">
            <SelectInput
              value={f.active ? "active" : "inactive"}
              onChange={(e) =>
                setF({ ...f, active: e.target.value === "active" })
              }
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </SelectInput>
          </Field>
        </div>

        <div className="row gap-2 mt-3">
          <Btn onClick={add}>
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {editingId ? "Salvar alterações" : "Adicionar cartão"}
          </Btn>

          {editingId && (
            <Btn variant="ghost" onClick={cancelEdit}>
              Cancelar
            </Btn>
          )}
        </div>
      </Card>

      <div className="col gap-3">
        {data.cards.map((card) => {
          const invoiceValue = getInvoiceByCard(card.id);
          const used = getLimitUsedByCard(card.id);
          const limit = Number(card.limit || card.limitValue || 0);
          const available = limit - used;
          const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

          const monthInvoice = getInvoiceEntriesByCard(card.id);
          const hasInvoice = monthInvoice.length > 0;
          const invoicePaid =
            hasInvoice && monthInvoice.every((entry) => entry.paid);

          return (
            <Card key={card.id} className="p-4">
              <div className="row between mb-2">
                <div className="row gap-2">
                  <div
                    className="card-color-badge"
                    style={{ background: card.color || TEAL }}
                  >
                    <CreditCard size={18} />
                  </div>

                  <div>
                    <h4>{card.name}</h4>
                    <p className="item-sub">
                      Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                    </p>
                  </div>
                </div>

                <div className="row gap-1">
                  <EditButton title="Editar cartão" onClick={() => startEdit(card)} />
                  <DeleteButton onClick={() => api.delCard(card.id)} />
                </div>
              </div>

              <div className="card-stats">
                <div>
                  <span>Limite</span>
                  <strong>{fmt(limit)}</strong>
                </div>

                <div>
                  <span>Fatura</span>
                  <strong>{fmt(invoiceValue)}</strong>
                </div>

                <div>
                  <span>Limite usado</span>
                  <strong>{fmt(used)}</strong>
                </div>
                <div>
                  <span>Disponível</span>
                  <strong className={available >= 0 ? "good-text" : "bad-text"}>
                    {fmt(available)}
                  </strong>
                </div>
              </div>

              <div className="bar mt-3">
                <div
                  className="bar-fill"
                  style={{
                    width: `${usedPct}%`,
                    background: card.color || TEAL,
                  }}
                />
              </div>

              <div className="row between mt-2">
                <span className="item-sub">
                  {pct(usedPct)} do limite total comprometido
                </span>

                <span
                  className={`status-pill ${card.active !== false ? "status-active" : "status-inactive"
                    }`}
                >
                  {card.active !== false ? "Ativo" : "Inativo"}
                </span>
              </div>

              {hasInvoice && (
                <div className="invoice-pay mt-3">
                  <div className="row between">
                    <span className="item-sub">
                      Fatura de {MESES[month]}
                      {invoicePaid ? " · " : ""}
                      {invoicePaid && <b className="good-text">paga ✓</b>}
                    </span>
                    <strong>{fmt(invoiceValue)}</strong>
                  </div>

                  <Btn
                    variant={invoicePaid ? "ghost" : "solid"}
                    className="mt-2"
                    onClick={() =>
                      api.setInvoicePaid(monthInvoice, !invoicePaid)
                    }
                  >
                    {invoicePaid
                      ? "Reabrir fatura"
                      : "Marcar fatura como paga"}
                  </Btn>
                </div>
              )}
            </Card>
          );
        })}

        {data.cards.length === 0 && (
          <p className="empty">
            Nenhum cartão cadastrado ainda. Cadastre seu primeiro cartão para
            lançar compras no crédito.
          </p>
        )}
      </div>
    </div>
  );
}

function Investimentos({ data, api, darkMode, chartTextColor, chartGridColor }) {
  const [f, setF] = useState({
    date: todayISO(),
    name: "",
    type: "Renda Fixa",
    value: "",
  });

  const add = () => {
    if (!f.name || !f.value) return;

    api.addInvest({
      id: uid(),
      ...f,
      value: +f.value,
    });

    setF({
      ...f,
      name: "",
      value: "",
    });
  };

  const total = data.investments.reduce((a, i) => a + i.value, 0);

  const bt = {};

  for (const i of data.investments) {
    bt[i.type] = (bt[i.type] || 0) + i.value;
  }

  const pie = Object.entries(bt).map(([name, value]) => ({ name, value }));
  const colors = [TEAL, GOLD, "#4A6FA5", "#7A5C8E", BAD];
  return (
    <div className="col gap-4">
      <StatCard
        icon={PiggyBank}
        label="Total investido"
        value={fmt(total)}
        accent={GOLD}
      />

      <Card className="p-4">
        <h3>Novo aporte</h3>

        <div className="grid2 gap-3">
          <Field label="Data">
            <TextInput
              type="date"
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </Field>

          <Field label="Tipo">
            <SelectInput
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
            >
              <option>Renda Fixa</option>
              <option>Ações</option>
              <option>Fundos Imobiliários</option>
              <option>Cripto</option>
              <option>Reserva de Emergência</option>
              <option>Outro</option>
            </SelectInput>
          </Field>

          <Field label="Nome/Ativo">
            <TextInput
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Tesouro Selic"
            />
          </Field>

          <Field label="Valor">
            <NumberInput
              value={f.value}
              onChange={(e) => setF({ ...f, value: e.target.value })}
            />
          </Field>
        </div>

        <Btn onClick={add} className="mt-3">
          <Plus size={16} />
          Adicionar aporte
        </Btn>
      </Card>

      {pie.length > 0 && (
        <Card className="p-4">
          <h3>Carteira por tipo</h3>

          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={{ fontSize: 10, fill: chartTextColor }}
              >
                {pie.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>

              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{
                  background: darkMode ? "#111827" : "#FFFFFF",
                  borderColor: chartGridColor,
                  color: chartTextColor,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="col gap-2">
        {[...data.investments]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((i) => (
            <Card key={i.id} className="p-3 row between">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="item-title">{i.name}</div>
                <div className="item-sub">
                  {i.date} · {i.type}
                </div>
              </div>

              <div className="row gap-3" style={{ flexShrink: 0 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    color: GOLD,
                  }}
                >
                  {fmt(i.value)}
                </span>

                <DeleteButton onClick={() => api.delInvest(i.id)} />
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}

function Metas({ data, api }) {
  const [f, setF] = useState({
    name: "",
    target: "",
    current: "",
    deadline: "",
  });

  const add = () => {
    if (!f.name || !f.target) return;

    api.saveGoal({
      id: uid(),
      ...f,
      target: +f.target,
      current: +(f.current || 0),
    });

    setF({
      name: "",
      target: "",
      current: "",
      deadline: "",
    });
  };

  const addP = (g, delta) =>
    api.saveGoal({
      ...g,
      current: Math.max(0, g.current + delta),
    });

  return (
    <div className="col gap-4">
      <Card className="p-4">
        <h3>Nova meta</h3>

        <div className="grid2 gap-3">
          <Field label="Nome">
            <TextInput
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Reserva de emergência"
            />
          </Field>

          <Field label="Prazo">
            <TextInput
              type="date"
              value={f.deadline}
              onChange={(e) => setF({ ...f, deadline: e.target.value })}
            />
          </Field>

          <Field label="Valor alvo">
            <NumberInput
              value={f.target}
              onChange={(e) => setF({ ...f, target: e.target.value })}
            />
          </Field>

          <Field label="Já tenho">
            <NumberInput
              value={f.current}
              onChange={(e) => setF({ ...f, current: e.target.value })}
            />
          </Field>
        </div>

        <Btn onClick={add} className="mt-3">
          <Plus size={16} />
          Criar meta
        </Btn>
      </Card>

      <div className="col gap-3">
        {data.goals.map((g) => {
          const p =
            g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;

          return (
            <Card key={g.id} className="p-4">
              <div className="row between mb-1">
                <h4>{g.name}</h4>

                <DeleteButton onClick={() => api.delGoal(g.id)} />
              </div>

              {g.deadline && (
                <p className="item-sub" style={{ marginBottom: 8 }}>
                  até {g.deadline}
                </p>
              )}

              <div className="bar">
                <div className="bar-fill" style={{ width: `${p}%` }} />
              </div>

              <div className="row between" style={{ fontSize: 14, marginTop: 8 }}>
                <span>
                  {fmt(g.current)} / {fmt(g.target)}
                </span>

                <span style={{ color: TEAL, fontWeight: 700 }}>{pct(p)}</span>
              </div>

              <div className="row gap-2 mt-3">
                <Btn variant="ghost" onClick={() => addP(g, 100)}>
                  + R$100
                </Btn>

                <Btn variant="ghost" onClick={() => addP(g, 500)}>
                  + R$500
                </Btn>
              </div>
            </Card>
          );
        })}

        {data.goals.length === 0 && (
          <p className="empty">Nenhuma meta cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}

// Ajustes (engrenagem): tudo que se mexe raramente — perfil, categorias (com
// regras), backup, versão e sair. Não ocupa aba na navegação principal.
function Ajustes({
  data,
  api,
  user,
  updateProfile,
  darkMode,
  setDarkMode,
  showToast,
  onReplayTour,
  uploadAvatar,
  deleteAvatar,
  doExport,
  doImport,
  signOut,
}) {
  const backupRef = useRef(null);

  return (
    <div className="col gap-4">
      <Configuracoes
        user={user}
        updateProfile={updateProfile}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        showToast={showToast}
        onReplayTour={onReplayTour}
        uploadAvatar={uploadAvatar}
        deleteAvatar={deleteAvatar}
      />

      <h2 className="section-h">Categorias e regras</h2>
      <Categorias data={data} api={api} />

      <h2 className="section-h">Backup dos dados</h2>
      <Card className="p-4 col gap-3">
        <p className="item-sub" style={{ margin: 0 }}>
          Exporte seus dados em JSON (cópia de segurança e portabilidade / LGPD)
          ou restaure a partir de um arquivo.
        </p>
        <div className="row gap-2">
          <Btn onClick={doExport}>
            <Download size={16} />
            Exportar
          </Btn>
          <Btn variant="ghost" onClick={() => backupRef.current?.click()}>
            <Upload size={16} />
            Restaurar
          </Btn>
          <input
            ref={backupRef}
            type="file"
            accept="application/json"
            onChange={doImport}
            style={{ display: "none" }}
          />
        </div>
      </Card>

      <h2 className="section-h">Sobre</h2>
      <Card className="p-3 row between">
        <span className="item-sub">Versão do app</span>
        <strong>Grana v{APP_VERSION}</strong>
      </Card>

      <Btn variant="ghost" onClick={signOut}>
        <LogOut size={16} />
        Sair da conta
      </Btn>
    </div>
  );
}

function Configuracoes({
  user,
  updateProfile,
  darkMode,
  setDarkMode,
  showToast,
  onReplayTour,
  uploadAvatar,
  deleteAvatar,
}) {
  const [name, setName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ""
  );

  const [photoUrl, setPhotoUrl] = useState(
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || ""
  );

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const presets = [
    "https://api.dicebear.com/7.x/bottts/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
    "https://api.dicebear.com/7.x/identicon/svg?seed=Eduardo",
  ];

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);

    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPhotoUrl(dataUrl); // preview imediato

      // Sobe pro bucket do Supabase e troca pela URL hospedada.
      const blob = dataUrlToBlob(dataUrl);
      const publicUrl = await uploadAvatar(blob);
      setPhotoUrl(publicUrl);

      showToast?.("Foto enviada. Toque em Salvar Perfil para confirmar.");
    } catch (e) {
      console.error(e);
      showToast?.(
        e.message || "Não consegui enviar essa imagem.",
        "error",
        "Erro"
      );
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Remover sua foto de perfil?")) return;

    const wasHosted = /\/avatars\//.test(photoUrl);

    setUploadingPhoto(true);

    try {
      // Só apaga do bucket se a foto atual for um upload nosso
      // (presets/dicebear são URLs externas, não têm arquivo no Storage).
      if (wasHosted) await deleteAvatar();

      setPhotoUrl("");
      await updateProfile({ avatar_url: "" });

      showToast?.("Foto removida.");
    } catch (e) {
      console.error(e);
      showToast?.(e.message || "Não consegui remover a foto.", "error", "Erro");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await updateProfile({
        full_name: name,
        avatar_url: photoUrl,
      });

      showToast?.("Configurações salvas com sucesso.");
    } catch (e) {
      console.error(e);
      showToast?.("Erro ao salvar perfil.", "error", "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col gap-4">
      <Card className="p-4">
        <h3>Editar Perfil</h3>

        <div className="profile-preview">
          <div className="profile-avatar">
            {photoUrl ? (
              <img src={photoUrl} alt="Foto de perfil" />
            ) : (
              <Wallet size={26} />
            )}
          </div>

          <div>
            <div className="profile-title">{name || "Seu perfil"}</div>
            <div className="profile-subtitle">
              Nome e foto usados no cabeçalho do app.
            </div>
          </div>
        </div>

        <div className="col gap-3">
          <Field label="Nome de Exibição">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu Nome"
            />
          </Field>

          <Field label="Foto de Perfil">
            <div className="photo-actions">
              <label className="photo-upload-btn">
                <ImagePlus size={16} />
                {uploadingPhoto ? "Carregando..." : "Escolher da galeria"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: "none" }}
                />
              </label>

              {photoUrl && (
                <button
                  className="photo-remove-btn"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  type="button"
                >
                  Remover foto
                </button>
              )}
            </div>
          </Field>

          <div>
            <span className="field-label avatar-label">Imagens rápidas</span>

            <div className="avatar-grid">
              {presets.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setPhotoUrl(url)}
                  className={`avatar-option ${photoUrl === url ? "avatar-option-active" : ""
                    }`}
                  type="button"
                >
                  <img src={url} alt={`avatar-${idx}`} />
                </button>
              ))}
            </div>
          </div>

          <Btn onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? "Salvando..." : "Salvar Perfil"}
          </Btn>
        </div>
      </Card>

      <Card className="p-4">
        <h3>Preferências de Aparência</h3>

        <div className="row between">
          <div>
            <h4 style={{ fontSize: 14 }}>Modo Escuro</h4>
            <p className="item-sub">
              Ativa o visual de cores escuras para o app.
            </p>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>
      </Card>

      <Card className="p-4">
        <h3>Ajuda</h3>

        <div className="row between">
          <div>
            <h4 style={{ fontSize: 14 }}>Tutorial do app</h4>
            <p className="item-sub">
              Refaça o tour guiado mostrando como lançar e usar o app.
            </p>
          </div>

          <Btn variant="ghost" onClick={onReplayTour}>
            Rever tutorial
          </Btn>
        </div>
      </Card>
    </div>
  );
}

const CSS = `
:root {
  --ink: #1C2431;
  --navy: #22304A;
  --teal: #2E8B7C;
  --cream: #F6F5F1;
  --panel: #FFFFFF;
  --border: #E3E1DA;
  --good: #2E8B7C;
  --bad: #C1543C;
  --gold: #D3A44B;
}

.dark {
  --ink: #E3E1DA;
  --navy: #151E2E;
  --teal: #3AAFA9;
  --cream: #0B0F19;
  --panel: #111827;
  --border: #1F2937;
  --good: #3AAFA9;
  --bad: #E76F51;
  --gold: #E5B85A;
}

.app {
  min-height: 100%;
  background: var(--cream);
  color: var(--ink);
  /* Reserva exatamente a altura real do menu (medida em JS via --nav-h),
     mais uma folga. Fallback caso o JS ainda não tenha medido. */
  padding-bottom: calc(var(--nav-h, 96px) + 16px);
  overflow-x: hidden;
}

.hdr {
  padding: 24px 20px 16px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--navy);
}

.hdr h1 {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.hdr p {
  font-size: 12px;
  margin: 0;
  color: var(--gold);
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--teal);
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255,255,255,.12);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

main {
  padding: 16px;
  max-width: 640px;
  margin: 0 auto;
}

.nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--panel);
  border-top: 1px solid var(--border);
  padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
  display: flex;
  gap: 2px;
  max-width: 640px;
  margin: 0 auto;
  z-index: 20;
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.10);
}

.tab {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 14px;
  padding: 9px 1px;
  font-size: 10.5px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  min-width: 0;
  color: var(--ink);
  -webkit-appearance: none;
  appearance: none;
  transition: color .15s ease, background .15s ease;
}

.tab span {
  line-height: 1;
  letter-spacing: -0.2px;
}

.tab svg {
  width: 22px;
  height: 22px;
}

/* Aba ativa: realce teal sutil (sem o fundo branco padrão do botão) */
.tab-active {
  background: rgba(46, 139, 124, 0.14);
  color: var(--teal);
}

.tab-active svg {
  color: var(--teal);
}

.tab:not(.tab-active) {
  background: transparent;
  color: var(--ink);
  opacity: .5;
}

.tab:not(.tab-active):active {
  opacity: .8;
}

/* Fundo (overscroll/safe-area) acompanha o tema, casando com o cabeçalho */
html, body { background: var(--navy); }

/* Bottom sheet do menu "Mais" */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(17, 24, 39, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-end;
  animation: onb-in 0.2s ease;
}

.sheet {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  background: var(--panel);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border-top: 1px solid var(--border);
  padding: 10px 14px calc(18px + env(safe-area-inset-bottom));
  box-shadow: 0 -14px 40px rgba(0, 0, 0, 0.3);
  animation: sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-handle {
  width: 42px;
  height: 5px;
  border-radius: 999px;
  background: var(--border);
  margin: 4px auto 12px;
}

.sheet-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--ink);
  opacity: 0.5;
  padding: 0 6px 8px;
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  padding: 14px 10px;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
}

.sheet-item:active {
  background: rgba(46, 139, 124, 0.10);
}

.sheet-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(46, 139, 124, 0.12);
  color: var(--teal);
  flex-shrink: 0;
}

.sheet-item-active {
  background: rgba(46, 139, 124, 0.12);
  color: var(--teal);
}

@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
  color: var(--ink);
}

.col {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
}

.between {
  justify-content: space-between;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.gap-1 {
  gap: 4px;
}

.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}

.gap-4 {
  gap: 16px;
}

.p-3 {
  padding: 12px;
}

.p-4 {
  padding: 16px;
}

.p-5 {
  padding: 20px;
}

.mt-1 {
  margin-top: 4px;
}

.mt-2 {
  margin-top: 8px;
}

.mt-3 {
  margin-top: 12px;
}

.mb-1 {
  margin-bottom: 4px;
}

.mb-2 {
  margin-bottom: 8px;
}

h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 12px;
}

h4 {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}

.section {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--ink);
  opacity: .5;
  margin: 0 0 8px;
}

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .03em;
  font-weight: 600;
  color: var(--ink);
  opacity: .55;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
}

.stat-sub {
  font-size: 12px;
  color: var(--ink);
  opacity: .5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

.field-label {
  font-weight: 500;
  color: var(--ink);
  opacity: .7;
}

.inp {
  border: 1px solid var(--border);
  background: var(--cream);
  color: var(--ink);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
  outline: none;
  min-width: 0;
}

.sel {
  padding-right: 32px;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D'12'%20height%3D'8'%20viewBox%3D'0%200%2012%208'%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3Cpath%20d%3D'M1%201l5%205%205-5'%20stroke%3D'%231C2431'%20stroke-width%3D'1.5'%20fill%3D'none'%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.btn {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  cursor: pointer;
}

.btn-accent {
  background: var(--teal);
  color: #fff;
}

.btn-solid {
  background: var(--navy);
  color: #fff;
}

.btn-ghost {
  background: transparent;
  color: var(--navy);
  border: 1px solid var(--border);
}

.btn:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.item-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.item-sub {
  font-size: 12px;
  color: var(--ink);
  opacity: .6;
  margin: 0;
}

.empty {
  font-size: 14px;
  text-align: center;
  padding: 24px;
  color: var(--ink);
  opacity: .5;
}

.loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--navy);
  background: var(--cream);
}

.months {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.months::-webkit-scrollbar {
  display: none;
}

.carousel {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.carousel::-webkit-scrollbar { display: none; }

.carousel-card {
  scroll-snap-align: start;
  flex: 0 0 82%;
  max-width: 300px;
  text-align: left;
  border: none;
  cursor: pointer;
  color: #fff;
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,.22);
}

.cc-name { font-weight: 700; font-size: 15px; }

.cc-invoice {
  display: flex;
  flex-direction: column;
}
.cc-invoice span { font-size: 12px; opacity: .85; }
.cc-invoice strong { font-size: 22px; }

.cc-dates { font-size: 12px; opacity: .85; }

.cc-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.3);
  overflow: hidden;
}
.cc-bar-fill { height: 100%; background: #fff; }
.cc-limit-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  opacity: .9;
  margin-top: 4px;
}

.fatura-sheet { max-height: 82vh; display: flex; flex-direction: column; }

.fatura-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0 12px;
}
.fatura-nav-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 13px;
}
.fatura-nav-label strong { font-size: 20px; }

.fatura-list { overflow-y: auto; }

.rule-inline-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--cream);
  color: inherit;
}

.section-h {
  font-size: 16px;
  margin: 6px 2px -4px;
  opacity: .9;
}

.link-card {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--panel);
  color: inherit;
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.link-card .lc-label {
  font-size: 12px;
  opacity: .7;
}

.link-card .lc-value {
  font-size: 20px;
}

.link-card .lc-hint {
  font-size: 11px;
  color: var(--teal);
  font-weight: 600;
}

.detail-sheet {
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}

.detail-sheet-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.panorama-toggle {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 14px;
  background: var(--panel);
  border: 1px solid var(--border);
}

.panorama-toggle button {
  flex: 1;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 9px;
  border-radius: 10px;
  cursor: pointer;
  opacity: .6;
}

.panorama-toggle .pt-active {
  background: var(--teal);
  color: #fff;
  opacity: 1;
}

.import-detected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--cream);
  border: 1px dashed var(--teal);
}

.future-item {
  padding: 6px 0;
  border-bottom: 1px dashed var(--border);
}

.future-item:last-child {
  border-bottom: none;
}

.app-version {
  text-align: center;
  font-size: 11px;
  opacity: 0.4;
  margin: 24px 0 8px;
}

.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, .5);
  backdrop-filter: blur(3px);
  animation: update-fade .25s ease;
}

.update-modal {
  position: relative;
  width: 100%;
  max-width: 340px;
  border-radius: 22px;
  padding: 28px 22px 20px;
  text-align: center;
  background: var(--panel, #fff);
  color: var(--ink);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
  animation: update-pop .35s cubic-bezier(.18, .89, .32, 1.28);
}

.update-icon {
  width: 66px;
  height: 66px;
  margin: 0 auto 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, var(--teal, #2E8B7C), var(--gold, #D3A44B));
  box-shadow: 0 8px 20px rgba(46, 139, 124, .4);
  animation: update-bounce 1.6s ease-in-out infinite;
}

.update-title {
  margin: 0 0 8px;
  font-size: 19px;
}

.update-msg {
  margin: 0 0 20px;
  font-size: 14px;
  opacity: .8;
  line-height: 1.45;
}

.update-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.update-btn-primary {
  border: none;
  border-radius: 14px;
  padding: 13px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, var(--teal, #2E8B7C), var(--gold, #D3A44B));
  box-shadow: 0 6px 16px rgba(46, 139, 124, .35);
  transition: transform .1s ease;
}

.update-btn-primary:active { transform: scale(.97); }

.update-btn-ghost {
  border: none;
  background: transparent;
  color: inherit;
  opacity: .6;
  font-size: 14px;
  font-weight: 600;
  padding: 6px;
  cursor: pointer;
}

.update-hint {
  margin: 14px 0 0;
  font-size: 11.5px;
  opacity: .5;
  line-height: 1.4;
}

@keyframes update-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes update-pop {
  from { opacity: 0; transform: translateY(16px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes update-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

.viewing-month {
  margin: 0;
  font-size: 13px;
  opacity: 0.7;
}

.viewing-month strong {
  opacity: 1;
  color: var(--teal);
}

.month-chip {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  border: 1px solid var(--border);
  cursor: pointer;
  background: var(--panel);
  color: var(--ink);
  scroll-snap-align: start;
}

.month-chip-active {
  background: var(--navy);
  color: #fff;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.bar {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.bar-fill {
  height: 10px;
  border-radius: 999px;
  background: var(--teal);
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--teal);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.delete-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid rgba(193, 84, 60, .25);
  background: rgba(193, 84, 60, .08);
  color: var(--bad);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform .16s ease, background .16s ease, border-color .16s ease;
  flex-shrink: 0;
}

.delete-btn:hover {
  transform: translateY(-1px);
  background: rgba(193, 84, 60, .14);
  border-color: rgba(193, 84, 60, .45);
}

.delete-btn:active {
  transform: scale(.96);
}

.edit-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid rgba(46, 139, 124, .25);
  background: rgba(46, 139, 124, .08);
  color: var(--teal, #2E8B7C);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.edit-btn:hover {
  transform: translateY(-1px);
  background: rgba(46, 139, 124, .14);
  border-color: rgba(46, 139, 124, .45);
}

.edit-btn:active {
  transform: scale(.96);
}

.color-picker-wrap {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: var(--cream);
  border-radius: 12px;
  padding: 6px;
}

.color-preview {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.22);
}

.color-inp {
  width: 100%;
  height: 34px;
  border: 0;
  border-radius: 10px;
  padding: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.color-inp::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-inp::-webkit-color-swatch {
  border: 0;
  border-radius: 10px;
}

.color-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  opacity: .65;
  padding-right: 6px;
  text-transform: uppercase;
}

.card-color-badge {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
  flex-shrink: 0;
}

.card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}


.card-stats div {
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  min-width: 0;
}

.card-stats span {
  display: block;
  font-size: 11px;
  color: var(--ink);
  opacity: .55;
  margin-bottom: 4px;
}

.card-stats strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.good-text {
  color: var(--good) !important;
}

.bad-text {
  color: var(--bad) !important;
}

.status-pill {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.status-active {
  background: rgba(46, 139, 124, .12);
  color: var(--good);
}

.status-inactive {
  background: rgba(193, 84, 60, .12);
  color: var(--bad);
}

.migration-banner {
  background: var(--gold);
  color: #1C2431;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 700;
  border-bottom: 1px solid rgba(0,0,0,.08);
}

.migration-text {
  line-height: 1.15;
}

.migration-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.migration-btn {
  min-height: 40px;
  line-height: 1;
}

.migration-close {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(28,36,49,.22);
  background: rgba(255,255,255,.28);
  color: #1C2431;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.profile-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  background: var(--cream);
  border-radius: 14px;
  margin-bottom: 14px;
}

.profile-avatar {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: var(--panel);
  color: var(--teal);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-title {
  font-weight: 800;
  font-size: 15px;
  color: var(--ink);
}

.profile-subtitle {
  font-size: 12px;
  color: var(--ink);
  opacity: .58;
  margin-top: 2px;
}

.photo-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.photo-upload-btn {
  min-height: 38px;
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--teal);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}

.photo-remove-btn {
  min-height: 38px;
  border-radius: 10px;
  padding: 8px 12px;
  background: transparent;
  color: var(--bad);
  border: 1px solid rgba(193, 84, 60, .3);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.avatar-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

.avatar-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.avatar-option {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--cream);
  padding: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-option img {
  width: 36px;
  height: 36px;
  border-radius: 13px;
}

.avatar-option-active {
  border: 2px solid var(--teal);
  box-shadow: 0 0 0 3px rgba(46, 139, 124, .15);
}

/* Scroll geral mais bonito */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, .45) transparent;
}

*::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, .38);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

*::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, .62);
  background-clip: content-box;
}

*::-webkit-scrollbar-corner {
  background: transparent;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 88px;
  transform: translateX(-50%);
  z-index: 999;
  width: calc(100% - 32px);
  max-width: 420px;
  border-radius: 16px;
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  box-shadow: 0 18px 40px rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.16);
  animation: toastIn .22s ease-out;
}

.toast div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toast strong {
  font-size: 13px;
  font-weight: 800;
}

.toast span {
  font-size: 12px;
  font-weight: 600;
  opacity: .9;
}

.toast button {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: none;
  background: rgba(255,255,255,.18);
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.toast-success {
  background: var(--teal);
  color: #fff;
}

.toast-error {
  background: var(--bad);
  color: #fff;
}

.toast-warning {
  background: var(--gold);
  color: #1C2431;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translate(-50%, 12px);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@media (max-width: 520px) {
  .grid2 {
    grid-template-columns: 1fr;
  }

  .stat-value {
    font-size: 21px;
  }

  .card-stats {
    grid-template-columns: 1fr;
  }

  .tab {
    font-size: 9.5px;
    padding: 9px 0;
    gap: 4px;
  }

  .tab svg {
    width: 20px;
    height: 20px;
  }
}
  .installment-preview {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(211, 164, 75, .12);
  border: 1px solid rgba(211, 164, 75, .28);
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}

.installment-preview strong {
  color: var(--gold);
}

.invoice-pay {
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}

/* Tour guiado / tutorial interativo de primeiro acesso */
.tour-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
}

.tour-dim {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.6);
  animation: onb-in 0.25s ease;
  pointer-events: auto;
}

.tour-spot {
  position: fixed;
  border-radius: 14px;
  box-shadow: 0 0 0 9999px rgba(17, 24, 39, 0.62);
  outline: 2px solid var(--teal);
  outline-offset: 2px;
  transition: top 0.28s ease, left 0.28s ease, width 0.28s ease,
    height 0.28s ease;
  pointer-events: none;
}

.tour-tip {
  position: fixed;
  z-index: 1001;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px 18px 16px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.3);
  animation: onb-rise 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
  box-sizing: border-box;
}

.tour-icon {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(46, 139, 124, 0.14);
  color: var(--teal);
  margin-bottom: 12px;
}

.tour-step-count {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 6px;
}

.tour-title {
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 7px;
  color: var(--ink);
}

.tour-text {
  font-size: 13.5px;
  line-height: 1.5;
  margin: 0;
  color: var(--ink);
  opacity: 0.82;
}

.tour-dots {
  display: flex;
  gap: 6px;
  margin: 16px 0 14px;
}

.tour-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.onb-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: all 0.2s ease;
}

.onb-dot-active {
  width: 22px;
  border-radius: 999px;
  background: var(--teal);
}

.onb-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.onb-back {
  border: none;
  background: transparent;
  color: var(--ink);
  opacity: 0.6;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 4px;
}

.onb-back:hover {
  opacity: 1;
}

@keyframes onb-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes onb-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`;