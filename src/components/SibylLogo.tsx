type Props = {
  /** full = œil + SIBYL + tagline  |  compact = œil + SIBYL sans tagline */
  variant?: "full" | "compact";
};

export function SibylLogo({ variant = "full" }: Props) {
  const eyeSize  = variant === "compact" ? 22 : 32;
  const viewBox  = "0 0 48 48";

  return (
    <div style={{ textAlign: "center" }}>

      {/* Œil */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: variant === "compact" ? 10 : 16 }}>
        <svg width={eyeSize} height={eyeSize} viewBox={viewBox} fill="none">
          {/* Contour externe */}
          <path
            d="M4 24C4 24 13 10 24 10C35 10 44 24 44 24C44 24 35 38 24 38C13 38 4 24 4 24Z"
            stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.35"
          />
          {/* Intérieur de l'œil — légère teinte */}
          <path
            d="M4 24C4 24 13 10 24 10C35 10 44 24 44 24C44 24 35 38 24 38C13 38 4 24 4 24Z"
            fill="rgba(138,127,248,0.04)"
          />
          {/* Iris */}
          <circle cx="24" cy="24" r="7.5" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.6" />
          {/* Pupille */}
          <circle cx="24" cy="24" r="3" fill="var(--accent)" opacity="0.9" />
          {/* Reflet */}
          <circle cx="26.5" cy="21.5" r="1.1" fill="rgba(255,255,255,0.35)" />
        </svg>
      </div>

      {/* Nom */}
      <p style={{
        margin: "0 0 " + (variant === "compact" ? "0" : "10px"),
        fontSize:       variant === "compact" ? 13 : 22,
        fontWeight:     600,
        letterSpacing:  variant === "compact" ? "0.42em" : "0.4em",
        textTransform:  "uppercase",
        color:          "var(--foreground)",
        fontFamily:     "Georgia, serif",
      }}>
        Sibyl
      </p>

      {/* Tagline — uniquement en mode full */}
      {variant === "full" && (
        <p style={{
          margin: 0,
          fontSize:    11,
          color:       "var(--muted)",
          letterSpacing: "0.05em",
          fontStyle:   "italic",
          fontFamily:  "Georgia, serif",
          lineHeight:  1.6,
        }}>
          La parole appartient à ceux qui savent écouter.
        </p>
      )}

      {/* Séparateur décoratif en mode compact */}
      {variant === "compact" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, marginTop: 14,
        }}>
          <div style={{ width: 20, height: 1, background: "var(--border)" }} />
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", opacity: 0.4 }} />
          <div style={{ width: 20, height: 1, background: "var(--border)" }} />
        </div>
      )}
    </div>
  );
}
