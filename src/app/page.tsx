"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
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
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <h1
          className="text-4xl font-bold uppercase"
          style={{ color: "var(--foreground)", letterSpacing: "0.35em" }}
        >
          SIBYL
        </h1>
        <p className="mt-3 text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          La parole appartient à ceux qui savent écouter.
        </p>
      </div>

      {/* Formulaire */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 text-sm rounded outline-none transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label htmlFor="password" className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Mot de passe
            </label>
            <a href="/forgot-password" className="text-xs" style={{ color: "var(--muted)", textDecoration: "none", letterSpacing: "0.02em" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
            >
              Mot de passe oublié ?
            </a>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 text-sm rounded outline-none transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "#c94c4c", letterSpacing: "0.02em" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="w-full py-3 text-sm uppercase tracking-widest rounded font-medium transition-colors cursor-pointer mt-2"
          style={{
            background: loading ? "var(--border)" : "var(--accent)",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent)"; }}
        >
          {loading ? "Connexion…" : "Entrer"}
        </button>
      </div>

      {/* Lien accès */}
      <p className="mt-8 text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        Pas encore membre ?{" "}
        <a href="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Demander l&apos;accès
        </a>
      </p>
    </main>
  );
}
