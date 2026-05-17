export default function RulesPage() {
  return (
    <main style={{
      minHeight: "100vh", background: "#0A0A0C",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 520,
        background: "#111116", border: "1px solid #1E1E26",
        borderRadius: 6, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ padding: "36px 40px 28px", borderBottom: "1px solid #1E1E26", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <path d="M6 24C6 24 14 12 24 12C34 12 42 24 42 24C42 24 34 36 24 36C14 36 6 24 6 24Z"
                stroke="#7C6FF7" strokeWidth="1" fill="none" opacity="0.5" />
              <circle cx="24" cy="24" r="6" stroke="#7C6FF7" strokeWidth="1" fill="none" opacity="0.8" />
              <circle cx="24" cy="24" r="2.5" fill="#7C6FF7" opacity="0.9" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 20, fontWeight: 600, letterSpacing: "0.3em",
            textTransform: "uppercase", color: "#E8E6E1",
            margin: "0 0 10px", fontFamily: "Georgia, serif",
          }}>Charte de la communauté</h1>
          <p style={{ fontSize: 11, color: "#5A5A6A", letterSpacing: "0.06em", fontStyle: "italic", margin: 0, fontFamily: "Georgia, serif" }}>
            La parole appartient à ceux qui savent écouter.
          </p>
        </div>

        <div style={{ padding: "32px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { n: "I", title: "Respect", body: "Toute forme de harcèlement ou de discours haineux est proscrite. Chaque membre mérite d'être traité avec dignité." },
              { n: "II", title: "Confidentialité", body: "Ce qui est dit ici reste ici. Ne partagez pas les échanges de la communauté sans l'accord explicite des personnes concernées." },
              { n: "III", title: "Authenticité", body: "Un seul compte par personne. Soyez vous-même — l'oracle reconnaît ceux qui se présentent sans masque." },
              { n: "IV", title: "Qualité", body: "Privilégiez la profondeur à la quantité. Chaque parole compte ; faites en sorte qu'elle mérite d'être entendue." },
            ].map(({ n, title, body }) => (
              <div key={n} style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 11, color: "#7C6FF7", fontFamily: "Georgia, serif", opacity: 0.6, minWidth: 20, paddingTop: 1 }}>{n}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#E8E6E1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{title}</div>
                  <p style={{ margin: 0, fontSize: 13, color: "#5A5A6A", lineHeight: 1.7 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 40px", borderTop: "1px solid #1E1E26", textAlign: "center" }}>
          <a href="/register" style={{ fontSize: 11, color: "#5A5A6A", textDecoration: "none", letterSpacing: "0.04em" }}>
            ← Retour à l'inscription
          </a>
        </div>
      </div>
    </main>
  );
}
