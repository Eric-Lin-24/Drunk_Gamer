const BASE = {
  chaos: { label: "CHAOS", color: "var(--pink)" },
  dare: { label: "DARE", color: "var(--amber)" },
  truth: { label: "TRUTH", color: "var(--cyan)" },
  opinion: { label: "OPINION", color: "var(--violet)" },
  power: { label: "POWER", color: "var(--lime)" },
};

const RULE = /^(person|group)_round_based:(\d+)$/;

export function categoryInfo(category) {
  const rule = RULE.exec(category || "");
  if (rule) return { label: `RULE · ${rule[2]}R`, color: "var(--orange)", isRule: true };
  const base = BASE[category];
  if (base) return { ...base, isRule: false };
  return { label: "CARD", color: "var(--dim)", isRule: false };
}

const AVATAR_COLORS = ["var(--pink)", "var(--cyan)", "var(--amber)", "var(--violet)", "var(--lime)", "var(--orange)"];

export function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}
