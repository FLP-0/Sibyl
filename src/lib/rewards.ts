import { supabase } from "@/lib/supabase";

export const XP_LABELS: Record<string, string> = {
  post_created:      "Publication",
  reply_created:     "Réponse",
  message_sent:      "Message",
  reaction_received: "Réaction reçue",
  daily_login:       "Connexion du jour",
};

export const BADGE_NAMES: Record<string, string> = {
  premier_souffle: "Premier Souffle",
  echo:            "Écho",
  orateur:         "Orateur",
  premier_mot:     "Premier Mot",
  bavard:          "Bavard",
  repondant:       "Répondant",
  dialoguiste:     "Dialoguiste",
  resonance:       "Résonance",
  magnetisme:      "Magnétisme",
  eveille:         "Éveillé",
  adepte:          "Adepte",
  oracle:          "Oracle",
  // Badges cachés (noms révélés uniquement si débloqués)
  nuit_blanche:    "Nuit Blanche",
  marathon:        "Marathon",
  inspirateur:     "Inspirateur",
  echo_parfait:    "Écho Parfait",
  verbe_rare:      "Verbe Rare",
  fantome:         "Fantôme",
};

export type XpResult = {
  amount: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  newBadges: string[];
  skipped?: boolean;
};

export async function awardXP(
  action: string,
  options?: {
    spaceId?: string;
    targetUserId?: string;
    postId?: string;
    contentLength?: number;
  }
): Promise<XpResult | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch("/api/rewards/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...options }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
