"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ModMessage = {
  id: string;
  content: string;
  from_owner: boolean;
  sender_id: string | null;
  created_at: string;
};

export default function ModTab({ userId, pseudo, spaceId }: { userId: string; pseudo: string; spaceId: string }) {
  const [messages, setMessages] = useState<ModMessage[]>([]);
  const [senderPseudos, setSenderPseudos] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    loadMessages();

    if (channelRef.current) return;
    channelRef.current = supabase
      .channel("mod-app-" + userId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "mod_applications",
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const row = payload.new as ModMessage & { space_id: string };
        if (row.space_id !== spaceId) return;
        if (row.from_owner && row.sender_id) {
          const { data } = await supabase.from("profiles").select("pseudo").eq("id", row.sender_id).single();
          if (data) setSenderPseudos((prev) => ({ ...prev, [row.sender_id!]: data.pseudo }));
        }
        setMessages((prev) => [...prev, row]);
      })
      .subscribe();

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("mod_applications")
      .select("id, content, from_owner, sender_id, created_at")
      .eq("user_id", userId)
      .eq("space_id", spaceId)
      .order("created_at", { ascending: true });
    const msgs = (data ?? []) as ModMessage[];
    setMessages(msgs);

    const staffSenderIds = [...new Set(
      msgs.filter((m) => m.from_owner && m.sender_id).map((m) => m.sender_id as string)
    )];
    if (staffSenderIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", staffSenderIds);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => { map[p.id] = p.pseudo; });
      setSenderPseudos(map);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || userId === "dev-user" || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    const { data, error } = await supabase
      .from("mod_applications")
      .insert({ space_id: spaceId, user_id: userId, content: text, from_owner: false })
      .select("id, content, from_owner, created_at")
      .single();
    if (!error && data) setMessages((prev) => [...prev, data]);
    setSending(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#c9884c" }}>✦</span>
          <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c9884c", fontWeight: 600 }}>
            Devenir Modérateur
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.7, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
          Tu souhaites contribuer à la vie de la communauté ?
          Écris au fondateur — ta candidature sera lue avec attention.
        </p>
      </div>

      {/* Thread */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{
              textAlign: "center", color: "var(--muted)", fontSize: 13,
              fontStyle: "italic", fontFamily: "Georgia, serif",
              maxWidth: 300, lineHeight: 1.8,
            }}>
              Présente-toi et explique ce qui te motive à rejoindre l'équipe de modération.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: msg.from_owner ? "flex-start" : "flex-end",
            gap: 4,
          }}>
            <span style={{ fontSize: 9, color: msg.from_owner ? "#c9884c" : "var(--accent)", letterSpacing: "0.08em" }}>
              {msg.from_owner
                ? (msg.sender_id && senderPseudos[msg.sender_id] ? senderPseudos[msg.sender_id] : "♔ Fondateur")
                : pseudo}
            </span>
            <div style={{
              maxWidth: "76%",
              background: msg.from_owner
                ? "linear-gradient(135deg, rgba(201,136,76,0.13) 0%, rgba(201,136,76,0.06) 100%)"
                : "rgba(124,111,247,0.1)",
              border: `1px solid ${msg.from_owner ? "rgba(201,136,76,0.35)" : "rgba(124,111,247,0.22)"}`,
              borderRadius: msg.from_owner ? "2px 12px 12px 12px" : "12px 2px 12px 12px",
              padding: "10px 14px",
              boxShadow: msg.from_owner ? "0 0 12px rgba(201,136,76,0.08)" : "none",
            }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.65 }}>
                {msg.content}
              </p>
            </div>
            <span style={{ fontSize: 9, color: "var(--muted)" }}>
              {new Date(msg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 24px 20px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "10px 14px",
          transition: "border-color 0.15s",
        }}
          onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.45)")}
          onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Écris ta candidature…"
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
              background: input.trim() && !sending ? "rgba(201,136,76,0.8)" : "transparent",
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
