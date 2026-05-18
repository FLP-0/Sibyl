"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ChatTab from "./ChatTab";
import FeedTab from "./FeedTab";
import ProfileTab from "./ProfileTab";
import AdminTab from "./AdminTab";
import HomeTab from "./HomeTab";
import ModTab from "./ModTab";
import StaffTab from "./StaffTab";
import SearchOverlay from "./SearchOverlay";

const DEFAULT_spaceId = "831eda8b-5972-4250-8ac4-bb536ee0d0f5";
const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";
type Tab = "home" | "chat" | "feed" | "profile" | "admin" | "mod" | "staff";

export default function FeedPage() {
  return <Suspense><FeedPageInner /></Suspense>;
}

function FeedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams.get("space") ?? DEFAULT_spaceId;
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [role, setRole] = useState<string>("member");
  const [isOwner, setIsOwner] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [unread, setUnread] = useState<{ chat: boolean; feed: boolean }>({ chat: false, feed: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [mentionToast, setMentionToast] = useState<{ from: string; content: string } | null>(null);
  const [founderToast, setFounderToast] = useState<{ from: string; content: string; kind: "message" | "post" } | null>(null);
  const tabRef = useRef<Tab>("home");
  const userIdRef = useRef<string | null>(null);
  const pseudoRef = useRef<string | null>(null);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        if (process.env.NODE_ENV === "development") {
          setUserId("dev-user");
          setPseudo("Prévisualisation");
          setRole("admin");
          return;
        }
        router.push("/");
        return;
      }
      const uid = data.session.user.id;
      setUserId(uid);
      setPseudo(data.session.user.user_metadata?.pseudo ?? "Initié");
      setIsOwner((data.session.user.email ?? "").toLowerCase() === OWNER_EMAIL.toLowerCase());

      const { data: member } = await supabase
        .from("space_members")
        .select("role")
        .eq("user_id", uid)
        .eq("space_id", spaceId)
        .single();
      setRole(member?.role ?? "member");
    });
  }, [router]);

  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { pseudoRef.current = pseudo; }, [pseudo]);

  // Mise à jour du rôle en temps réel
  useEffect(() => {
    if (!userId || userId === "dev-user") return;
    const channel = supabase
      .channel("role-" + userId + "-" + spaceId)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "space_members",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as { space_id: string; role: string };
        if (row.space_id === spaceId) setRole(row.role);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, spaceId]);

  useEffect(() => {
    userIdRef.current = userId;
    if (!userId || userId === "dev-user") return;
    if (notifChannelRef.current) return;

    notifChannelRef.current = supabase
      .channel("notif-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `space_id=eq.${spaceId}` }, async (payload) => {
        const row = payload.new as { author_id: string; content: string };
        const isSelf = row.author_id === userIdRef.current;
        const { data } = await supabase.from("profiles").select("pseudo, is_superadmin").eq("id", row.author_id).single();
        if (data?.is_superadmin) {
          setFounderToast({ from: data.pseudo, content: row.content, kind: "message" });
          setTimeout(() => setFounderToast(null), 8000);
          return;
        }
        if (isSelf) return;
        if (tabRef.current !== "chat") setUnread((u) => ({ ...u, chat: true }));
        if (pseudoRef.current && row.content.includes(`@${pseudoRef.current}`)) {
          setMentionToast({ from: data?.pseudo ?? "Quelqu'un", content: row.content });
          setTimeout(() => setMentionToast(null), 6000);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `space_id=eq.${spaceId}` }, async (payload) => {
        const row = payload.new as { author_id: string; content: string };
        const isSelf = row.author_id === userIdRef.current;
        const { data } = await supabase.from("profiles").select("pseudo, is_superadmin").eq("id", row.author_id).single();
        if (data?.is_superadmin) {
          setFounderToast({ from: data.pseudo, content: row.content, kind: "post" });
          setTimeout(() => setFounderToast(null), 8000);
          return;
        }
        if (isSelf) return;
        if (tabRef.current !== "feed") setUnread((u) => ({ ...u, feed: true }));
        if (pseudoRef.current && row.content.includes(`@${pseudoRef.current}`)) {
          setMentionToast({ from: data?.pseudo ?? "Quelqu'un", content: row.content });
          setTimeout(() => setMentionToast(null), 6000);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, (payload) => {
        const row = payload.new as { post_id: string };
        void row;
        if (tabRef.current !== "feed") setUnread((u) => ({ ...u, feed: true }));
      })
      .subscribe();

    return () => {
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
        notifChannelRef.current = null;
      }
    };
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!pseudo || !userId) return null;

  const isAdmin = role === "admin" || isOwner;

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--background)", overflow: "hidden" }}>

      {/* Sidebar */}
      <aside className="sibyl-sidebar" style={{
        width: 64, display: "flex",
        flexDirection: "column", alignItems: "center",
        paddingTop: 20, flexShrink: 0,
      }}>
        {/* Logo */}
        <div className="sibyl-sidebar-logo" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.2em", color: "var(--accent)", fontFamily: "Georgia, serif" }}>
            S
          </span>
        </div>

        {/* Onglets */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
          <SidebarTab label="Accueil" active={tab === "home"} onClick={() => setTab("home")} icon={<HomeIcon />} />
          <SidebarTab label="Chat" active={tab === "chat"} onClick={() => { setTab("chat"); setUnread((u) => ({ ...u, chat: false })); }} icon={<ChatIcon />} hasUnread={unread.chat} />
          <SidebarTab label="Feed" active={tab === "feed"} onClick={() => { setTab("feed"); setUnread((u) => ({ ...u, feed: false })); }} icon={<FeedIcon />} hasUnread={unread.feed} />
          <SidebarTab label="Profil" active={tab === "profile"} onClick={() => setTab("profile")} icon={<ProfileIcon />} />
          <SidebarTab label="Modération" active={tab === "mod"} onClick={() => setTab("mod")} icon={<ModIcon />} accent="#c9884c" />
          {(role === "moderator" || isAdmin) && (
            <SidebarTab label="Staff" active={tab === "staff"} onClick={() => setTab("staff")} icon={<StaffIcon />} accent="var(--accent)" />
          )}
          {isAdmin && (
            <SidebarTab label="Admin" active={tab === "admin"} onClick={() => setTab("admin")} icon={<AdminIcon />} accent="#c9884c" />
          )}
        </nav>

        {/* Bas */}
        <div className="sibyl-sidebar-bottom" style={{ marginTop: "auto", paddingBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {isOwner && (
            <button
              onClick={() => router.push("/superadmin")}
              title="Espace fondateur"
              className="sibyl-crown-btn"
              style={{
                background: "rgba(201,136,76,0.08)",
                border: "1px solid rgba(201,136,76,0.25)",
                cursor: "pointer",
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                boxShadow: "0 0 0 rgba(201,136,76,0)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(201,136,76,0.18)";
                e.currentTarget.style.borderColor = "rgba(201,136,76,0.6)";
                e.currentTarget.style.boxShadow = "0 0 14px rgba(201,136,76,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(201,136,76,0.08)";
                e.currentTarget.style.borderColor = "rgba(201,136,76,0.25)";
                e.currentTarget.style.boxShadow = "0 0 0 rgba(201,136,76,0)";
              }}
            >
              <CrownIcon />
            </button>
          )}
          <button
            onClick={() => setSearchOpen(true)}
            title="Rechercher"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: 6, borderRadius: 4, color: "var(--muted)", display: "flex",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            <SearchIcon />
          </button>
          <div
            title={pseudo}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(124,111,247,0.15)", border: "1px solid rgba(124,111,247,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "var(--accent)", fontWeight: 600,
              cursor: "default", userSelect: "none",
            }}
          >
            {pseudo[0].toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: 6, borderRadius: 4, color: "var(--muted)", display: "flex",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main className="sibyl-main" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div key={tab} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", animation: "fadeIn 0.18s ease" }}>
          {tab === "home" && <HomeTab pseudo={pseudo} spaceId={spaceId} />}
          {tab === "chat" && <ChatTab userId={userId} pseudo={pseudo} spaceId={spaceId} isFounder={isOwner} />}
          {tab === "feed" && <FeedTab userId={userId} pseudo={pseudo} spaceId={spaceId} />}
          {tab === "profile" && <ProfileTab userId={userId} pseudo={pseudo} spaceId={spaceId} setPseudo={(p) => setPseudo(p)} />}
          {tab === "mod" && <ModTab userId={userId} pseudo={pseudo} spaceId={spaceId} />}
          {tab === "staff" && (role === "moderator" || isAdmin) && <StaffTab userId={userId} pseudo={pseudo} role={role} spaceId={spaceId} />}
          {tab === "admin" && isAdmin && <AdminTab userId={userId} spaceId={spaceId} currentUserRole={role} isOwner={isOwner} />}
        </div>
      </main>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} userId={userId} spaceId={spaceId} />}

      {founderToast && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 600,
          background: "linear-gradient(90deg, #8a5a1a 0%, #c9884c 40%, #e0a060 60%, #c9884c 100%)",
          backgroundSize: "200% 100%",
          animation: "founderBanner 0.35s cubic-bezier(0.22,1,0.36,1), founderShimmer 3s linear infinite",
          padding: "14px 24px",
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 4px 32px rgba(201,136,76,0.5)",
        }}>
          <style>{`
            @keyframes founderBanner { from { transform: translateY(-100%); opacity:0; } to { transform: translateY(0); opacity:1; } }
            @keyframes founderShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          `}</style>
          <span style={{ fontSize: 20 }}>♔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: 2 }}>
              {founderToast.kind === "post" ? "Nouvelle publication du Fondateur" : "Message du Fondateur"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {founderToast.content}
            </div>
          </div>
          <button onClick={() => setFounderToast(null)} style={{
            background: "rgba(0,0,0,0.2)", border: "none", color: "#fff",
            cursor: "pointer", width: 28, height: 28, borderRadius: "50%",
            fontSize: 18, lineHeight: 1, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
      )}

      {mentionToast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 500,
          background: "var(--surface)", border: "2px solid var(--accent)",
          borderRadius: 8, padding: "14px 18px", maxWidth: 320,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            Vous avez été mentionné(e)
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
            {mentionToast.from}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {mentionToast.content}
          </p>
          <button onClick={() => setMentionToast(null)} style={{
            position: "absolute", top: 8, right: 10,
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 16, lineHeight: 1,
          }}>×</button>
        </div>
      )}
    </div>
  );
}

