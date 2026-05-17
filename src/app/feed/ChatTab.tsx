"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import UserPopup from "./UserPopup";
import ProfilePanel from "./ProfilePanel";


type Message = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  pseudo: string;
  is_superadmin?: boolean;
};

function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  incoming.forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function renderWithMentions(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    /^@\w+$/.test(part)
      ? <span key={i} style={{ color: "var(--accent)", fontWeight: 600 }}>{part}</span>
      : part
  );
}

export default function ChatTab({ userId, pseudo, spaceId, isFounder }: { userId: string; pseudo: string; spaceId: string; isFounder?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [popup, setPopup] = useState<{ userId: string; anchor: HTMLElement } | null>(null);
  const [profilePanel, setProfilePanel] = useState<string | null>(null);
  const [allPseudos, setAllPseudos] = useState<string[]>([]);
  const [mentionFiltered, setMentionFiltered] = useState<string[]>([]);
  const [banInfo, setBanInfo] = useState<{ banned_until: string | null } | null>(null);
  const [censorError, setCensorError] = useState<string | null>(null);
  const censoredWordsRef = useRef<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profileCache = useRef<Record<string, string>>({});
  const superAdminCache = useRef<Record<string, boolean>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (userId && pseudo) profileCache.current[userId] = pseudo;
  }, [userId, pseudo]);

  useEffect(() => {
    supabase.from("censored_words").select("word").eq("space_id", spaceId)
      .then(({ data }) => { censoredWordsRef.current = (data ?? []).map((r) => r.word); });
  }, [spaceId]);

  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    supabase.from("bans").select("banned_until").eq("user_id", userId).eq("space_id", spaceId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (!data.banned_until || new Date(data.banned_until) > new Date()) setBanInfo(data);
      });
  }, [userId, spaceId]);

  useEffect(() => {
    loadMessages();
    supabase.from("space_members").select("profiles(pseudo)").eq("space_id", spaceId)
      .then(({ data }) => {
        const pseudos = (data ?? []).flatMap((m: { profiles: { pseudo: string } | { pseudo: string }[] | null }) => {
          if (!m.profiles) return [];
          return Array.isArray(m.profiles) ? m.profiles.map((p) => p.pseudo) : [m.profiles.pseudo];
        }).filter(Boolean) as string[];
        setAllPseudos(pseudos);
      });
  }, []);

  useEffect(() => {
    if (channelRef.current) return;
    channelRef.current = supabase
      .channel("chat-" + spaceId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as { id: string; content: string; created_at: string; author_id: string; space_id: string };
          if (row.space_id !== spaceId) return;
          let authorPseudo = profileCache.current[row.author_id];
          if (!authorPseudo) {
            const { data } = await supabase.from("profiles").select("pseudo, is_superadmin").eq("id", row.author_id).single();
            authorPseudo = data?.pseudo ?? "Membre";
            profileCache.current[row.author_id] = authorPseudo;
            superAdminCache.current[row.author_id] = data?.is_superadmin ?? false;
          }
          setMessages((prev) => mergeMessages(prev, [{ ...row, pseudo: authorPseudo, is_superadmin: superAdminCache.current[row.author_id] ?? false }]));
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") loadMessages();
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, content, created_at, author_id")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!data || data.length === 0) return;

    const authorIds = [...new Set(data.map((m) => m.author_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, pseudo, is_superadmin")
      .in("id", authorIds);

    (profilesData ?? []).forEach((p) => {
      profileCache.current[p.id] = p.pseudo;
      superAdminCache.current[p.id] = p.is_superadmin ?? false;
    });

    const loaded = data.map((m) => ({
      ...m,
      pseudo: profileCache.current[m.author_id] ?? "Membre",
      is_superadmin: superAdminCache.current[m.author_id] ?? false,
    }));
    setMessages((prev) => mergeMessages(prev, loaded));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionFiltered(allPseudos.filter((p) => p.toLowerCase().startsWith(q) && p !== pseudo).slice(0, 6));
    } else {
      setMentionFiltered([]);
    }
  };

  const insertMention = (p: string) => {
    const el = inputRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? input.length;
    const newVal = input.slice(0, cursor).replace(/@\w*$/, `@${p} `) + input.slice(cursor);
    setInput(newVal);
    setMentionFiltered([]);
    setTimeout(() => { el.focus(); }, 0);
  };

  const handleSend = async () => {
    if (!input.trim() || userId === "dev-user" || sending) return;
    const lower = input.toLowerCase();
    const forbidden = censoredWordsRef.current.find((w) => lower.includes(w)) ?? null;
    if (forbidden) {
      setCensorError(`Le mot « ${forbidden} » est interdit dans cet espace.`);
      setInput("");
      return;
    }
    setSending(true);
    const text = input.trim();
    setInput("");

    const { data, error } = await supabase.from("messages").insert({
      content: text,
      author_id: userId,
      space_id: spaceId,
    }).select("id, content, created_at, author_id").single();

    if (!error && data) {
      setMessages((prev) => mergeMessages(prev, [{ ...data, pseudo, is_superadmin: isFounder ?? false }]));
    } else {
      // en cas d'erreur, recharge tout
      await loadMessages();
    }
    setSending(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "var(--muted)",
        }}>
          # général
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "16px 24px",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        {messages.length === 0 && (
          <p style={{
            textAlign: "center", color: "var(--muted)", fontSize: 12,
            fontStyle: "italic", fontFamily: "Georgia, serif", marginTop: 48,
          }}>
            Le silence précède toute parole.
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.author_id === userId;
          const isSA = msg.is_superadmin;
          return (
            <div key={msg.id} style={{
              marginBottom: 12,
              ...(isSA ? {
                background: "linear-gradient(135deg, rgba(201,136,76,0.10) 0%, rgba(201,136,76,0.04) 100%)",
                border: "1px solid rgba(201,136,76,0.4)",
                borderRadius: 8,
                padding: "10px 14px",
                boxShadow: "0 0 16px rgba(201,136,76,0.12)",
              } : {}),
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                {isSA && (
                  <span style={{
                    fontSize: 8, color: "#c9884c",
                    background: "rgba(201,136,76,0.12)",
                    border: "1px solid rgba(201,136,76,0.4)",
                    borderRadius: 3, padding: "1px 6px",
                    letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
                  }}>♔ Fondateur</span>
                )}
                <span
                  onClick={(e) => setPopup({ userId: msg.author_id, anchor: e.currentTarget as HTMLElement })}
                  style={{
                    fontSize: isSA ? 14 : 13,
                    fontWeight: 700,
                    color: isSA ? "#c9884c" : isOwn ? "var(--accent)" : "var(--foreground)",
                    cursor: "pointer",
                    textShadow: isSA ? "0 0 10px rgba(201,136,76,0.35)" : "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {msg.pseudo || "Membre"}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: isSA ? 15 : 14, color: "var(--foreground)", lineHeight: 1.65, fontWeight: isSA ? 500 : 400 }}>
                {renderWithMentions(msg.content)}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {popup && (
        <UserPopup
          userId={popup.userId}
          anchorEl={popup.anchor}
          onClose={() => setPopup(null)}
          onViewProfile={(uid) => { setPopup(null); setProfilePanel(uid); }}
          spaceId={spaceId}
        />
      )}
      {profilePanel && (
        <ProfilePanel userId={profilePanel} onClose={() => setProfilePanel(null)} spaceId={spaceId} />
      )}

      {/* Input */}
      <div style={{
        padding: "12px 24px 20px",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {censorError && (
          <div style={{
            background: "rgba(201,76,76,0.07)", border: "1px solid rgba(201,76,76,0.28)",
            borderRadius: 6, padding: "8px 12px", marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}>
            <span style={{ fontSize: 11, color: "#c94c4c" }}>⊘ {censorError}</span>
            <button onClick={() => setCensorError(null)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(201,76,76,0.5)", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
            }}>×</button>
          </div>
        )}
        {banInfo ? (
          <div style={{
            padding: "12px 16px", background: "rgba(201,76,76,0.07)",
            border: "1px solid rgba(201,76,76,0.3)", borderRadius: 6,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 12, color: "#c94c4c" }}>
              {banInfo.banned_until
                ? `Vous êtes banni jusqu'au ${new Date(banInfo.banned_until).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                : "Vous êtes banni définitivement de cet espace."}
            </span>
          </div>
        ) : (
        <div style={{ position: "relative" }}>
          {mentionFiltered.length > 0 && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 6, zIndex: 50, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}>
              {mentionFiltered.map((p) => (
                <button key={p} onMouseDown={(e) => { e.preventDefault(); insertMention(p); }} style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 14px", background: "transparent", border: "none",
                  borderBottom: "1px solid var(--border)", color: "var(--foreground)",
                  fontSize: 13, cursor: "pointer",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,111,247,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color: "var(--accent)" }}>@</span>{p}
                </button>
              ))}
            </div>
          )}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "10px 14px",
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setMentionFiltered([]); return; }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Écrire un message… (@pseudo pour mentionner)"
            style={{
              flex: 1, background: "transparent", border: "none",
              outline: "none", color: "var(--foreground)", fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || userId === "dev-user"}
            style={{
              background: input.trim() && userId !== "dev-user" ? "var(--accent)" : "transparent",
              border: "none", borderRadius: 4,
              cursor: input.trim() && userId !== "dev-user" ? "pointer" : "default",
              color: input.trim() && userId !== "dev-user" ? "#fff" : "var(--muted)",
              padding: "4px 10px", fontSize: 16, lineHeight: 1,
              transition: "background 0.15s",
            }}
          >
            ↑
          </button>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}
