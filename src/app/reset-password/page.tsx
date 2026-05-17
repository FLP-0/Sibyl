"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SibylLogo } from "@/components/SibylLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const passwordStrength = () => {
    if (!password.length) return 0;
    if (password.length < 6) return 1;
    if (password.length < 10) return 2;
    if (/[^a-zA-Z0-9]/.test(password)) return 4;
    return 3;
  };

  const handleReset = async () => {
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 6) { setError("6 caractères minimum."); return; }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Une erreur est survenue. Réessaie.");
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 2000);
  };

  if (done) {
    return (
      <main style={{
        minHeight: "100vh", background: "var(--background)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--accent)", letterSpacing: "0.04em" }}>
            Mot de passe mis à jour.
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            Redirection en cours…
          </p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main style={{
        minHeight: "100vh", background: "var(--background)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
          Vérification du lien…
        </p>
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
        {/* En-tête */}
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
            Nouveau mot de passe
          </h2>
          <p style={{
            fontSize: 11, color: "var(--muted)", fontStyle: "italic",
            fontFamily: "Georgia, serif", margin: 0,
          }}>
            Choisis un mot de passe sûr.
          </p>
        </div>

        {/* Formulaire */}
        <div style={{ padding: "28px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "13px 14px",
                  background: focused === "password" ? "rgba(124,111,247,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${focused === "password" ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4, color: "var(--foreground)", fontSize: 13,
                  outline: "none", transition: "all 0.25s ease", boxSizing: "border-box",
                }}
              />
              {password.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
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
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>
                Confirmer
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "13px 14px",
                  background: focused === "confirm" ? "rgba(124,111,247,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${focused === "confirm" ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4, color: "var(--foreground)", fontSize: 13,
                  outline: "none", transition: "all 0.25s ease", boxSizing: "border-box",
                }}
              />
              {confirm.length > 0 && confirm !== password && (
                <span style={{ fontSize: 10, color: "#c94c4c", marginTop: 2 }}>
                  Les mots de passe ne correspondent pas
                </span>
              )}
            </div>

            {error && (
              <p style={{ fontSize: 11, color: "#c94c4c", margin: 0, letterSpacing: "0.02em" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleReset}
              disabled={loading || !password || !confirm}
              style={{
                width: "100%", padding: "13px 0",
                background: loading || !password || !confirm ? "var(--border)" : "var(--accent)",
                border: "none", borderRadius: 4,
                color: loading || !password || !confirm ? "var(--muted)" : "#fff",
                fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: loading || !password || !confirm ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "En cours…" : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