function SidebarTab({ label, active, onClick, icon, accent, hasUnread }: {
  label: string; active: boolean; onClick: () => void; icon: React.ReactNode; accent?: string; hasUnread?: boolean;
}) {
  const color = accent ?? "var(--accent)";
  const activeBg = accent ? "rgba(201,136,76,0.08)" : "rgba(138,127,248,0.08)";
  return (
    <button
      onClick={onClick}
      title={label}
      data-active={active ? "true" : "false"}
      style={{
        width: "100%", padding: "11px 0",
        background: active ? activeBg : "transparent",
        border: "none",
        borderLeft: `2px solid ${active ? color : "transparent"}`,
        cursor: "pointer", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 5,
        color: active ? color : "var(--muted)",
        outline: "none", position: "relative",
        transition: "color 0.18s ease, background 0.18s ease, border-color 0.18s ease",
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; } }}
    >
      {hasUnread && (
        <span style={{
          position: "absolute", top: 7, right: 9,
          width: 6, height: 6, borderRadius: "50%",
          background: "#E05555",
          boxShadow: "0 0 6px rgba(224,85,85,0.6)",
        }} />
      )}
      {icon}
      <span style={{ fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function HomeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>;
}
function ChatIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function FeedIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}
function ProfileIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}
function AdminIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
function ModIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" /></svg>;
}
function StaffIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>;
}
function LogoutIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}
function CrownIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c9884c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 19h20M3 9l4 5 5-9 5 9 4-5 -1 10H4z" />
      <circle cx="12" cy="5" r="1" fill="#c9884c" stroke="none" />
      <circle cx="3" cy="9" r="1" fill="#c9884c" stroke="none" />
      <circle cx="21" cy="9" r="1" fill="#c9884c" stroke="none" />
    </svg>
  );
}
