// Preguntas, planes e indicadores. Lo usan la encuesta, el dashboard y supabase/db.test.mts.

export const NPS_QUESTION =
  "Del 0 al 10, ¿qué tan probable es que recomiendes ONE a un amigo o familiar?";

// Las categorías CSAT y sus preguntas viven en la base (csat_categories, questions).
export type Category = { key: string; label: string };
export const QUESTIONS_PER_CATEGORY = { min: 5, max: 7 };

export const CSAT_SCALE = ["Muy insatisfecho", "Insatisfecho", "Neutral", "Satisfecho", "Muy satisfecho"];

export const PLANS = {
  personal: "Personal",
  duo: "Duo",
  plan3: "Plan 3",
  plan4: "Plan 4",
  plan6: "Plan 6",
  pase: "Pase diario",
} as const;
export type PlanKey = keyof typeof PLANS;

export type Segment = "promotor" | "pasivo" | "detractor";
export const segment = (nps: number): Segment =>
  nps >= 9 ? "promotor" : nps >= 7 ? "pasivo" : "detractor";

export function commentPrompt(nps: number) {
  if (nps >= 9) return "¿Qué es lo que más valoras de ONE?";
  if (nps >= 7) return "¿Qué nos faltó para que fuera un 10?";
  return "¿Qué deberíamos mejorar primero?";
}

// Filas de las vistas wave_plan_stats y csat_stats.
export type WavePlanStat = {
  wave_id: number;
  plan: string | null;
  invited: number;
  responded: number;
  promoters: number;
  detractors: number;
};
export type CsatStat = {
  wave_id: number;
  plan: string | null;
  item: string;
  n: number;
  top2: number;
  score_sum: number;
};

export type WaveSummary = {
  wave: number;
  invited: number;
  responded: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number | null; // −100 a 100
  npsRolling: number | null; // NPS de esta ola y la anterior juntas
  responseRate: number | null; // %
  csat: number | null; // promedio del top-2-box de las categorías, %
  items: Record<string, { n: number; top2: number; avg: number }>; // por categoría; top2 en %, avg 1–5
};

const pct = (part: number, total: number) => (total ? Math.round((100 * part) / total) : null);

// Suma los conteos por ola (todos los planes, o solo `plan`) y calcula los indicadores.
export function summarize(stats: WavePlanStat[], csat: CsatStat[], plan?: string): WaveSummary[] {
  const waves = new Map<number, WaveSummary>();
  const wave = (id: number) => {
    if (!waves.has(id))
      waves.set(id, {
        wave: id, invited: 0, responded: 0, promoters: 0, passives: 0, detractors: 0,
        nps: null, npsRolling: null, responseRate: null, csat: null, items: {},
      });
    return waves.get(id)!;
  };

  for (const s of stats) {
    if (plan && s.plan !== plan) continue;
    const w = wave(s.wave_id);
    w.invited += s.invited;
    w.responded += s.responded;
    w.promoters += s.promoters;
    w.detractors += s.detractors;
  }

  const itemSums = new Map<string, { n: number; top2: number; sum: number }>();
  for (const c of csat) {
    if (plan && c.plan !== plan) continue;
    const k = `${c.wave_id}:${c.item}`;
    const acc = itemSums.get(k) ?? { n: 0, top2: 0, sum: 0 };
    itemSums.set(k, { n: acc.n + c.n, top2: acc.top2 + c.top2, sum: acc.sum + c.score_sum });
  }
  for (const [k, { n, top2, sum }] of itemSums) {
    const [id, item] = k.split(":");
    wave(Number(id)).items[item] ={ n, top2: pct(top2, n)!, avg: Math.round((sum / n) * 10) / 10 };
  }

  const list = [...waves.values()].sort((a, b) => a.wave - b.wave);
  list.forEach((w, i) => {
    w.passives = w.responded - w.promoters - w.detractors;
    w.nps = pct(w.promoters - w.detractors, w.responded);
    w.responseRate = pct(w.responded, w.invited);
    const tops = Object.values(w.items).map((x) => x.top2);
    w.csat = tops.length ? Math.round(tops.reduce((a, b) => a + b, 0) / tops.length) : null;
    const prev = list[i - 1];
    w.npsRolling = prev
      ? pct(w.promoters + prev.promoters - w.detractors - prev.detractors, w.responded + prev.responded)
      : w.nps;
  });
  return list;
}

