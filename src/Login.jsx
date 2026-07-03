// src/Login.jsx
// Tela de login/cadastro: e-mail+senha e Google.
import { useState } from "react";
import { useAuth } from "./AuthContext";

const ACCENT = "#2E8B7C";  // financas
const BG = "#F6F5F1";      // financas
const APP_NAME = "Grana · suas finanças no controle";

export default function Login() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setMsg("");
    const fn = mode === "login" ? signInEmail : signUpEmail;
    const { error } = await fn(email, password);
    if (error) setMsg(error.message);
    else if (mode === "signup") setMsg("Conta criada! Confira seu e-mail para confirmar.");
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:360,boxShadow:"0 2px 12px rgba(0,0,0,.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <svg width="40" height="40" viewBox="0 0 512 512" style={{display:"block",borderRadius:12}}>
            <rect width="512" height="512" rx="112" fill="#22304A"/>
            <rect x="120" y="286" width="64" height="90" rx="18" fill="#2E8B7C"/>
            <rect x="224" y="226" width="64" height="150" rx="18" fill="#2E8B7C"/>
            <rect x="328" y="166" width="64" height="210" rx="18" fill="#2E8B7C"/>
            <circle cx="360" cy="150" r="70" fill="#D3A44B"/>
            <text x="360" y="150" fontFamily="Arial, sans-serif" fontSize="66" fontWeight="700" fill="#22304A" textAnchor="middle" dominantBaseline="central">R$</text>
          </svg>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#1C2431",lineHeight:1}}>Grana</div>
            <div style={{fontSize:12,color:"#D3A44B"}}>seu dinheiro organizado</div>
          </div>
        </div>
        <h1 style={{fontSize:20,margin:"0 0 4px",color:"#1C2431"}}>{mode==="login"?"Entrar":"Criar conta"}</h1>
        <p style={{fontSize:13,color:"#666",margin:"0 0 20px"}}>{APP_NAME}</p>

        <button onClick={signInGoogle} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #ddd",background:"#fff",fontWeight:600,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
          Continuar com Google
        </button>

        <div style={{textAlign:"center",fontSize:12,color:"#999",margin:"0 0 16px"}}>ou</div>

        <input type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #ddd",marginBottom:10,boxSizing:"border-box"}}/>
        <input type="password" placeholder="senha" value={password} onChange={e=>setPassword(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #ddd",marginBottom:16,boxSizing:"border-box"}}/>

        <button onClick={submit} disabled={busy}
          style={{width:"100%",padding:"11px",borderRadius:8,border:"none",background:ACCENT,color:"#fff",fontWeight:700,cursor:"pointer"}}>
          {busy?"...":(mode==="login"?"Entrar":"Cadastrar")}
        </button>

        {msg && <p style={{fontSize:12,color:"#C1543C",marginTop:12}}>{msg}</p>}

        <p style={{fontSize:13,textAlign:"center",marginTop:16,color:"#666"}}>
          {mode==="login"?"Não tem conta? ":"Já tem conta? "}
          <button onClick={()=>{setMode(mode==="login"?"signup":"login");setMsg("");}}
            style={{background:"none",border:"none",color:ACCENT,fontWeight:600,cursor:"pointer"}}>
            {mode==="login"?"Cadastre-se":"Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
