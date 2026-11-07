import { ArrowDown, ArrowUp, CircleAlert } from "lucide-react";
import Link from "next/link";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { closeDate, isOpen, type Wave } from "@/lib/invites";
import { db } from "@/lib/supabase";
import {
  PLANS, segment, summarize,
  type Category, type CsatStat, type PlanKey, type Segment, type WavePlanStat,
} from "@/lib/survey";
import { cn } from "@/lib/utils";
import { markFollowedUp } from "../actions";
import { Composition, NpsTrend, SEGMENT_COLORS, WavePicker } from "./charts";

const CSAT_TARGET = 80; // % de satisfechos (4–5) que ONE considera "bien"; centro del mapa de calor

type Comment = {
  invitation_id: string;
  nps: number;
  comment: string | null;
  contact_ok: boolean;
  followed_up_at: string | null;
  created_at: string;
  invitations: { wave_id: number; plan: PlanKey | null; clients: { full_name: string; email: string | null; phone: string | null } };
};

const SEGMENTS = { todos: "Todos", pendientes: "Por contactar", detractor: "Detractores", pasivo: "Pasivos", promotor: "Promotores" } as const;
const SEG_LABEL: Record<Segment, string> = { detractor: "Detractor", pasivo: "Pasivo", promotor: "Promotor" };
const SEG_COLOR: Record<Segment, string> = { detractor: SEGMENT_COLORS.detractores, pasivo: SEGMENT_COLORS.pasivos, promotor: SEGMENT_COLORS.promotores };

