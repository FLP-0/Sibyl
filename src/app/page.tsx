"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SibylLogo } from "@/components/SibylLogo";

const STEPS = [
  { key: 1, label: "Identité" },
  { key: 2, label: "Espace" },
] as const;

export default function LoginPage() {
  const router  = useRouter();
  const [step, setStep]             = useState<1 | 2>(1);
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [code, setCode]             = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [focused, setFocused]       = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  /* ── Étape 1 : authentification ── */
  const handleLogin = async () => {
    if (!email || !password || loading) return;
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
      return;
    }

    setSessionUserId(data.user.id);
    setLoading(false);
    setStep(2);
  };

  /* ── Étape 2 : choix de l'espace ── */
  const handleSpace = async () => {
    if (!code.trim() || loading) return;
    setError(null);
    setLoading(true);

    const { data: spaces } = await supabase.rpc("get_space_by_code", {
      input_code: code.trim(),
    });

    if (!spaces || (spaces as { id: string }[]).length === 0) {
      setError("Sésame invalide.");
      setLoading(false);
      return;
    }

    const space = (spaces as { id: string; name: string }[])[0];

    const { data: member } = await supabase
      .from("space_members")
      .select("role")
      .eq("user_id", sessionUserId)
      .eq("space_id", space.id)
      .maybeSingle();

    if (!member) {
      setError("Tu n'es pas membre de cet espace.");
      setLoading(false);
      return;
    }

    router.push(`/feed?space=${space.id}`);
  };

  const canProceed = step === 1 ? (!!email && !!password) : !!code.trim();

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

        {/* Indicateur d'étapes */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {STEPS.map(({ key, label }) => {
            const active = step === key;
            const done   = step > key;
            return (
              <div key={key} style={{
                flex: 1,
                padding: "12px 0",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: `1px solid ${active ? "var(--accent)" : done ? "rgba(138,127,248,0.4)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9,
                  color: active ? "var(--accent)" : done ? "rgba(138,127,248,0.6)" : "var(--muted)",
                  background: done ? "rgba(138,127,248,0.08)" : "transparent",
                }}>
                  {done ? "✓" : key}
                </span>
                <span style={{
                  fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: active ? "var(--accent)" : done ? "rgba(138,127,248,0.5)" : "var(--muted)",
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Corps */}
        <div key={step} style={{ padding: "32px 40px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          <p style={{
            margin: "0 0 4px",
            fontSize: 11, color: "var(--muted)", fontStyle: "italic",
            fontFamily: "Georgia, serif", letterSpacing: "0.02em",
          }}>
            {step === 1 && "Identifie-toi pour franchir le seuil."}
            {step === 2 && "Entre le sésame de ton espace."}
          </p>

          {/* ── Étape 1 ── */}
          {step === 1 && (<>
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
                style={inputStyle(focused === "email")}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
                  Mot de passe
                </label>
                <a
                  href="/forgot-password"
                  style={{
                    fontSize: 9, color: "var(--accent)", textDecoration: "none",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    border: "1px solid rgba(138,127,248,0.25)", borderRadius: 3,
                    padding: "3px 8px", transition: "all 0.2s ease", opacity: 0.7,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.borderColor = "rgba(138,127,248,0.6)";
                    e.currentTarget.style.background = "rgba(138,127,248,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.7";
                    e.currentTarget.style.borderColor = "rgba(138,127,248,0.25)";
                    e.currentTarget.style.background = "transparent";
                  }}
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
                style={inputStyle(focused === "password")}
              />
            </div>
          </>)}

          {/* ── Étape 2 ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
                Sésame
              </label>
              <input
                type="text"
                autoComplete="off"
                placeholder="000000"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleSpace()}
                onFocus={() => setFocused("code")}
                onBlur={() => setFocused(null)}
                style={{
                  ...inputStyle(focused === "code"),
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  textAlign: "center",
                  fontSize: 16,
                }}
              />
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0", letterSpacing: "0.02em" }}>
                Le sésame circule entre initiés.
              </p>
            </div>
          )}

          {error && (
            <p style={{ fontSize: 11, color: "#c94c4c", margin: 0, letterSpacing: "0.02em" }}>
              {error}
            </p>
          )}

          {/* Bouton */}
          <button
            type="button"
            onClick={step === 1 ? handleLogin : handleSpace}
            disabled={loading || !canProceed}
            style={{
              width: "100%",
              padding: "13px 0",
              marginTop: 4,
              background: (!loading && canProceed) ? "rgba(138,127,248,0.12)" : "transparent",
              border: `1px solid ${(!loading && canProceed) ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 4,
              color: (!loading && canProceed) ? "var(--accent)" : "var(--muted)",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: (!loading && canProceed) ? "pointer" : "not-allowed",
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => { if (!loading && canProceed) e.currentTarget.style.background = "rgba(138,127,248,0.18)"; }}
            onMouseLeave={(e) => { if (!loading && canProceed) e.currentTarget.style.background = "rgba(138,127,248,0.12)"; }}
          >
            {loading ? "En cours…" : step === 1 ? "Continuer" : "Entrer"}
          </button>
        </div>

        {/* Pied */}
        {step === 1 && (
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
        )}
      </div>
    </main>
  );
}

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 14px",
    background: focused ? "rgba(138,127,248,0.05)" : "rgba(255,255,255,0.02)",
    border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 4,
    color: "var(--foreground)",
    fontSize: 13,
    outline: "none",
    transition: "all 0.25s ease",
    boxSizing: "border-box",
  };
}
