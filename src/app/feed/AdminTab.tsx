"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";


type Member = {
  user_id: string;
  role: string;
  joined_at: string;
  pseudo: string;
  bio: string | null;
  posts: number;
  messages: number;
  likes_received: number;
};

type GlobalStats = { members: number; posts: number; messages: number; reactions: number };


type Section = "membres" | "contenu" | "espace" | "analytics" | "invitations" | "candidatures" | "demandes";
type AccessRequest = { id: string; user_id: string; pseudo: string; created_at: string };
type ModMessage = { id: string; content: string; from_owner: boolean; created_at: string };
type Candidature = { user_id: string; pseudo: string; messages: ModMessage[] };
type Invitation = { id: string; code: string; status: string; expires_at: string; created_at: string; invited_by_pseudo: string; used_by_pseudo: string | null };
type ContentItem = { id: string; type: "post" | "message" | "join"; content: string; pseudo: string; created_at: string; pinned?: boolean; reactions?: number; author_id?: string };
type DayActivity = { date: string; posts: number; messages: number };
type BanInfo = { id: string; banned_until: string | null };

const BAN_DURATIONS_MOD = [
  { label: "15 minutes", value: "900" },
  { label: "1 heure",    value: "3600" },
  { label: "24 heures",  value: "86400" },
  { label: "48 heures",  value: "172800" },
  { label: "1 semaine",  value: "604800" },
];
const BAN_DURATIONS_ADMIN = [
  ...BAN_DURATIONS_MOD,
  { label: "Définitif",  value: "permanent" },
];

const ROLES = ["member", "moderator", "admin"] as const;
const roleLabel: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",      color: "#c9884c" },
  moderator: { label: "Modérateur", color: "var(--accent)" },
  member:    { label: "Membre",     color: "var(--muted)" },
};

type ConfirmAction =
  | { type: "role"; memberId: string; value: string }
  | { type: "remove"; memberId: string }
  | { type: "delete-post"; postId: string }
  | { type: "delete-message"; messageId: string }
  | { type: "pin"; postId: string; pinned: boolean }
  | { type: "ban"; memberId: string; memberPseudo: string; duration: string }
  | { type: "unban"; memberId: string; memberPseudo: string; banId: string };

