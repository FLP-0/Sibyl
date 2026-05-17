"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { SibylLogo } from "@/components/SibylLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const handleSend = async () => {
    if (!email.includes("@")) { setError("Adresse e-mail invalide."); return; }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError("Une erreur est survenue. Réessaie.");
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <main style={{
        minHeight: "100vh", background: "var(--background)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{
            fontSize: 14, color: "var(--foreground)",
            fontFamily: "Georgia, serif", fontStyle: "italic", marginBottom: 12,
          }}>
            Un lien t'a été envoyé.
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            Vérifie ta boîte mail et clique sur le lien pour choisir un nouveau mot de passe.
          </p>
          <a href="/" style={{
            display: "inline-block", marginTop: 24,
            fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none",
          }}>
            Retour à la connexion
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh", background: "var(--background)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 6, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          padding: "28px 40px 24px",
          borderBottom: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <SibylLogo variant="compact" />
          <h2 style={{
            fontSize: 14, fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--foreground)",
            fontFamily: "Georgia, serif", margin: "18px 0 8px",
          }}>
            Mot de passe oublié
          </h2>
          <p style={{
            fontSize: 11, color: "var(--muted)", fontStyle: "italic",
            fontFamily: "Georgia, serif", margin: 0,
          }}>
            Entre ton adresse e-mail pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <div style={{ padding: "28px 40px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
                Adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="vous@exemple.com"
                style={{
                  width: "100%", padding: "13px 14px",
                  background: focused ? "rgba(124,111,247,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4, color: "var(--foreground)", fontSize: 13,
                  outline: "none", transition: "all 0.25s ease", boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 11, color: "#c94c4c", margin: 0 }}>{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={loading || !email}
              style={{
                width: "100%", padding: "13px 0",
                background: loading || !email ? "var(--border)" : "var(--accent)",
                border: "none", borderRadius: 4,
                color: loading || !email ? "var(--muted)" : "#fff",
                fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: loading || !email ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Envoi…" : "Envoyer le lien"}
            </button>

            <a href="/" style={{
              textAlign: "center", fontSize: 10, color: "var(--muted)",
              letterSpacing: "0.06em", textDecoration: "none",
            }}>
              Retour à la connexion
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
