"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SibylLogo } from "@/components/SibylLogo";

export default function LoginPage() {
  const router  = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return;
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";
    if (data.user?.email?.toLowerCase() === ownerEmail.toLowerCase()) {
      router.push("/superadmin");
    } else {
      router.push("/feed");
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--background)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>

      {/* Halo d'ambiance */}
      <div style={{
        position: "fixed",
        top: "8%",
        left: "50%",
        transform: "translateX(-50%)",
        width: 560,
        height: 560,
        background: "radial-gradient(circle, rgba(138,127,248,0.07) 0%, transparent 65%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }} />

      {/* Carte */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
        opacity:   mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        background: "var(--surface)",
      }}>

        {/* En-tête — Logo */}
        <div style={{
          padding: "36px 40px 28px",
          borderBottom: "1px solid var(--border)",
        }}>
          <SibylLogo variant="full" />
        </div>

        {/* Corps — Formulaire */}
        <div style={{ padding: "32px 40px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
              Adresse e-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={{
                width: "100%",
                padding: "13px 14px",
                background: focused === "email" ? "rgba(138,127,248,0.05)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${focused === "email" ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                color: "var(--foreground)",
                fontSize: 13,
                outline: "none",
                transition: "all 0.25s ease",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Mot de passe */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
                Mot de passe
              </label>
              <a
                href="/forgot-password"
                style={{ fontSize: 10, color: "var(--muted)", textDecoration: "none", letterSpacing: "0.02em", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
              >
                Oublié ?
              </a>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              style={{
                width: "100%",
                padding: "13px 14px",
                background: focused === "password" ? "rgba(138,127,248,0.05)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${focused === "password" ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                color: "var(--foreground)",
                fontSize: 13,
                outline: "none",
                transition: "all 0.25s ease",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 11, color: "#c94c4c", margin: 0, letterSpacing: "0.02em" }}>
              {error}
            </p>
          )}

          {/* Bouton */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              width: "100%",
              padding: "13px 0",
              marginTop: 4,
              background: (loading || !email || !password) ? "transparent" : "rgba(138,127,248,0.12)",
              border: `1px solid ${(loading || !email || !password) ? "var(--border)" : "var(--accent)"}`,
              borderRadius: 4,
              color: (loading || !email || !password) ? "var(--muted)" : "var(--accent)",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: (loading || !email || !password) ? "not-allowed" : "pointer",
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading && email && password) {
                e.currentTarget.style.background = "rgba(138,127,248,0.18)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && email && password) {
                e.currentTarget.style.background = "rgba(138,127,248,0.12)";
              }
            }}
          >
            {loading ? "Connexion…" : "Entrer"}
          </button>
        </div>

        {/* Pied */}
        <div style={{
          padding: "16px 40px",
          borderTop: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>
            Pas encore membre ?{" "}
            <a href="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>
              Demander l&apos;accès
            </a>
          </span>
        </div>
      </div>
    </main>
  );
}
