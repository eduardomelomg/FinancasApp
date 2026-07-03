import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Login from "./Login.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import "./index.css";

function Gate() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#151E2E",
        }}
      >
        <svg width="76" height="76" viewBox="0 0 512 512" style={{ borderRadius: 22 }}>
          <rect width="512" height="512" rx="112" fill="#22304A" />
          <rect x="120" y="286" width="64" height="90" rx="18" fill="#2E8B7C" />
          <rect x="224" y="226" width="64" height="150" rx="18" fill="#2E8B7C" />
          <rect x="328" y="166" width="64" height="210" rx="18" fill="#2E8B7C" />
          <circle cx="360" cy="150" r="70" fill="#D3A44B" />
          <text x="360" y="150" fontFamily="Arial, sans-serif" fontSize="66" fontWeight="700" fill="#22304A" textAnchor="middle" dominantBaseline="central">R$</text>
        </svg>
      </div>
    );
  return user ? <App /> : <Login />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </React.StrictMode>
);
