"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffMessage = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  pseudo: string;
  role: string;
};

type SpaceStats = {
  name: string;
  description: string | null;
  code: string;
  members: number;
  posts: number;
  messages: number;
  bans: number;
  candidatures: number;
};

const roleLabel: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",      color: "#c9884c" },
  moderator: { label: "Modérateur", color: "var(--accent)" },
  member:    { label: "Membre",     color: "var(--muted)" },
};

export default function StaffTab({
  userId, pseudo, role, spaceId,
}: {
  userId: string;
  pseudo: string;
  role: string;
  spaceId: string;
}) {
  const [stats, setStats] = useState<SpaceStats | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const profileCache = useRef<Record<string, { pseudo: string; role: string }>>({});

  useEffect(() => {
    fetchStats();
    loadMessages();

    if (channelRef.current) return;
    channelRef.current = supabase
      .channel("staff-" + spaceId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "staff_messages",
        filter: `space_id=eq.${spaceId}`,
      }, async (payload) => {
        const row = payload.new as { id: string; content: string; created_at: string; author_id: string };
        let info = profileCache.current[row.author_id];
        if (!info) {
          const [{ data: p }, { data: m }] = await Promise.all([
            supabase.from("profiles").select("pseudo").eq("id", row.author_id).single(),
            supabase.from("space_members").select("role").eq("user_id", row.author_id).eq("space_id", spaceId).single(),
          ]);
          info = { pseudo: p?.pseudo ?? "Staff", role: m?.role ?? "moderator" };
          profileCache.current[row.author_id] = info;
        }
        setMessages((prev) => [...prev, { ...row, pseudo: info.pseudo, role: info.role }]);
      })
      .subscribe();

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchStats = async () => {
    setLoadingStats(true);
    const [
      { data: spaceData },
      { count: membersCount },
      { count: postsCount },
      { count: messagesCount },
      { count: bansCount },
      { count: candidaturesCount },
    ] = await Promise.all([
      supabase.from("spaces").select("name, description, code").eq("id", spaceId).single(),
      supabase.from("space_members").select("*", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("bans").select("*", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("mod_applications").select("*", { count: "exact", head: true }).eq("space_id", spaceId).eq("from_owner", false),
    ]);
    if (spaceData) {
      setStats({
        name: spaceData.name,
        description: spaceData.description,
        code: spaceData.code,
        members: membersCount ?? 0,
        posts: postsCount ?? 0,
        messages: messagesCount ?? 0,
        bans: bansCount ?? 0,
        candidatures: candidaturesCount ?? 0,
      });
    }
    setLoadingStats(false);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("staff_messages")
      .select("id, content, created_at, author_id")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!data || data.length === 0) return;

    const authorIds = [...new Set(data.map((m) => m.author_id))];
    const [{ data: profiles }, { data: members }] = await Promise.all([
      supabase.from("profiles").select("id, pseudo").in("id", authorIds),
      supabase.from("space_members").select("user_id, role").eq("space_id", spaceId).in("user_id", authorIds),
    ]);

    const pseudoMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    const roleMap: Record<string, string> = {};
    (members ?? []).forEach((m) => { roleMap[m.user_id] = m.role; });

    authorIds.forEach((id) => {
      profileCache.current[id] = { pseudo: pseudoMap[id] ?? "Staff", role: roleMap[id] ?? "moderator" };
    });

    setMessages(data.map((m) => ({
      ...m,
      pseudo: pseudoMap[m.author_id] ?? "Staff",
      role: roleMap[m.author_id] ?? "moderator",
    })));
  };

  const handleSend = async () => {
    if (!input.trim() || userId === "dev-user" || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    await supabase.from("staff_messages").insert({
      space_id: spaceId,
      author_id: userId,
      content: text,
    });
    setSending(false);
  };

  const timeAgo = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
    return `il y a ${Math.floor(diff / 86400)} j`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* En-tête espace */}
      <div style={{ padding: "16px 24px 0", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>
            ⬡ Canal Staff
          </span>
          {stats && (
            <code style={{
              fontSize: 9, color: "var(--muted)", fontFamily: "monospace",
              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
              borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em",
            }}>
              {stats.name}
            </code>
          )}
        </div>

        {/* Stats */}
        {!loadingStats && stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, marginBottom: 0 }}>
            {[
              { label: "Membres",      value: stats.members,      color: "var(--foreground)" },
              { label: "Publications", value: stats.posts,        color: "var(--foreground)" },
              { label: "Messages",     value: stats.messages,     color: "var(--foreground)" },
              { label: "Bans actifs",  value: stats.bans,         color: stats.bans > 0 ? "#c94c4c" : "var(--muted)" },
              { label: "Candidatures", value: stats.candidatures, color: stats.candidatures > 0 ? "#c9884c" : "var(--muted)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "10px 14px", borderRight: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 17, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>{value}</div>
                <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
        {loadingStats && (
          <div style={{ padding: "14px 0", borderTop: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Chargement…</p>
          </div>
        )}
      </div>

      {/* Chat staff */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 2 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: 1.7 }}>
              Canal réservé au staff — admins et modérateurs.
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.author_id === userId;
          const ri = roleLabel[msg.role] ?? roleLabel.moderator;
          return (
            <div key={msg.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isOwn ? "var(--accent)" : ri.color }}>
                  {msg.pseudo}
                </span>
                <span style={{
                  fontSize: 8, color: ri.color, border: `1px solid ${ri.color}`,
                  borderRadius: 3, padding: "1px 6px", letterSpacing: "0.1em",
                  textTransform: "uppercase", opacity: 0.8,
                }}>
                  {ri.label}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(msg.created_at)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.65 }}>
                {msg.content}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 24px 20px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", transition: "border-color 0.15s" }}
          onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(138,127,248,0.45)")}
          onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <span style={{ fontSize: 9, color: roleLabel[role]?.color ?? "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0, opacity: 0.7 }}>
            {roleLabel[role]?.label}
          </span>
          <div style={{ width: 1, height: 14, background: "var(--border)", flexShrink: 0 }} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message au staff…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--foreground)", fontSize: 13, fontFamily: "inherit" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || userId === "dev-user"}
            style={{
              background: input.trim() && !sending ? "var(--accent)" : "transparent",
              border: "none", borderRadius: 4,
              cursor: input.trim() && !sending ? "pointer" : "default",
              color: input.trim() && !sending ? "#fff" : "var(--muted)",
              padding: "4px 10px", fontSize: 16, lineHeight: 1,
              transition: "background 0.15s",
            }}
          >↑</button>
        </div>
      </div>
    </div>
  );
}