// Junta varias olas en un solo resumen: suma los conteos (no promedia porcentajes).
export function pool(stats: WavePlanStat[], csat: CsatStat[], waves: number[], plan?: string): WaveSummary | null {
  const keep = new Set(waves);
  const one = <T extends { wave_id: number }>(rows: T[]) => rows.filter((r) => keep.has(r.wave_id)).map((r) => ({ ...r, wave_id: 0 }));
  return summarize(one(stats), one(csat), plan)[0] ?? null;
}

export const PERIODS = { ola: "Ola", olas: "Varias olas", "1m": "1 mes", "3m": "3 meses", "6m": "6 meses", "12m": "1 año", total: "Total" };
export type PeriodKey = keyof typeof PERIODS;
export type Period = { key: PeriodKey; ola?: number; desde?: number; hasta?: number };

// Olas del período y las del período anterior de igual largo (para los Δ). `waves` va ordenado por id.
export function periodWaves(p: Period, waves: { id: number; opens_at: string }[], now = new Date()) {
  const ids = waves.map((w) => w.id);
  const last = ids.length - 1;
  if (p.key === "ola") {
    const found = ids.indexOf(p.ola ?? -1);
    const i = found >= 0 ? found : last;
    return { current: [ids[i]], previous: ids.slice(Math.max(0, i - 1), i) };
  }
  if (p.key === "olas") {
    const pick = (v: number | undefined, fallback: number) => (v !== undefined && ids.includes(v) ? v : fallback);
    let from = pick(p.desde, ids[Math.max(0, last - 3)]);
    let to = pick(p.hasta, ids[last]);
    if (from > to) [from, to] = [to, from];
    const current = ids.filter((id) => id >= from && id <= to);
    const before = ids.filter((id) => id < from);
    return { current, previous: before.slice(Math.max(0, before.length - current.length)) };
  }
  if (p.key === "total") return { current: ids, previous: [] };
  const months = Number(p.key.slice(0, -1));
  const ago = (n: number) => new Date(new Date(now).setMonth(now.getMonth() - n)).getTime();
  const at = (w: { opens_at: string }) => Date.parse(w.opens_at);
  return {
    current: waves.filter((w) => at(w) >= ago(months)).map((w) => w.id),
    previous: waves.filter((w) => at(w) >= ago(2 * months) && at(w) < ago(months)).map((w) => w.id),
  };
}

export const isEmail =(s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export type ClientRow ={ full_name: string; email: string | null; phone: string | null; plan: PlanKey | null };

const PLAN_ALIASES: Record<string, PlanKey> = {
  personal: "personal", duo: "duo", "3": "plan3", plan3: "plan3", "4": "plan4", plan4: "plan4",
  "6": "plan6", plan6: "plan6", pase: "pase", pasediario: "pase",
};

// CSV pegado desde Excel/Sheets: nombre, email, teléfono, plan. Acepta "," ";" o tab y una fila de encabezado.
// ponytail: no soporta comillas con separadores dentro; basta para un padrón de nombres y contactos.
export function parseClients(text: string) {
  const rows: ClientRow[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const [name = "", rawEmail = "", rawPhone = "", rawPlan = ""] = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /^nombre/i.test(name)) return;
    if (!name) return errors.push(`Línea ${i + 1}: falta el nombre`);
    const email = rawEmail.toLowerCase() || null;
    if (email && !isEmail(email)) return errors.push(`Línea ${i + 1}: email inválido (${rawEmail})`);
    let phone = rawPhone.replace(/\D/g, "");
    if (phone.length === 8) phone = "569" + phone; // celular sin +56 9
    if (phone.length === 9 && phone.startsWith("9")) phone = "56" + phone;
    const planKey = rawPlan.normalize("NFD").replace(/[̀-ͯ\s]/g, "").toLowerCase();
    rows.push({ full_name: name, email, phone: phone || null, plan: PLAN_ALIASES[planKey] ?? null });
  });
  return { rows, errors };
}