export default function AdminTab({ userId, spaceId, currentUserRole, isOwner }: { userId: string; spaceId: string; currentUserRole: string; isOwner?: boolean }) {
  const [section, setSection] = useState<Section>("membres");
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [contentFeed, setContentFeed] = useState<ContentItem[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [shareInvite, setShareInvite] = useState<Invitation | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [inactiveMembers, setInactiveMembers] = useState<Member[]>([]);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDesc, setSpaceDesc] = useState("");
  const [spaceCode, setSpaceCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [analyticsData, setAnalyticsData] = useState<DayActivity[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"role" | "posts" | "messages" | "joined">("role");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingSpace, setSavingSpace] = useState(false);
  const [spaceSuccess, setSpaceSuccess] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [bans, setBans] = useState<Map<string, BanInfo>>(new Map());
  const [banDuration, setBanDuration] = useState("3600");
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [selectedCandidature, setSelectedCandidature] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [impersonateLoading, setImpersonateLoading] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [
      { data: membersData },
      { count: postsCount },
      { count: messagesCount },
      { count: reactionsCount },
      { data: spaceData },
    ] = await Promise.all([
      supabase.rpc("get_space_members", { p_space_id: spaceId }),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("reactions").select("id", { count: "exact", head: true }),
      supabase.from("spaces").select("name, description, code").eq("id", spaceId).single(),
    ]);

    if (spaceData) {
      setSpaceName(spaceData.name ?? "");
      setSpaceDesc(spaceData.description ?? "");
      setSpaceCode(spaceData.code ?? "");
      setNewCode(spaceData.code ?? "");
    }

    if (!membersData) { setLoading(false); return; }

    const userIds = (membersData as Member[]).map((m: Member) => m.user_id);
    const [{ data: postsByUser }, { data: messagesByUser }, { data: postsForLikes }] = await Promise.all([
      supabase.from("posts").select("author_id").eq("space_id", spaceId).in("author_id", userIds),
      supabase.from("messages").select("author_id").eq("space_id", spaceId).in("author_id", userIds),
      supabase.from("posts").select("author_id, reactions(id)").eq("space_id", spaceId).in("author_id", userIds),
    ]);

    const postCount: Record<string, number> = {};
    (postsByUser ?? []).forEach((p) => { postCount[p.author_id] = (postCount[p.author_id] ?? 0) + 1; });
    const msgCount: Record<string, number> = {};
    (messagesByUser ?? []).forEach((m) => { msgCount[m.author_id] = (msgCount[m.author_id] ?? 0) + 1; });
    const likesCount: Record<string, number> = {};
    (postsForLikes ?? []).forEach((p) => {
      likesCount[p.author_id] = (likesCount[p.author_id] ?? 0) + (p.reactions?.length ?? 0);
    });

    const enriched: Member[] = (membersData as { user_id: string; role: string; joined_at: string; pseudo: string; bio: string | null }[]).map((m) => ({
      user_id: m.user_id, role: m.role, joined_at: m.joined_at,
      pseudo: m.pseudo ?? "—", bio: m.bio ?? null,
      posts: postCount[m.user_id] ?? 0,
      messages: msgCount[m.user_id] ?? 0,
      likes_received: likesCount[m.user_id] ?? 0,
    }));
    enriched.sort((a, b) => {
      const order = { admin: 0, moderator: 1, member: 2 };
      return (order[a.role as keyof typeof order] ?? 3) - (order[b.role as keyof typeof order] ?? 3);
    });

    setMembers(enriched);
    setInactiveMembers(enriched.filter((m) => m.posts === 0 && m.messages === 0));
    setStats({ members: membersData.length, posts: postsCount ?? 0, messages: messagesCount ?? 0, reactions: reactionsCount ?? 0 });

    const { count: reqCount } = await supabase
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("status", "pending");
    setPendingCount(reqCount ?? 0);

    const { data: bansData } = await supabase.from("bans").select("id, user_id, banned_until").eq("space_id", spaceId);
    const bansMap = new Map<string, BanInfo>();
    (bansData ?? []).forEach((b: { id: string; user_id: string; banned_until: string | null }) => {
      if (!b.banned_until || new Date(b.banned_until) > new Date()) {
        bansMap.set(b.user_id, { id: b.id, banned_until: b.banned_until });
      }
    });
    setBans(bansMap);
    setLoading(false);
  };

  const buildContentFeed = async (currentMembers: Member[]) => {
    const pseudoMap: Record<string, string> = {};
    currentMembers.forEach((m) => { pseudoMap[m.user_id] = m.pseudo; });

    const [{ data: recentPosts }, { data: recentMessages }, { data: recentJoins }] = await Promise.all([
      supabase.from("posts").select("id, content, created_at, author_id, pinned, reactions(id)").eq("space_id", spaceId).order("created_at", { ascending: false }).limit(30),
      supabase.from("messages").select("id, content, created_at, author_id").eq("space_id", spaceId).order("created_at", { ascending: false }).limit(30),
      supabase.from("space_members").select("user_id, joined_at").eq("space_id", spaceId).order("joined_at", { ascending: false }).limit(10),
    ]);

    const authorIds = [...new Set([...(recentPosts ?? []).map((p) => p.author_id), ...(recentMessages ?? []).map((m) => m.author_id)])];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", authorIds);
      (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    }

    const all: ContentItem[] = [
      ...(recentPosts ?? []).map((p) => ({ id: p.id, type: "post" as const, content: p.content, pseudo: pseudoMap[p.author_id] ?? "—", created_at: p.created_at, pinned: p.pinned, reactions: p.reactions?.length ?? 0, author_id: p.author_id })),
      ...(recentMessages ?? []).map((m) => ({ id: m.id, type: "message" as const, content: m.content, pseudo: pseudoMap[m.author_id] ?? "—", created_at: m.created_at, author_id: m.author_id })),
      ...(recentJoins ?? []).map((j) => ({ id: j.user_id, type: "join" as const, content: "", pseudo: pseudoMap[j.user_id] ?? "—", created_at: j.joined_at })),
    ];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setContentFeed(all.slice(0, 60));
  };

  const subscribeRealtime = (currentMembers: Member[]) => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    const channel = supabase.channel("admin-content-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `space_id=eq.${spaceId}` }, () => buildContentFeed(currentMembers))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `space_id=eq.${spaceId}` }, () => buildContentFeed(currentMembers))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_members", filter: `space_id=eq.${spaceId}` }, () => buildContentFeed(currentMembers))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, () => buildContentFeed(currentMembers))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => buildContentFeed(currentMembers))
      .subscribe();
    realtimeRef.current = channel;
  };

  const fetchAnalytics = async () => {
    const days = 30;
    const results: DayActivity[] = [];
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const [{ data: postsData }, { data: messagesData }] = await Promise.all([
      supabase.from("posts").select("created_at").eq("space_id", spaceId).gte("created_at", since.toISOString()),
      supabase.from("messages").select("created_at").eq("space_id", spaceId).gte("created_at", since.toISOString()),
    ]);

    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      results.push({
        date: dateStr,
        posts: (postsData ?? []).filter((p) => p.created_at.slice(0, 10) === dateStr).length,
        messages: (messagesData ?? []).filter((m) => m.created_at.slice(0, 10) === dateStr).length,
      });
    }
    setAnalyticsData(results);
  };

  const fetchInvitations = async () => {
    const res = await fetch(`/api/invitations?space_id=${spaceId}`);
    if (!res.ok) return;
    const { invitations: data } = await res.json();
    setInvitations(data ?? []);
  };

  const createInvitation = async () => {
    setCreatingInvite(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, spaceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur inconnue");
      await fetchInvitations();
      setShareInvite({ ...json.invitation, invited_by_pseudo: "", used_by_pseudo: null });
    } catch (e) {
      alert("Impossible de créer l'invitation : " + (e instanceof Error ? e.message : e));
    }
    setCreatingInvite(false);
  };

  useEffect(() => {
    if (section === "contenu" && members.length > 0) {
      buildContentFeed(members);
      subscribeRealtime(members);
    }
    if (section === "analytics") fetchAnalytics();
    if (section === "invitations") fetchInvitations();
    if (section === "candidatures") fetchCandidatures();
    if (section === "demandes") fetchAccessRequests();
    if (section !== "contenu" && realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
      realtimeRef.current = null;
    }
  }, [section, members]);

  useEffect(() => {
    return () => { if (realtimeRef.current) supabase.removeChannel(realtimeRef.current); };
  }, []);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setActionLoading(true);
    const { error } = await supabase.rpc("set_member_role", {
      p_space_id: spaceId,
      p_user_id:  memberId,
      p_role:     newRole,
    });
    if (error) console.error("handleRoleChange error:", error.message, error.code);
    setConfirm(null);
    await fetchAll();
    setActionLoading(false);
  };

  const handleRemove = async (memberId: string) => {
    setActionLoading(true);
    const { error } = await supabase.rpc("remove_space_member", {
      p_space_id: spaceId,
      p_user_id:  memberId,
    });
    if (error) console.error("handleRemove error:", error.message);
    setConfirm(null);
    if (selected?.user_id === memberId) setSelected(null);
    await fetchAll();
    setActionLoading(false);
  };

  const handleDeletePost = async (postId: string) => {
    setActionLoading(true);
    await supabase.from("posts").delete().eq("id", postId);
    setConfirm(null);
    await buildContentFeed(members);
    setActionLoading(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    setActionLoading(true);
    await supabase.from("messages").delete().eq("id", messageId);
    setConfirm(null);
    await buildContentFeed(members);
    setActionLoading(false);
  };

  const handlePin = async (postId: string, pinned: boolean) => {
    setActionLoading(true);
    await supabase.from("posts").update({ pinned: !pinned }).eq("id", postId);
    setConfirm(null);
    await buildContentFeed(members);
    setActionLoading(false);
  };

  const handleSaveSpace = async () => {
    setSavingSpace(true);
    await supabase.from("spaces").update({ name: spaceName, description: spaceDesc, code: newCode }).eq("id", spaceId);
    setSpaceCode(newCode);
    setSavingSpace(false);
    setSpaceSuccess(true);
    setTimeout(() => setSpaceSuccess(false), 2000);
  };

  const handleBan = async (memberId: string, duration: string) => {
    setActionLoading(true);
    const banned_until = duration === "permanent" ? null : (() => {
      const d = new Date();
      d.setSeconds(d.getSeconds() + parseInt(duration));
      return d.toISOString();
    })();
    await supabase.from("bans").upsert(
      { user_id: memberId, space_id: spaceId, banned_by: userId, banned_until },
      { onConflict: "user_id,space_id" }
    );
    setConfirm(null);
    await fetchAll();
    setActionLoading(false);
  };

  const handleUnban = async (banId: string) => {
    setActionLoading(true);
    await supabase.from("bans").delete().eq("id", banId);
    setConfirm(null);
    await fetchAll();
    setActionLoading(false);
  };

  const canBanMember = (m: Member): boolean => {
    if (m.user_id === userId) return false;
    if (isOwner) return true;
    if (currentUserRole === "admin") return m.role !== "admin";
    if (currentUserRole === "moderator") return m.role === "member";
    return false;
  };

  const banDurationLabel = (value: string): string => {
    if (value === "permanent") return "définitivement";
    const found = BAN_DURATIONS_MOD.find((d) => d.value === value);
    return found ? `pour ${found.label.toLowerCase()}` : "";
  };

  const availableDurations = (currentUserRole === "moderator" && !isOwner)
    ? BAN_DURATIONS_MOD
    : BAN_DURATIONS_ADMIN;

  const fetchCandidatures = async () => {
    const { data: appsData } = await supabase
      .from("mod_applications")
      .select("id, user_id, content, from_owner, created_at")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: true });
    if (!appsData || appsData.length === 0) { setCandidatures([]); return; }
    const userIds = [...new Set(appsData.map((a) => a.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", userIds);
    const pseudoMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    const grouped: Record<string, Candidature> = {};
    appsData.forEach((a) => {
      if (!grouped[a.user_id]) grouped[a.user_id] = { user_id: a.user_id, pseudo: pseudoMap[a.user_id] ?? "—", messages: [] };
      grouped[a.user_id].messages.push({ id: a.id, content: a.content, from_owner: a.from_owner, created_at: a.created_at });
    });
    setCandidatures(Object.values(grouped));
  };

  const fetchAccessRequests = async () => {
    const { data: reqData } = await supabase
      .from("access_requests")
      .select("id, user_id, created_at")
      .eq("space_id", spaceId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (!reqData || reqData.length === 0) { setAccessRequests([]); return; }
    const userIds = reqData.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", userIds);
    const pseudoMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    setAccessRequests(reqData.map((r) => ({
      id: r.id, user_id: r.user_id, pseudo: pseudoMap[r.user_id] ?? "—", created_at: r.created_at,
    })));
  };

  const handleImpersonate = async (memberId: string, memberPseudo: string) => {
    if (impersonateLoading) return;
    setImpersonateLoading(memberId);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { setImpersonateLoading(null); return; }

    const res = await fetch("/api/superadmin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${sess.session.access_token}` },
      body: JSON.stringify({ userId: memberId }),
    });
    if (!res.ok) { setImpersonateLoading(null); return; }
    const { hashed_token } = await res.json();

    // Échange le token contre une session
    const { data: otpData, error } = await supabase.auth.verifyOtp({
      token_hash: hashed_token,
      type: "magiclink",
    });
    if (error || !otpData.session) { setImpersonateLoading(null); return; }

    // Sauvegarde la session du fondateur
    localStorage.setItem("sibyl_owner_session", JSON.stringify({
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
    }));
    localStorage.setItem("sibyl_impersonating", JSON.stringify({ pseudo: memberPseudo }));

    // La session est déjà définie par verifyOtp — rediriger
    window.location.href = "/feed";
  };

  const handleApproveRequest = async (requestId: string) => {
    setActionLoading(true);
    await supabase.rpc("approve_access_request", { p_request_id: requestId });
    setPendingCount((c) => Math.max(0, c - 1));
    await fetchAccessRequests();
    setActionLoading(false);
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(true);
    await supabase.rpc("reject_access_request", { p_request_id: requestId });
    setPendingCount((c) => Math.max(0, c - 1));
    await fetchAccessRequests();
    setActionLoading(false);
  };

  const handleReply = async (applicantId: string) => {
    if (!replyInput.trim() || replying) return;
    setReplying(true);
    await supabase.from("mod_applications").insert({
      space_id: spaceId, user_id: applicantId, content: replyInput.trim(), from_owner: true,
    });
    setReplyInput("");
    await fetchCandidatures();
    setReplying(false);
  };

  const filtered = members
    .filter((m) => m.pseudo.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => roleFilter === "all" || m.role === roleFilter)
    .sort((a, b) => {
      if (sortBy === "posts") return b.posts - a.posts;
      if (sortBy === "messages") return b.messages - a.messages;
      if (sortBy === "joined") return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
      const order = { admin: 0, moderator: 1, member: 2 };
      return (order[a.role as keyof typeof order] ?? 3) - (order[b.role as keyof typeof order] ?? 3);
    });

  const timeAgo = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
    return `il y a ${Math.floor(diff / 86400)} j`;
  };

  if (loading) return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif" }}>Chargement…</p>
    </div>
  );

  const sectionTabs: { key: Section; label: string; badge?: number }[] = [
    { key: "membres", label: "Membres" },
    { key: "analytics", label: "Analytics" },
    { key: "contenu", label: "Contenu" },
    { key: "invitations", label: "Invitations" },
    { key: "candidatures", label: "Candidatures" },
    { key: "demandes", label: "Demandes", badge: pendingCount > 0 ? pendingCount : undefined },
    { key: "espace", label: "Espace" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9884c" }}>
          ⬡ Centre de contrôle
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {[
          { label: "Membres", value: stats?.members ?? 0 },
          { label: "Publications", value: stats?.posts ?? 0 },
          { label: "Messages", value: stats?.messages ?? 0 },
          { label: "Réactions", value: stats?.reactions ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: "14px 20px", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{value}</div>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Sous-onglets */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {sectionTabs.map(({ key, label, badge }) => (
          <button key={key} onClick={() => setSection(key)} style={{
            flex: 1, padding: "10px 0", background: "transparent", border: "none",
            borderBottom: `2px solid ${section === key ? "#c9884c" : "transparent"}`,
            color: section === key ? "#c9884c" : "var(--muted)",
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer", transition: "all 0.15s", position: "relative",
          }}>
            {label}
            {badge !== undefined && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                minWidth: 14, height: 14, borderRadius: 7,
                background: "#c9884c", color: "#fff",
                fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
              }}>{badge > 9 ? "9+" : badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu section */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── MEMBRES ── */}
        {section === "membres" && (
          <>
            {inactiveMembers.length > 0 && (
              <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(201,76,76,0.05)", border: "1px solid rgba(201,76,76,0.2)", borderRadius: 6 }}>
                <span style={{ fontSize: 10, color: "#c94c4c", letterSpacing: "0.06em" }}>
                  {inactiveMembers.length} membre{inactiveMembers.length > 1 ? "s" : ""} inactif{inactiveMembers.length > 1 ? "s" : ""} — {inactiveMembers.map((m) => m.pseudo).join(", ")}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                style={{
                  flex: 1, minWidth: 140, padding: "8px 12px", boxSizing: "border-box",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 6, color: "var(--foreground)", fontSize: 12,
                  outline: "none", fontFamily: "inherit",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.5)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{
                padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--foreground)", fontSize: 11, outline: "none", cursor: "pointer",
              }}>
                <option value="all">Tous les rôles</option>
                <option value="admin">Admin</option>
                <option value="moderator">Modérateur</option>
                <option value="member">Membre</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={{
                padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--foreground)", fontSize: 11, outline: "none", cursor: "pointer",
              }}>
                <option value="role">Trier par rôle</option>
                <option value="posts">Trier par publications</option>
                <option value="messages">Trier par messages</option>
                <option value="joined">Trier par date</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((m) => {
                const ri = roleLabel[m.role] ?? roleLabel.member;
                const isSelected = selected?.user_id === m.user_id;
                const isSelf = m.user_id === userId;
                return (
                  <div key={m.user_id}>
                    <div onClick={() => setSelected(isSelected ? null : m)} style={{
                      background: isSelected ? "rgba(124,111,247,0.06)" : "var(--surface)",
                      border: `1px solid ${isSelected ? "rgba(124,111,247,0.3)" : "var(--border)"}`,
                      borderRadius: isSelected ? "6px 6px 0 0" : 6,
                      padding: "12px 16px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(124,111,247,0.1)", border: "1px solid rgba(124,111,247,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, color: "var(--accent)", fontWeight: 600,
                      }}>{m.pseudo[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{m.pseudo}</span>
                          {isSelf && <span style={{ fontSize: 9, color: "var(--muted)" }}>(vous)</span>}
                          <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: ri.color, border: `1px solid ${ri.color}`, borderRadius: 3, padding: "2px 7px", opacity: 0.85 }}>{ri.label}</span>
                          {m.posts === 0 && m.messages === 0 && <span style={{ fontSize: 8, color: "#c94c4c", opacity: 0.7 }}>inactif</span>}
                          {bans.has(m.user_id) && (
                            <span style={{ fontSize: 8, color: "#e05555", border: "1px solid rgba(224,85,85,0.5)", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              {bans.get(m.user_id)!.banned_until ? "Banni" : "Banni déf."}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                          {m.posts} publications · {m.messages} messages · {m.likes_received} likes · depuis {new Date(m.joined_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <span style={{ color: "var(--muted)", fontSize: 10 }}>{isSelected ? "▲" : "▼"}</span>
                    </div>
                    {isSelected && (
                      <div style={{ background: "rgba(124,111,247,0.03)", border: "1px solid rgba(124,111,247,0.3)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: 16 }}>
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Bio</div>
                          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: m.bio ? "var(--foreground)" : "var(--muted)", fontStyle: m.bio ? "normal" : "italic", fontFamily: m.bio ? "inherit" : "Georgia, serif" }}>
                            {m.bio || "Aucune bio."}
                          </p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                          {[{ label: "Publications", value: m.posts }, { label: "Messages", value: m.messages }, { label: "Likes reçus", value: m.likes_received }].map(({ label, value }) => (
                            <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 10, textAlign: "center" }}>
                              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{value}</div>
                              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{label}</div>
                            </div>
                          ))}
                        </div>
                        {!isSelf && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {ROLES.filter((r) => r !== m.role).map((r) => {
                              const ri2 = roleLabel[r];
                              return (
                                <button key={r} onClick={() => setConfirm({ type: "role", memberId: m.user_id, value: r })} style={{
                                  padding: "7px 14px", background: "transparent", border: `1px solid ${ri2.color}`, borderRadius: 4,
                                  color: ri2.color, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", opacity: 0.8,
                                }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                                >→ {ri2.label}</button>
                              );
                            })}
                            <button onClick={() => setConfirm({ type: "remove", memberId: m.user_id })} style={{
                              padding: "7px 14px", background: "transparent", border: "1px solid rgba(201,76,76,0.5)", borderRadius: 4,
                              color: "#c94c4c", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", opacity: 0.8, marginLeft: "auto",
                            }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                            >Retirer de l'espace</button>
                          </div>
                        )}
                        {!isSelf && isOwner && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              onClick={() => handleImpersonate(m.user_id, m.pseudo)}
                              disabled={!!impersonateLoading}
                              style={{
                                padding: "7px 14px", background: "rgba(201,136,76,0.08)",
                                border: "1px solid rgba(201,136,76,0.35)", borderRadius: 4,
                                color: "#c9884c", fontSize: 9, letterSpacing: "0.1em",
                                textTransform: "uppercase", cursor: impersonateLoading ? "wait" : "pointer",
                                opacity: impersonateLoading && impersonateLoading !== m.user_id ? 0.4 : 0.9,
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => { if (!impersonateLoading) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(201,136,76,0.15)"; } }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.background = "rgba(201,136,76,0.08)"; }}
                            >
                              {impersonateLoading === m.user_id ? "Connexion…" : "♔ Incarner"}
                            </button>
                            <span style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
                              Voir l&apos;espace en tant que {m.pseudo}
                            </span>
                          </div>
                        )}
                        {!isSelf && canBanMember(m) && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {bans.has(m.user_id) ? (
                              <>
                                <span style={{ fontSize: 11, color: "#c94c4c", flex: 1, minWidth: 0 }}>
                                  {bans.get(m.user_id)!.banned_until
                                    ? `Banni jusqu'au ${new Date(bans.get(m.user_id)!.banned_until!).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                                    : "Banni définitivement"}
                                </span>
                                <button onClick={() => setConfirm({ type: "unban", memberId: m.user_id, memberPseudo: m.pseudo, banId: bans.get(m.user_id)!.id })} style={{
                                  padding: "7px 14px", background: "transparent", border: "1px solid rgba(76,175,110,0.5)", borderRadius: 4,
                                  color: "#4caf6e", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                                }}>Lever le ban</button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Bannir :</span>
                                <select value={banDuration} onChange={(e) => setBanDuration(e.target.value)} style={{
                                  padding: "6px 10px", background: "var(--surface)", border: "1px solid rgba(201,76,76,0.4)",
                                  borderRadius: 4, color: "#c94c4c", fontSize: 11, outline: "none", cursor: "pointer",
                                }}>
                                  {availableDurations.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                  ))}
                                </select>
                                <button onClick={() => setConfirm({ type: "ban", memberId: m.user_id, memberPseudo: m.pseudo, duration: banDuration })} style={{
                                  padding: "7px 14px", background: "transparent", border: "1px solid rgba(201,76,76,0.5)", borderRadius: 4,
                                  color: "#c94c4c", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", opacity: 0.8,
                                }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                                >Bannir</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── ANALYTICS ── */}
        {section === "analytics" && (() => {
          const topMembers = [...members].sort((a, b) => (b.posts + b.messages) - (a.posts + a.messages)).slice(0, 5);
          const roleCounts = { admin: 0, moderator: 0, member: 0 };
          members.forEach((m) => { if (m.role in roleCounts) roleCounts[m.role as keyof typeof roleCounts]++; });
          const maxBar = Math.max(...analyticsData.map((d) => d.posts + d.messages), 1);
          const totalPosts30 = analyticsData.reduce((s, d) => s + d.posts, 0);
          const totalMsgs30 = analyticsData.reduce((s, d) => s + d.messages, 0);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

              {/* Résumé 30j */}
              <div>
                <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>30 derniers jours</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {[
                    { label: "Publications", value: totalPosts30, color: "var(--accent)" },
                    { label: "Messages", value: totalMsgs30, color: "var(--muted)" },
                    { label: "Total activité", value: totalPosts30 + totalMsgs30, color: "#c9884c" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>{value}</div>
                      <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Graphe d'activité */}
              <div>
                <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Activité quotidienne</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, padding: "0 2px" }}>
                  {analyticsData.map((d) => {
                    const total = d.posts + d.messages;
                    const h = maxBar > 0 ? Math.max(Math.round((total / maxBar) * 72), total > 0 ? 4 : 0) : 0;
                    const postH = total > 0 ? Math.round((d.posts / total) * h) : 0;
                    const msgH = h - postH;
                    return (
                      <div key={d.date} title={`${d.date.slice(5)}\n${d.posts} pub · ${d.messages} msg`}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 80, cursor: "default" }}>
                        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
                          <div style={{ width: "100%", height: postH, background: "var(--accent)", opacity: 0.7, borderRadius: "2px 2px 0 0" }} />
                          <div style={{ width: "100%", height: msgH, background: "var(--muted)", opacity: 0.4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{analyticsData[0]?.date.slice(5)}</span>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--accent)", opacity: 0.7, borderRadius: 1 }} /> Publications
                    </span>
                    <span style={{ fontSize: 9, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--muted)", opacity: 0.5, borderRadius: 1 }} /> Messages
                    </span>
                  </div>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{analyticsData[analyticsData.length - 1]?.date.slice(5)}</span>
                </div>
              </div>

              {/* Répartition rôles */}
              <div>
                <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Répartition des rôles</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(Object.entries(roleCounts) as [string, number][]).map(([role, count]) => {
                    const ri = roleLabel[role];
                    const pct = stats?.members ? Math.round((count / stats.members) * 100) : 0;
                    return (
                      <div key={role} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 9, color: ri.color, width: 72, letterSpacing: "0.08em", textTransform: "uppercase" }}>{ri.label}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: ri.color, opacity: 0.6, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--foreground)", width: 52, textAlign: "right" }}>{count} <span style={{ color: "var(--muted)" }}>({pct}%)</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top membres */}
              <div>
                <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Top 5 membres actifs</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {topMembers.map((m, i) => (
                    <div key={m.user_id} style={{
                      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
                      padding: "10px 16px", display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: 12, color: "var(--muted)", width: 16, textAlign: "center", fontFamily: "Georgia, serif" }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", flex: 1 }}>{m.pseudo}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.posts} publications</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.messages} messages</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>♥ {m.likes_received}</span>
                    </div>
                  ))}
                  {topMembers.length === 0 && (
                    <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif" }}>Aucune activité pour l'instant.</p>
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        {/* ── CONTENU ── */}
        {section === "contenu" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase" }}>Flux en temps réel</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4caf6e", display: "inline-block", boxShadow: "0 0 6px #4caf6e" }} />
            </div>
            {contentFeed.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", textAlign: "center", marginTop: 40 }}>Aucune activité récente.</p>
            )}
            {contentFeed.map((item, i) => {
              const typeConfig = {
                post:    { label: "Publication", color: "var(--accent)" },
                message: { label: "Message",     color: "var(--muted)" },
                join:    { label: "Inscription", color: "#4caf6e" },
              }[item.type];
              return (
                <div key={`${item.id}-${i}`} style={{
                  background: "var(--surface)",
                  border: `1px solid ${item.pinned ? "rgba(201,136,76,0.4)" : "var(--border)"}`,
                  borderRadius: 6, padding: "12px 16px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  {/* Ligne 1 : badge + pseudo + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: typeConfig.color, border: `1px solid ${typeConfig.color}`, borderRadius: 3, padding: "2px 7px", flexShrink: 0, opacity: 0.85 }}>
                      {typeConfig.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: item.type === "post" ? "var(--accent)" : "var(--foreground)" }}>{item.pseudo}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{timeAgo(item.created_at)}</span>
                    {item.pinned && <span style={{ fontSize: 8, color: "#c9884c", border: "1px solid rgba(201,136,76,0.5)", borderRadius: 3, padding: "2px 6px" }}>Épinglé</span>}
                    {item.type === "post" && <span style={{ fontSize: 10, color: "var(--muted)" }}>♥ {item.reactions}</span>}
                  </div>
                  {/* Ligne 2 : contenu */}
                  {item.content ? (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)", lineHeight: 1.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.content}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>a rejoint l'espace</p>
                  )}
                  {/* Ligne 3 : actions */}
                  {(item.type === "post" || item.type === "message") && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.type === "post" && (
                        <button onClick={() => setConfirm({ type: "pin", postId: item.id, pinned: !!item.pinned })} style={{
                          padding: "5px 10px", background: "transparent",
                          border: `1px solid ${item.pinned ? "rgba(201,136,76,0.5)" : "var(--border)"}`,
                          borderRadius: 4, color: item.pinned ? "#c9884c" : "var(--muted)",
                          fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                        }}>
                          {item.pinned ? "Désépingler" : "Épingler"}
                        </button>
                      )}
                      <button onClick={() => setConfirm(item.type === "post" ? { type: "delete-post", postId: item.id } : { type: "delete-message", messageId: item.id })} style={{
                        padding: "5px 10px", background: "transparent", border: "1px solid rgba(201,76,76,0.4)", borderRadius: 4,
                        color: "#c94c4c", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                      }}>Supprimer</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── INVITATIONS ── */}
        {section === "invitations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase" }}>Liens d'invitation</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Valides 7 jours · usage unique</div>
              </div>
              <button onClick={createInvitation} disabled={creatingInvite} style={{
                padding: "9px 18px", background: "rgba(201,136,76,0.12)", border: "1px solid #c9884c",
                borderRadius: 4, color: "#c9884c", fontSize: 10, letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: creatingInvite ? "not-allowed" : "pointer",
              }}>
                {creatingInvite ? "…" : "+ Générer"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {invitations.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", textAlign: "center", marginTop: 32 }}>
                  Aucune invitation générée.
                </p>
              )}
              {invitations.map((inv) => {
                const isExpired = inv.status === "expired" || new Date(inv.expires_at) < new Date();
                const statusColor = inv.status === "used" ? "#4caf6e" : isExpired ? "#c94c4c" : "#c9884c";
                const statusLabel = inv.status === "used" ? "Utilisée" : isExpired ? "Expirée" : "Active";
                return (
                  <div key={inv.id} style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <code style={{ fontSize: 13, letterSpacing: "0.15em", color: "var(--foreground)", fontFamily: "monospace", flex: 1 }}>
                      {inv.code}
                    </code>
                    <span style={{ fontSize: 9, color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 3, padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, flexShrink: 0 }}>
                      {statusLabel}
                    </span>
                    {inv.used_by_pseudo && (
                      <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>→ {inv.used_by_pseudo}</span>
                    )}
                    <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>
                      {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                    </span>
                    {inv.status === "pending" && !isExpired && (
                      <button onClick={() => setShareInvite(inv)} style={{
                        padding: "5px 12px", background: "transparent", border: "1px solid var(--border)",
                        borderRadius: 4, color: "var(--muted)", fontSize: 9, letterSpacing: "0.08em",
                        textTransform: "uppercase", cursor: "pointer", flexShrink: 0,
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c9884c")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      >Partager</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CANDIDATURES ── */}
        {section === "candidatures" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
            {candidatures.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", textAlign: "center", marginTop: 48 }}>
                Aucune candidature pour l'instant.
              </p>
            )}
            {candidatures.map((c) => {
              const isOpen = selectedCandidature === c.user_id;
              const lastMsg = c.messages[c.messages.length - 1];
              const hasUnreplied = lastMsg && !lastMsg.from_owner;
              return (
                <div key={c.user_id} style={{ marginBottom: 8 }}>
                  {/* En-tête candidat */}
                  <div
                    onClick={() => { setSelectedCandidature(isOpen ? null : c.user_id); setReplyInput(""); }}
                    style={{
                      background: isOpen ? "rgba(201,136,76,0.06)" : "var(--surface)",
                      border: `1px solid ${isOpen ? "rgba(201,136,76,0.3)" : "var(--border)"}`,
                      borderRadius: isOpen ? "6px 6px 0 0" : 6,
                      padding: "12px 16px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,136,76,0.1)", border: "1px solid rgba(201,136,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#c9884c", fontWeight: 600, flexShrink: 0 }}>
                      {c.pseudo[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.pseudo}</span>
                        <span style={{ fontSize: 9, color: "var(--muted)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 7px", letterSpacing: "0.06em", flexShrink: 0 }}>{spaceName}</span>
                        {hasUnreplied && <span style={{ fontSize: 8, background: "rgba(201,136,76,0.15)", color: "#c9884c", border: "1px solid rgba(201,136,76,0.4)", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em" }}>Nouveau</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                        {lastMsg?.content}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {/* Thread */}
                  {isOpen && (
                    <div style={{ border: "1px solid rgba(201,136,76,0.3)", borderTop: "none", borderRadius: "0 0 6px 6px", background: "rgba(201,136,76,0.02)" }}>
                      <div style={{ padding: "16px 16px 12px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                        {c.messages.map((msg) => (
                          <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.from_owner ? "flex-end" : "flex-start", gap: 3 }}>
                            <span style={{ fontSize: 9, color: msg.from_owner ? "#c9884c" : "var(--muted)", letterSpacing: "0.06em" }}>
                              {msg.from_owner ? "♔ Vous" : c.pseudo}
                            </span>
                            <div style={{
                              maxWidth: "80%",
                              background: msg.from_owner ? "rgba(201,136,76,0.12)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${msg.from_owner ? "rgba(201,136,76,0.35)" : "var(--border)"}`,
                              borderRadius: msg.from_owner ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                              padding: "8px 12px",
                            }}>
                              <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)", lineHeight: 1.6 }}>{msg.content}</p>
                            </div>
                            <span style={{ fontSize: 9, color: "var(--muted)" }}>
                              {new Date(msg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Répondre */}
                      <div style={{ padding: "0 16px 14px", display: "flex", gap: 8 }}>
                        <input
                          value={replyInput}
                          onChange={(e) => setReplyInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleReply(c.user_id); }}
                          placeholder="Répondre…"
                          style={{
                            flex: 1, padding: "8px 12px",
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,136,76,0.3)",
                            borderRadius: 4, color: "var(--foreground)", fontSize: 12,
                            outline: "none", fontFamily: "inherit",
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.6)")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.3)")}
                        />
                        <button onClick={() => handleReply(c.user_id)} disabled={!replyInput.trim() || replying} style={{
                          padding: "8px 14px", background: replyInput.trim() ? "rgba(201,136,76,0.15)" : "transparent",
                          border: `1px solid ${replyInput.trim() ? "rgba(201,136,76,0.5)" : "var(--border)"}`,
                          borderRadius: 4, color: replyInput.trim() ? "#c9884c" : "var(--muted)",
                          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                          cursor: replyInput.trim() ? "pointer" : "not-allowed",
                        }}>
                          {replying ? "…" : "Envoyer"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── DEMANDES D'ACCÈS ── */}
        {section === "demandes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Demandes d&apos;accès en attente
              </span>
              {pendingCount > 0 && (
                <span style={{ fontSize: 9, background: "rgba(201,136,76,0.15)", color: "#c9884c", border: "1px solid rgba(201,136,76,0.4)", borderRadius: 3, padding: "2px 7px" }}>
                  {pendingCount}
                </span>
              )}
            </div>
            {accessRequests.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", textAlign: "center", marginTop: 40 }}>
                Aucune demande en attente.
              </p>
            )}
            {accessRequests.map((req) => (
              <div key={req.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(201,136,76,0.1)", border: "1px solid rgba(201,136,76,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#c9884c", fontWeight: 600,
                }}>{req.pseudo[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{req.pseudo}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{timeAgo(req.created_at)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleApproveRequest(req.id)} disabled={actionLoading} style={{
                    padding: "7px 14px", background: "rgba(76,175,110,0.1)",
                    border: "1px solid rgba(76,175,110,0.4)", borderRadius: 4,
                    color: "#4caf6e", fontSize: 9, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: actionLoading ? "not-allowed" : "pointer",
                  }}>Approuver</button>
                  <button onClick={() => handleRejectRequest(req.id)} disabled={actionLoading} style={{
                    padding: "7px 14px", background: "rgba(201,76,76,0.08)",
                    border: "1px solid rgba(201,76,76,0.3)", borderRadius: 4,
                    color: "#c94c4c", fontSize: 9, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: actionLoading ? "not-allowed" : "pointer",
                  }}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ESPACE ── */}
        {section === "espace" && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Nom de l'espace">
                <input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Description">
                <textarea value={spaceDesc} onChange={(e) => setSpaceDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: "none" }} />
              </Field>
              <Field label="Sésame (code d'accès)">
                <input value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={10} style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.15em" }} />
                <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Actuel : <strong style={{ color: "var(--foreground)" }}>{spaceCode}</strong></span>
              </Field>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={handleSaveSpace} disabled={savingSpace} style={{
                  padding: "10px 24px", background: "rgba(201,136,76,0.15)", border: "1px solid #c9884c",
                  borderRadius: 4, color: "#c9884c", fontSize: 10, letterSpacing: "0.12em",
                  textTransform: "uppercase", cursor: savingSpace ? "not-allowed" : "pointer",
                }}>
                  {savingSpace ? "…" : "Sauvegarder"}
                </button>
                {spaceSuccess && <span style={{ fontSize: 11, color: "#4caf6e" }}>Enregistré.</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal partage invitation */}
      {shareInvite && (() => {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const link = `${base}/register?invite=${shareInvite.code}`;
        const msg = `Tu es invité(e) à rejoindre Sibyl — la communauté privée. Rejoins-nous ici : ${link}`;
        const canShare = typeof navigator !== "undefined" && !!navigator.share;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShareInvite(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "28px 32px", maxWidth: 400, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            }}>
              <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 }}>
                Partager l'invitation
              </div>

              {/* Code + lien */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Code</div>
                <code style={{ fontSize: 18, letterSpacing: "0.2em", color: "var(--foreground)", fontFamily: "monospace" }}>{shareInvite.code}</code>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em", marginTop: 8, wordBreak: "break-all" }}>{link}</div>
              </div>

              {/* Boutons de partage */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Web Share API (mobile) */}
                {canShare && (
                  <button onClick={() => navigator.share({ title: "Invitation Sibyl", text: msg, url: link })} style={shareBtn("#c9884c")}>
                    Partager…
                  </button>
                )}
                {/* Email */}
                <button onClick={() => window.open(`mailto:?subject=Invitation%20Sibyl&body=${encodeURIComponent(msg)}`)} style={shareBtn("var(--accent)")}>
                  Envoyer par e-mail
                </button>
                {/* WhatsApp */}
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`)} style={shareBtn("#25D366")}>
                  Envoyer sur WhatsApp
                </button>
                {/* SMS */}
                <button onClick={() => window.open(`sms:?body=${encodeURIComponent(msg)}`)} style={shareBtn("var(--muted)")}>
                  Envoyer par SMS
                </button>
                {/* Copier */}
                <button onClick={() => { navigator.clipboard.writeText(link); }} style={shareBtn("var(--foreground)")}>
                  Copier le lien
                </button>
              </div>

              <button onClick={() => setShareInvite(null)} style={{
                marginTop: 16, width: "100%", padding: "9px 0", background: "transparent",
                border: "1px solid var(--border)", borderRadius: 4, color: "var(--muted)",
                fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>Fermer</button>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmation */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            padding: "28px 32px", maxWidth: 360, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          }}>
            <p style={{ fontSize: 13, color: "var(--foreground)", marginBottom: 8, lineHeight: 1.6 }}>
              {confirm.type === "role" && `Changer le rôle en "${roleLabel[(confirm as { type: "role"; memberId: string; value: string }).value]?.label}" ?`}
              {confirm.type === "remove" && "Retirer ce membre de l'espace ?"}
              {confirm.type === "delete-post" && "Supprimer cette publication ?"}
              {confirm.type === "delete-message" && "Supprimer ce message ?"}
              {confirm.type === "pin" && ((confirm as { type: "pin"; postId: string; pinned: boolean }).pinned ? "Désépingler cette publication ?" : "Épingler cette publication ?")}
              {confirm.type === "ban" && `Bannir ${(confirm as { type: "ban"; memberPseudo: string; duration: string }).memberPseudo} ${banDurationLabel((confirm as { type: "ban"; memberPseudo: string; duration: string }).duration)} ?`}
              {confirm.type === "unban" && `Lever le bannissement de ${(confirm as { type: "unban"; memberPseudo: string; banId: string }).memberPseudo} ?`}
            </p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 20, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              {(confirm.type === "delete-post" || confirm.type === "delete-message") && "Cette action est irréversible."}
              {confirm.type === "remove" && "Cette action ne supprime pas le compte."}
              {confirm.type === "role" && "Le membre recevra les droits correspondants immédiatement."}
              {confirm.type === "pin" && "La publication apparaîtra en tête du feed."}
              {confirm.type === "ban" && (confirm as { type: "ban"; duration: string }).duration === "permanent" && "Cette action est irréversible sauf intervention d'un admin."}
              {confirm.type === "ban" && (confirm as { type: "ban"; duration: string }).duration !== "permanent" && "Le membre ne pourra plus publier ni envoyer de messages."}
              {confirm.type === "unban" && "Le membre pourra à nouveau participer."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(null)} style={{
                padding: "8px 18px", background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--muted)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>Annuler</button>
              <button disabled={actionLoading} onClick={() => {
                if (confirm.type === "role") handleRoleChange(confirm.memberId, confirm.value);
                if (confirm.type === "remove") handleRemove(confirm.memberId);
                if (confirm.type === "delete-post") handleDeletePost((confirm as { type: "delete-post"; postId: string }).postId);
                if (confirm.type === "delete-message") handleDeleteMessage((confirm as { type: "delete-message"; messageId: string }).messageId);
                if (confirm.type === "pin") handlePin((confirm as { type: "pin"; postId: string; pinned: boolean }).postId, (confirm as { type: "pin"; postId: string; pinned: boolean }).pinned);
                if (confirm.type === "ban") handleBan((confirm as { type: "ban"; memberId: string; duration: string }).memberId, (confirm as { type: "ban"; memberId: string; duration: string }).duration);
                if (confirm.type === "unban") handleUnban((confirm as { type: "unban"; banId: string }).banId);
              }} style={{
                padding: "8px 18px",
                background: confirm.type === "unban" ? "rgba(76,175,110,0.15)" : (confirm.type === "delete-post" || confirm.type === "delete-message" || confirm.type === "remove" || confirm.type === "ban") ? "rgba(201,76,76,0.15)" : "rgba(201,136,76,0.15)",
                border: `1px solid ${confirm.type === "unban" ? "#4caf6e" : (confirm.type === "delete-post" || confirm.type === "delete-message" || confirm.type === "remove" || confirm.type === "ban") ? "#c94c4c" : "#c9884c"}`,
                borderRadius: 4,
                color: confirm.type === "unban" ? "#4caf6e" : (confirm.type === "delete-post" || confirm.type === "delete-message" || confirm.type === "remove" || confirm.type === "ban") ? "#c94c4c" : "#c9884c",
                fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: actionLoading ? "not-allowed" : "pointer",
              }}>{actionLoading ? "…" : "Confirmer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shareBtn(color: string): React.CSSProperties {
  return {
    width: "100%", padding: "10px 16px", background: "transparent",
    border: `1px solid ${color}`, borderRadius: 4, color,
    fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
    textAlign: "left" as const, opacity: 0.85, transition: "opacity 0.15s",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)" }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", boxSizing: "border-box",
  background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
  borderRadius: 4, color: "var(--foreground)", fontSize: 13,
  outline: "none", fontFamily: "inherit", transition: "border-color 0.2s",
};
