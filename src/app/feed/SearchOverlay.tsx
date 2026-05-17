"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";


type Result = { id: string; content: string; created_at: string; author_id: string; pseudo: string };

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function SearchOverlay({ onClose, spaceId }: { onClose: () => void; userId: string; spaceId: string }) {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Result[]>([]);
  const [messages, setMessages] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setPosts([]); setMessages([]); setSearched(false); return; }

    timerRef.current = setTimeout(async () => {
      const [{ data: postsData }, { data: messagesData }] = await Promise.all([
        supabase.from("posts").select("id, content, created_at, author_id").eq("space_id", spaceId).ilike("content", `%${query}%`).limit(10),
        supabase.from("messages").select("id, content, created_at, author_id").eq("space_id", spaceId).ilike("content", `%${query}%`).limit(10),
      ]);

      const authorIds = [...new Set([...(postsData ?? []).map((p) => p.author_id), ...(messagesData ?? []).map((m) => m.author_id)])];
      const profileMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", authorIds);
        (profiles ?? []).forEach((p) => { profileMap[p.id] = p.pseudo; });
      }

      setPosts((postsData ?? []).map((p) => ({ ...p, pseudo: profileMap[p.author_id] ?? "Membre" })));
      setMessages((messagesData ?? []).map((m) => ({ ...m, pseudo: profileMap[m.author_id] ?? "Membre" })));
      setSearched(true);
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const noResults = searched && posts.length === 0 && messages.length === 0;
  const hasResults = posts.length > 0 || messages.length > 0;

  return (
    <div onClick={onClose} className="sibyl-overlay-backdrop" style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.6)",
      display: "flex", justifyContent: "center",
      alignItems: "flex-start", paddingTop: 80,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, margin: "0 16px" }}>

        {/* Input */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ color: "var(--muted)", fontSize: 16, flexShrink: 0 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher publications et messages…"
            style={{
              flex: 1, background: "transparent", border: "none",
              outline: "none", color: "var(--foreground)", fontSize: 14, fontFamily: "inherit",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{
              background: "transparent", border: "none", color: "var(--muted)",
              cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1,
            }}>×</button>
          )}
        </div>

        {/* Résultats */}
        {(hasResults || noResults) && (
          <div style={{
            marginTop: 8, background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden",
          }}>
            {noResults && (
              <p style={{ margin: 0, padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
                Aucun résultat.
              </p>
            )}

            {posts.length > 0 && (
              <div>
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
                  Publications
                </div>
                {posts.map((post, i) => (
                  <div key={post.id} style={{ padding: "12px 16px", borderBottom: i < posts.length - 1 || messages.length > 0 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{post.pseudo}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(post.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {post.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {messages.length > 0 && (
              <div>
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
                  Messages
                </div>
                {messages.map((msg, i) => (
                  <div key={msg.id} style={{ padding: "12px 16px", borderBottom: i < messages.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{msg.pseudo}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(msg.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
