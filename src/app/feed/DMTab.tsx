"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type PM = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

type Conversation = {
  userId: string;
  pseudo: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

type Member = { id: string; pseudo: string };

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Hier";
  if (days < 7)  return date.toLocaleDateString("fr-FR", { weekday: "long" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function ConvCard({ conv, isActive, onClick }: { conv: Conversation; isActive: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "11px 14px",
        background: isActive ? "rgba(124,111,247,0.08)" : hovered ? "rgba(255,255,255,0.02)" : "transparent",
        borderTop: "none", borderRight: "none",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
        textAlign: "left", transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: "rgba(124,111,247,0.12)", border: "1px solid rgba(124,111,247,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: "var(--accent)", fontWeight: 600, userSelect: "none",
      }}>
        {conv.pseudo[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{conv.pseudo}</span>
          <span style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0, marginLeft: 4 }}>{formatTime(conv.lastAt)}</span>
        </div>
        <div style={{
          fontSize: 11, color: conv.unread > 0 ? "var(--foreground)" : "var(--muted)",
          fontWeight: conv.unread > 0 ? 500 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {conv.lastMessage || "—"}
        </div>
      </div>
      {conv.unread > 0 && (
        <div style={{
          minWidth: 18, height: 18, borderRadius: 9,
          background: "var(--accent)", color: "#fff",
          fontSize: 9, fontWeight: 700, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
        }}>
          {conv.unread > 99 ? "99+" : conv.unread}
        </div>
      )}
    </button>
  );
}

export default function DMTab({
  userId, spaceId, onUnreadChange,
}: {
  userId: string; spaceId: string; onUnreadChange?: (hasUnread: boolean) => void;
}) {
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [selectedPseudo, setSelectedPseudo] = useState("");
  const [messages, setMessages]             = useState<PM[]>([]);
  const [input, setInput]                   = useState("");
  const [sending, setSending]               = useState(false);
  const [loadingThread, setLoadingThread]   = useState(false);
  const [newConvOpen, setNewConvOpen]       = useState(false);
  const [members, setMembers]               = useState<Member[]>([]);
  const [memberSearch, setMemberSearch]     = useState("");

  const bottomRef      = useRef<HTMLDivElement>(null);
  const selectedIdRef  = useRef<string | null>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  /* ── Charger la liste des conversations ── */
  const loadConversations = async () => {
    const { data } = await supabase
      .from("private_messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!data) return;

    const convMap = new Map<string, PM[]>();
    for (const msg of data) {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      if (!convMap.has(otherId)) convMap.set(otherId, []);
      convMap.get(otherId)!.push(msg);
    }

    const partnerIds = Array.from(convMap.keys());
    if (partnerIds.length === 0) { setConversations([]); return; }

    const { data: profiles } = await supabase
      .from("profiles").select("id, pseudo").in("id", partnerIds);
    const pseudoMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: { id: string; pseudo: string }) => { pseudoMap[p.id] = p.pseudo; });

    const convs: Conversation[] = Array.from(convMap.entries()).map(([uid, msgs]) => {
      const latest = msgs[0];
      const unread = msgs.filter((m) => m.recipient_id === userId && !m.read_at).length;
      return { userId: uid, pseudo: pseudoMap[uid] ?? "Membre", lastMessage: latest.content, lastAt: latest.created_at, unread };
    }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

    setConversations(convs);
    onUnreadChange?.(convs.some((c) => c.unread > 0));
  };

  /* ── Charger le fil d'une conversation ── */
  const loadThread = async (otherId: string) => {
    setLoadingThread(true);
    const { data } = await supabase
      .from("private_messages")
      .select("*")
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
    setLoadingThread(false);

    // Marquer comme lu
    await supabase.from("private_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId).eq("sender_id", otherId).is("read_at", null);
    loadConversations();
  };

  useEffect(() => {
    if (userId === "dev-user") return;
    loadConversations();
  }, [userId]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
    else setMessages([]);
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Temps réel ── */
  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    const channel = supabase
      .channel("dm-inbox-" + userId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "private_messages",
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const msg = payload.new as PM;
        if (msg.sender_id === selectedIdRef.current) {
          setMessages((prev) => [...prev, msg]);
          supabase.from("private_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", msg.id).then(() => {});
        }
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  /* ── Envoyer ── */
  const handleSend = async () => {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    const { data, error } = await supabase
      .from("private_messages")
      .insert({ sender_id: userId, recipient_id: selectedId, content })
      .select().single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as PM]);
      loadConversations();
    }
    setSending(false);
    textareaRef.current?.focus();
  };

  /* ── Membres pour nouvelle conversation ── */
  const loadMembers = async () => {
    const { data: memberRows } = await supabase
      .from("space_members").select("user_id")
      .eq("space_id", spaceId).neq("user_id", userId);
    const ids = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);
    if (ids.length === 0) { setMembers([]); return; }
    const { data: profileRows } = await supabase
      .from("profiles").select("id, pseudo").in("id", ids);
    setMembers((profileRows ?? []).map((p: { id: string; pseudo: string }) => ({ id: p.id, pseudo: p.pseudo })));
  };

  const startConversation = (member: Member) => {
    setSelectedId(member.id);
    setSelectedPseudo(member.pseudo);
    setNewConvOpen(false);
    setMemberSearch("");
    if (!conversations.find((c) => c.userId === member.id)) {
      setConversations((prev) => [
        { userId: member.id, pseudo: member.pseudo, lastMessage: "", lastAt: new Date().toISOString(), unread: 0 },
        ...prev,
      ]);
    }
  };

  const filteredMembers = members.filter((m) =>
    m.pseudo.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>

      {/* ── Panneau gauche : liste ── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        background: "rgba(255,255,255,0.008)",
      }}>
        <div style={{
          padding: "16px 14px 13px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", color: "var(--foreground)", letterSpacing: "0.04em" }}>
            Messages privés
          </span>
          <button
            onClick={() => { setNewConvOpen(true); loadMembers(); }}
            style={{
              width: 24, height: 24, background: "rgba(124,111,247,0.08)",
              border: "1px solid rgba(124,111,247,0.25)", borderRadius: 6,
              cursor: "pointer", color: "var(--accent)", fontSize: 15, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,111,247,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(124,111,247,0.08)")}
            title="Nouveau message"
          >
            +
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: 1.6 }}>
                Aucune conversation.<br />Appuyez sur + pour écrire.
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvCard
                key={conv.userId}
                conv={conv}
                isActive={selectedId === conv.userId}
                onClick={() => { setSelectedId(conv.userId); setSelectedPseudo(conv.pseudo); }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Panneau droit : fil ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selectedId ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.12 }}>◇</div>
              <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
                Sélectionnez une conversation
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* En-tête fil */}
            <div style={{
              padding: "12px 20px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(124,111,247,0.12)", border: "1px solid rgba(124,111,247,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: "var(--accent)", fontWeight: 600, userSelect: "none",
              }}>
                {selectedPseudo[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                {selectedPseudo}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px" }}>
              {loadingThread ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, paddingTop: 40 }}>…</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", paddingTop: 48 }}>
                  <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
                    Débutez la conversation.
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.sender_id === userId;
                  const prev = messages[i - 1];
                  const showSep = i === 0 || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
                  return (
                    <div key={msg.id}>
                      {showSep && (
                        <div style={{ textAlign: "center", margin: "10px 0 8px" }}>
                          <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em" }}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 3 }}>
                        <div style={{
                          maxWidth: "72%",
                          background: isMine ? "rgba(124,111,247,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isMine ? "rgba(124,111,247,0.3)" : "rgba(255,255,255,0.07)"}`,
                          borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          padding: "8px 12px",
                          fontSize: 13, color: "var(--foreground)", lineHeight: 1.55,
                          wordBreak: "break-word",
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: "10px 16px 14px", borderTop: "1px solid var(--border)",
              display: "flex", gap: 8, alignItems: "flex-end",
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={`Message à ${selectedPseudo}…`}
                rows={1}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)", borderRadius: 8,
                  color: "var(--foreground)", fontSize: 13, lineHeight: 1.5,
                  padding: "8px 12px", resize: "none", outline: "none",
                  fontFamily: "inherit", maxHeight: 120, overflowY: "auto",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,111,247,0.45)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{
                  padding: "8px 14px", flexShrink: 0,
                  background: input.trim() ? "rgba(124,111,247,0.18)" : "transparent",
                  border: "1px solid rgba(124,111,247,0.3)", borderRadius: 8,
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  color: input.trim() ? "var(--accent)" : "var(--muted)",
                  fontSize: 14, fontWeight: 600, transition: "all 0.15s",
                }}
              >
                →
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Modal nouvelle conversation ── */}
      {newConvOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => { setNewConvOpen(false); setMemberSearch(""); }}
        >
          <div
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, width: 340, maxHeight: 440,
              display: "flex", flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              animation: "fadeIn 0.15s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", color: "var(--foreground)", marginBottom: 10 }}>
                Nouveau message
              </div>
              <input
                autoFocus
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Rechercher un membre…"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)", borderRadius: 6,
                  color: "var(--foreground)", fontSize: 12, padding: "7px 10px",
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,111,247,0.45)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredMembers.length === 0 ? (
                <p style={{ padding: "24px 16px", textAlign: "center", fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                  {memberSearch ? "Aucun résultat" : "Aucun membre disponible"}
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => startConversation(m)}
                    style={{
                      width: "100%", padding: "10px 14px",
                      background: "transparent", border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      display: "flex", alignItems: "center", gap: 10,
                      cursor: "pointer", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(124,111,247,0.1)", border: "1px solid rgba(124,111,247,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "var(--accent)", fontWeight: 600,
                    }}>
                      {m.pseudo[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--foreground)" }}>{m.pseudo}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
