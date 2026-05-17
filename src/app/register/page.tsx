"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SibylLogo } from "@/components/SibylLogo";

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";
const STEPS = ["Identité", "Sécurité", "Sésame"] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      setCode(invite.toUpperCase());
      setStep(3);
    }
    return () => clearTimeout(t);
  }, []);

  const isOwner = email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase();

  const canProceed = () => {
    if (step === 1) return pseudo.length >= 2 && email.includes("@");
    if (step === 2) return password.length >= 6 && password === confirm;
    if (step === 3) return code.length >= 4 && accepted;
    return false;
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    let spaceId: string;
    let inviteId: string | null = null;

    if (isOwner) {
      // Owner : bypass le sésame, récupère le spaceId côté serveur
      const res = await fetch(`/api/owner-setup?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        setError("Erreur d'autorisation owner.");
        setLoading(false);
        return;
      }
      ({ spaceId } = await res.json());
    } else {
      // Membre normal : vérifie le code
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        setError("Code incorrect. Vérifie le sésame et réessaie.");
        setLoading(false);
        return;
      }
      ({ spaceId, inviteId } = await res.json());
    }

    // Créer le compte
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { pseudo, space_id: spaceId } },
    });

    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("email")) {
        setError("Cette adresse e-mail est déjà utilisée.");
        setErrorStep(1); setStep(1);
      } else if (msg.includes("pseudo") || msg.includes("unique") || msg.includes("duplicate") || msg.includes("database")) {
        setError("Ce pseudo est déjà pris. Choisis-en un autre.");
        setErrorStep(1); setStep(1);
      } else {
        setError("Une erreur est survenue. Réessaie.");
        setErrorStep(isOwner ? 2 : 3);
      }
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;

    if (isOwner && uid) {
      // Passe le rôle à admin
      await fetch("/api/owner-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      router.push("/superadmin");
      return;
    }

    if (inviteId && uid) {
      await fetch("/api/invitations/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, userId: uid }),
      });
    }

    router.push("/feed");
  };

  const passwordStrength = () => {
    if (!password.length) return 0;
    if (password.length < 6) return 1;
    if (password.length < 10) return 2;
    if (/[^a-zA-Z0-9]/.test(password)) return 4;
    return 3;
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      {/* Halo d'ambiance */}
      <div style={{
        position: "fixed",
        top: "10%",
        left: "50%",
        transform: "translateX(-50%)",
        width: 600,
        height: 600,
        background: "radial-gradient(circle, rgba(124,111,247,0.06) 0%, transparent 65%)",
        borderRadius: "50%",
        pointerEvents: "none",
      }} />

      {/* Carte */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          background: "var(--surface)",
        }}
      >
        {/* En-tête */}
        <div style={{
          padding: "36px 40px 28px",
          borderBottom: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <SibylLogo variant="full" />
        </div>

        {/* Indicateur d'étapes */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
        }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <button
                key={n}
                onClick={() => { if (done) setStep(n); }}
                style={{
                  flex: 1,
                  padding: "14px 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  cursor: done ? "pointer" : "default",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.3s ease",
                  outline: "none",
                }}
              >
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `1px solid ${active ? "var(--accent)" : done ? "rgba(124,111,247,0.4)" : "var(--border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: active ? "var(--accent)" : done ? "rgba(124,111,247,0.6)" : "var(--muted)",
                  background: done ? "rgba(124,111,247,0.08)" : "transparent",
                  transition: "all 0.3s ease",
                }}>
                  {done ? "✓" : n}
                </span>
                <span style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: active ? "var(--accent)" : done ? "rgba(124,111,247,0.5)" : "var(--muted)",
                  fontFamily: "inherit",
                  transition: "all 0.3s ease",
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Corps */}
        <div key={step} style={{ padding: "32px 40px 24px" }}>
          <p style={{
            fontSize: 12,
            color: "var(--muted)",
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            marginBottom: 28,
            letterSpacing: "0.02em",
          }}>
            {step === 1 && "Choisis comment la communauté te connaîtra."}
            {step === 2 && "Protège ton accès à l'oracle."}
            {step === 3 && "Entre le sésame pour franchir le seuil."}
          </p>

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {error && errorStep === 1 && (
                <p style={{ fontSize: 11, color: "#c94c4c", letterSpacing: "0.02em", margin: 0 }}>
                  {error}
                </p>
              )}
              <Field label="Pseudo">
                <Input
                  name="pseudo" value={pseudo} type="text"
                  placeholder="Ton nom dans la communauté"
                  focused={focused} setFocused={setFocused}
                  onChange={(e) => { setPseudo(e.target.value); setError(null); }}
                />
              </Field>
              <Field label="Adresse e-mail">
                <Input
                  name="email" value={email} type="email"
                  placeholder="oracle@sibyl.fr"
                  focused={focused} setFocused={setFocused}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                />
              </Field>
              <Divider />
              <button
                style={{
                  width: "100%",
                  padding: "13px 0",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--muted)",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  letterSpacing: "0.06em",
                  transition: "border-color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(124,111,247,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <GoogleIcon />
                S'inscrire avec Google
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Field label="Mot de passe">
                <Input
                  name="pass" value={password} type="password"
                  placeholder="••••••••"
                  focused={focused} setFocused={setFocused}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {password.length > 0 && password.length < 6 && (
                  <Error>6 caractères minimum</Error>
                )}
              </Field>
              <Field label="Confirmer">
                <Input
                  name="confirm" value={confirm} type="password"
                  placeholder="••••••••"
                  focused={focused} setFocused={setFocused}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {confirm.length > 0 && confirm !== password && (
                  <Error>Les mots de passe ne correspondent pas</Error>
                )}
              </Field>
              <div>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                  Force
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4].map((lvl) => {
                    const s = passwordStrength();
                    const color = s <= 1 ? "#c94c4c" : s <= 2 ? "#c9884c" : "var(--accent)";
                    return (
                      <div key={lvl} style={{
                        flex: 1, height: 2, borderRadius: 1,
                        background: lvl <= s ? color : "var(--border)",
                        transition: "all 0.3s ease",
                      }} />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {error && (
                <p style={{ fontSize: 11, color: "#c94c4c", marginBottom: 4, letterSpacing: "0.02em" }}>
                  {error}
                </p>
              )}
              <Field label="Sésame">
                <Input
                  name="code" value={code} type="text"
                  placeholder="000000"
                  focused={focused} setFocused={setFocused}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  extra={{ fontFamily: "monospace", letterSpacing: "0.15em", textAlign: "center" as const, fontSize: 15 }}
                />
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, letterSpacing: "0.02em" }}>
                  Le sésame circule entre initiés.
                </p>
              </Field>
              <div
                onClick={() => setAccepted(!accepted)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  cursor: "pointer", padding: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${accepted ? "var(--accent)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 4,
                }}
              >
                <div style={{
                  width: 18, height: 18, minWidth: 18, marginTop: 1,
                  border: `1px solid ${accepted ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: accepted ? "rgba(124,111,247,0.12)" : "transparent",
                  transition: "all 0.25s ease",
                }}>
                  {accepted && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="var(--accent)" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, letterSpacing: "0.01em" }}>
                  J'accepte les <a href="/rules" target="_blank" style={{ color: "var(--accent)", textDecoration: "none" }}>règles de la communauté</a> et m'engage à respecter la confidentialité de Sibyl.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "8px 40px 32px", display: "flex", gap: 10 }}>
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                padding: "13px 20px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--muted)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "border-color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(124,111,247,0.3)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              Retour
            </button>
          )}
          <button
            onClick={() => {
              if (!canProceed()) return;
              if (step === 1) { setStep(2); return; }
              if (step === 2) { if (isOwner) handleSubmit(); else setStep(3); return; }
              if (step === 3) handleSubmit();
            }}
            disabled={!canProceed() || loading}
            style={{
              flex: 1,
              padding: "13px 0",
              background: canProceed() ? "rgba(124,111,247,0.12)" : "transparent",
              border: `1px solid ${canProceed() ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 4,
              color: canProceed() ? "var(--accent)" : "var(--muted)",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: canProceed() ? "pointer" : "not-allowed",
              transition: "all 0.3s ease",
            }}
          >
            {loading ? "En cours…" : (step === 3 || (step === 2 && isOwner)) ? "Accéder à Sibyl" : "Continuer"}
          </button>
        </div>

        {/* Pied */}
        <div style={{
          padding: "16px 40px",
          borderTop: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>
            Déjà initié ?{" "}
            <a href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
              Se connecter
            </a>
          </span>
        </div>
      </div>
    </main>
  );
}

/* ─── Sous-composants ─── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "var(--muted)",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Input({ name, value, type, placeholder, focused, setFocused, onChange, extra = {} }: {
  name: string;
  value: string;
  type: string;
  placeholder: string;
  focused: string | null;
  setFocused: (v: string | null) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extra?: React.CSSProperties;
}) {
  const isFocused = focused === name;
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(name)}
      onBlur={() => setFocused(null)}
      style={{
        width: "100%",
        padding: "13px 14px",
        background: isFocused ? "rgba(124,111,247,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isFocused ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 4,
        color: "var(--foreground)",
        fontSize: 13,
        letterSpacing: "0.02em",
        outline: "none",
        transition: "all 0.25s ease",
        boxSizing: "border-box",
        ...extra,
      }}
    />
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, color: "#c94c4c", marginTop: 4, display: "block", letterSpacing: "0.02em" }}>
      {children}
    </span>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>ou</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