const day = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });
const pending = (c: Comment) => c.nps <= 6 && c.contact_ok && !c.followed_up_at;

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const plan = typeof sp.plan === "string" && sp.plan in PLANS ? (sp.plan as PlanKey) : undefined;
  const seg = typeof sp.seg === "string" && sp.seg in SEGMENTS ? (sp.seg as keyof typeof SEGMENTS) : "todos";

  const sb = db();
  const [stats, csat, waves, comments, categories] = await Promise.all([
    sb.from("wave_plan_stats").select("*").returns<WavePlanStat[]>(),
    sb.from("csat_stats").select("*").returns<CsatStat[]>(),
    sb.from("waves").select("id, opens_at, closes_at").order("id").returns<Wave[]>(),
    sb.from("responses")
      .select("invitation_id, nps, comment, contact_ok, followed_up_at, created_at, invitations!inner(wave_id, plan, clients(full_name, email, phone))")
      .or("comment.not.is.null,and(nps.lte.6,contact_ok.is.true)")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Comment[]>(),
    sb.from("csat_categories").select("key, label").order("position").returns<Category[]>(),
  ]);

  const summary = summarize(stats.data ?? [], csat.data ?? [], plan);
  const allWaves = waves.data ?? [];
  if (!summary.length || !allWaves.length) return <Empty />;

  const cur = summary.find((w) => w.wave === Number(sp.ola)) ?? summary.at(-1)!;
  const prev = summary[summary.indexOf(cur) - 1];
  const wave = allWaves.find((w) => w.id === cur.wave)!;
  const byPlan = (comments.data ?? []).filter((c) => !plan || c.invitations.plan === plan);
  const toContact = byPlan.filter(pending);
  const list = seg === "pendientes"
    ? toContact
    : byPlan.filter((c) => c.invitations.wave_id === cur.wave && (seg === "todos" || segment(c.nps) === seg));

  const href = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ ola: String(cur.wave), plan, seg, ...next }).forEach(([k, v]) => v && v !== "todos" && p.set(k, v));
    return `?${p}`;
  };
  const items = (categories.data ?? []).map((i) => ({ ...i, now: cur.items[i.key], before: prev?.items[i.key] }))
    .filter((i) => i.now)
    .sort((a, b) => a.now!.top2 - b.now!.top2);
  const recent = summary.slice(-8);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-brand">Experiencia de clientes</p>
          <h1 className="text-display !text-4xl">Ola {cur.wave}</h1>
          <p className="text-sm text-muted-foreground">
            {day(wave.opens_at)} – {day(wave.closes_at)}
            {isOpen(wave) && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-brand">En curso · cierra el {closeDate(wave.closes_at)}</span>}
          </p>
        </div>
        <WavePicker value={cur.wave} waves={[...allWaves].reverse().map((w) => ({ id: w.id, label: `Ola ${w.id} · ${day(w.opens_at)}` }))} />
      </header>

      <nav aria-label="Filtrar por plan" className="-mt-2 flex flex-wrap gap-2">
        {[undefined, ...Object.keys(PLANS)].map((p) => (
          <Chip key={p ?? "todos"} href={href({ plan: p })} active={plan === p}>
            {p ? PLANS[p as PlanKey] : "Todos los planes"}
          </Chip>
        ))}
      </nav>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="NPS" value={cur.nps} delta={diff(cur.nps, prev?.nps)} prev={prev?.wave} hint={`${cur.responded} respuestas · media 2 olas ${cur.npsRolling ?? "—"}`} />
        <Kpi label="CSAT global" value={cur.csat} unit="%" delta={diff(cur.csat, prev?.csat)} prev={prev?.wave} hint="% satisfechos (4–5), promedio de categorías" />
        <Kpi label="Tasa de respuesta" value={cur.responseRate} unit="%" delta={diff(cur.responseRate, prev?.responseRate)} prev={prev?.wave} hint={`${cur.responded} de ${cur.invited} clientes`} />
        <Link href={href({ seg: "pendientes" })} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ring/60 sm:p-5">
          <p className="text-sm text-muted-foreground">Por contactar</p>
          <p className="mt-2 flex items-center gap-2 text-4xl font-semibold">
            <AnimatedNumber value={toContact.length} />
            {toContact.length > 0 && <CircleAlert className="size-6 text-destructive" aria-label="requiere acción" />}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Detractores que aceptaron contacto, todas las olas</p>
        </Link>
      </section>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel title="NPS por ola" className="lg:col-span-3">
          <NpsTrend data={summary} />
        </Panel>
        <Panel title="Promotores, pasivos y detractores" className="lg:col-span-2">
          <Composition data={recent} />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel title={`CSAT por categoría · Ola ${cur.wave}`} subtitle="% satisfechos (4–5), de peor a mejor" className="lg:col-span-2">
          {items.length ? (
            <ul className="flex flex-col gap-4">
              {items.map((i) => (
                <li key={i.key} className="grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-3 text-sm">
                  <span className="truncate" title={i.label}>{i.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${i.now!.top2}%` }} />
                  </span>
                  <span className="flex items-center justify-end gap-2 tabular-nums">
                    {i.now!.top2}%
                    <Delta value={diff(i.now!.top2, i.before?.top2)} compact />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay notas por categoría en esta ola.</p>
          )}
        </Panel>

        <Panel title="Mapa de calor por ola" subtitle={`% satisfechos. Azul: sobre la meta de ${CSAT_TARGET} %. Rojo: bajo la meta.`} className="lg:col-span-3">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-normal text-muted-foreground" scope="col">Categoría</th>
                  {recent.map((w) => (
                    <th key={w.wave} scope="col" className={cn("px-1 font-normal text-muted-foreground", w.wave === cur.wave && "text-foreground")}>
                      Ola {w.wave}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(categories.data ?? []).map((i) => (
                  <tr key={i.key}>
                    <th scope="row" className="pr-2 text-left font-normal whitespace-nowrap">{i.label}</th>
                    {recent.map((w) => {
                      const v = w.items[i.key]?.top2;
                      return (
                        <td key={w.wave} className="h-9 min-w-12 rounded-md text-center tabular-nums" style={{ background: heat(v) }}>
                          {v ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="comentarios">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="comentarios" className="text-xl font-semibold font-sans">
            {seg === "pendientes" ? "Por contactar" : `Comentarios · Ola ${cur.wave}`}
          </h2>
          <nav aria-label="Filtrar comentarios" className="flex flex-wrap gap-2">
            {Object.entries(SEGMENTS).map(([k, v]) => (
              <Chip key={k} href={href({ seg: k })} active={seg === k}>
                {v}
              </Chip>
            ))}
          </nav>
        </div>
        {list.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((c) => (
              <CommentCard key={c.invitation_id} c={c} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {seg === "pendientes" ? "No hay detractores pendientes de contacto." : "No hay comentarios con este filtro."}
          </p>
        )}
      </section>
    </div>
  );
}

const diff = (a: number | null, b: number | null | undefined) => (a === null || b === null || b === undefined ? null : a - b);

// Divergente alrededor de la meta: rojo bajo, azul sobre; la intensidad crece con la distancia.
function heat(v: number | undefined) {
  if (v === undefined) return "transparent";
  const d = v - CSAT_TARGET;
  const color = d >= 0 ? SEGMENT_COLORS.promotores : SEGMENT_COLORS.detractores;
  const strength = Math.round(12 + Math.min(1, Math.abs(d) / (d >= 0 ? 20 : 40)) * 48);
  return `color-mix(in oklab, ${color} ${strength}%, transparent)`;
}

function Kpi({ label, value, unit, delta, prev, hint }: { label: string; value: number | null; unit?: string; delta: number | null; prev?: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-semibold">
        {value === null ? "—" : <AnimatedNumber value={value} />}
        {value !== null && unit && <span className="text-2xl text-muted-foreground">{unit}</span>}
      </p>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        {prev && <Delta value={delta} suffix={` vs Ola ${prev}`} />}
        <span className="text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

function Delta({ value, suffix = "", compact }: { value: number | null; suffix?: string; compact?: boolean }) {
  if (value === null) return compact ? null : <span className="text-muted-foreground">Sin comparación</span>;
  if (value === 0) return <span className="text-muted-foreground">{compact ? "=" : `Sin cambio${suffix}`}</span>;
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-destructive")}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{up ? "sube" : "baja"}</span>
      {Math.abs(value)}
      {compact ? "" : ` pts${suffix}`}
    </span>
  );
}

function Panel({ title, subtitle, className, children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div>
        <h2 className="text-base font-semibold font-sans">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function CommentCard({ c }: { c: Comment }) {
  const s = segment(c.nps);
  const who = c.invitations.clients;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="size-2 rounded-full" style={{ background: SEG_COLOR[s] }} aria-hidden />
          {SEG_LABEL[s]} · {c.nps}/10
        </span>
        <span className="text-muted-foreground">
          {c.invitations.plan ? PLANS[c.invitations.plan] : "Sin plan"} · Ola {c.invitations.wave_id} · {day(c.created_at)}
        </span>
      </div>
      {c.comment && <p className="text-pretty">“{c.comment}”</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
        {c.contact_ok ? (
          <span>
            {who.full_name}
            {who.phone && (
              <a href={`https://wa.me/${who.phone}`} className="ml-2 text-brand underline-offset-4 hover:underline">
                WhatsApp
              </a>
            )}
            {who.email && (
              <a href={`mailto:${who.email}`} className="ml-2 text-brand underline-offset-4 hover:underline">
                Email
              </a>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Cliente confidencial</span>
        )}
        {pending(c) && (
          <form action={markFollowedUp.bind(null, c.invitation_id)}>
            <Button size="sm" variant="secondary">Marcar como contactado</Button>
          </form>
        )}
        {c.followed_up_at && <span className="text-muted-foreground">Contactado el {day(c.followed_up_at)}</span>}
      </div>
    </li>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
      <h1 className="text-2xl font-semibold font-sans">Aún no hay olas</h1>
      <p className="max-w-md text-pretty text-muted-foreground">
        Importa tus clientes y abre la primera ola. Desde ahí, se abre una nueva automáticamente cada 14 días.
      </p>
      <Link href="/admin/clientes" className="text-brand underline-offset-4 hover:underline">
        Ir a Clientes y olas
      </Link>
    </div>
  );
}
