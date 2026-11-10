import { ArrowDown, ArrowUp, ArrowRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import { requireAdmin } from "@/lib/auth";
import type { Wave } from "@/lib/invites";
import { db } from "@/lib/supabase";
import { CONTACT_SLA_HOURS, hoursAgo, pool, segment, summarize, themesOf, type Category, type CsatStat, type WavePlanStat } from "@/lib/survey";
import { cn } from "@/lib/utils";
import { Composition, NpsTrend, SEGMENT_COLORS } from "./charts";
import { SEG_COLOR, SEG_LABEL } from "./comentarios/card";
import { Panel, PeriodFilter, PeriodRange, readFilters } from "./ui";

const CSAT_TARGET = 80; // % de satisfechos (4–5) que ONE considera "bien"; centro del mapa de calor

type Comment = { invitation_id: string; nps: number; comment: string; created_at: string; invitations: { wave_id: number } };

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const sb = db();
  // Casos del close the loop sin contactar (todas las olas): aceptaron contacto y son detractores o marcados.
  const openCases = () =>
    sb.from("responses").select("invitation_id", { count: "exact", head: true })
      .eq("contact_ok", true).or("nps.lte.6,flagged.is.true").is("followed_up_at", null).is("closed_at", null);
  const [stats, csat, waves, categories, toContact, overdue] = await Promise.all([
    sb.from("wave_plan_stats").select("*").returns<WavePlanStat[]>(),
    sb.from("csat_stats").select("*").returns<CsatStat[]>(),
    sb.from("waves").select("id, opens_at, closes_at").order("id").returns<Wave[]>(),
    sb.from("csat_categories").select("key, label").order("position").returns<Category[]>(),
    openCases(),
    openCases().lt("created_at", hoursAgo(CONTACT_SLA_HOURS)),
  ]);

  const allWaves = waves.data ?? [];
  const f = readFilters(sp, allWaves);
  const { plan, period, current, previous, title, vs } = f;
  const summary = summarize(stats.data ?? [], csat.data ?? [], plan);
  if (!summary.length || !allWaves.length) return <Empty />;

  let commentsQuery = sb.from("responses").select("invitation_id, nps, comment, created_at, invitations!inner(wave_id)")
    .not("comment", "is", null).in("invitations.wave_id", current);
  if (plan) commentsQuery = commentsQuery.eq("invitations.plan", plan);
  const comments = (await commentsQuery.order("created_at", { ascending: false }).limit(1000).returns<Comment[]>()).data ?? [];

  const cur = pool(stats.data ?? [], csat.data ?? [], current, plan);
  const prev = pool(stats.data ?? [], csat.data ?? [], previous, plan);
  // Una ola: se ve en contexto con las 7 anteriores. Un período: sus olas.
  const chart = period === "ola" ? summary.filter((w) => w.wave <= current[0]).slice(-8) : summary.filter((w) => current.includes(w.wave));
  const labels = Object.fromEntries((categories.data ?? []).map((c) => [c.key, c.label]));
  const pending = toContact.count ?? 0;
  const late = overdue.count ?? 0;
  const items = (categories.data ?? []).map((i) => ({ ...i, now: cur?.items[i.key], before: prev?.items[i.key] }))
    .filter((i) => i.now)
    .sort((a, b) => a.now!.top2 - b.now!.top2);
  const rolling = summary.find((w) => w.wave === current[0])?.npsRolling;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-eyebrow text-brand">Experiencia de clientes</p>
        <h1 className="text-display !text-4xl">{title}</h1>
        <PeriodRange f={f} waves={allWaves} />
      </header>

      <div className="-mt-2">
        <PeriodFilter f={f} waves={allWaves} />
      </div>

      {!cur ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay datos para este período y plan. Prueba con otro.
        </p>
      ) : (
        <>
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="NPS"
              value={cur.nps}
              delta={diff(cur.nps, prev?.nps)}
              vs={vs}
              hint={current.length === 1 ? `${cur.responded} respuestas · media 2 olas ${rolling ?? "—"}` : `${cur.responded} respuestas en ${current.length} olas`}
            />
            <Kpi label="CSAT global" value={cur.csat} unit="%" delta={diff(cur.csat, prev?.csat)} vs={vs} hint="% satisfechos (4–5), promedio de categorías" />
            <Kpi label="Tasa de respuesta" value={cur.responseRate} unit="%" delta={diff(cur.responseRate, prev?.responseRate)} vs={vs} hint={`${cur.responded} de ${cur.invited} invitaciones`} />
            <Link href="/admin/comentarios?vista=seguimiento" className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ring/60 sm:p-5">
              <p className="text-sm text-muted-foreground">Por contactar</p>
              <p className="mt-2 flex items-center gap-2 text-4xl font-semibold">
                <AnimatedNumber value={pending} />
                {pending > 0 && <CircleAlert className="size-6 text-destructive" aria-label="requiere acción" />}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {late ? <span className="text-destructive">{late} atrasados (más de {CONTACT_SLA_HOURS} h). </span> : null}
                Close the loop, todas las olas →
              </p>
            </Link>
          </section>

          <div className="grid gap-3 lg:grid-cols-5">
            <Panel title="NPS por ola" className="lg:col-span-3">
              <NpsTrend data={chart} />
            </Panel>
            <Panel title="Promotores, pasivos y detractores" className="lg:col-span-2">
              <Composition data={chart} />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <Panel
              title={`CSAT por categoría · ${title}`}
              subtitle={`% satisfechos (4–5), de peor a mejor${vs ? `. Cambio ${vs}` : ""}`}
              className="lg:col-span-2"
            >
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
                <p className="text-sm text-muted-foreground">Aún no hay notas por categoría en este período.</p>
              )}
            </Panel>

            <Panel title="Mapa de calor por ola" subtitle={`% satisfechos. Azul: sobre la meta de ${CSAT_TARGET} %. Rojo: bajo la meta.`} className="lg:col-span-3">
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th className="text-left font-normal text-muted-foreground" scope="col">Categoría</th>
                      {chart.map((w) => (
                        <th
                          key={w.wave}
                          scope="col"
                          className={cn("px-1 font-normal whitespace-nowrap text-muted-foreground", period === "ola" && w.wave === current[0] && "text-foreground")}
                        >
                          Ola {w.wave}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(categories.data ?? []).map((i) => (
                      <tr key={i.key}>
                        <th scope="row" className="pr-2 text-left font-normal whitespace-nowrap">{i.label}</th>
                        {chart.map((w) => {
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
        </>
      )}

      {cur && <CommentsSummary comments={comments} labels={labels} responded={cur.responded} title={title} href={f.href({}, "/admin/comentarios")} />}
    </div>
  );
}

// Resumen para el dashboard: los temas más mencionados y los últimos comentarios. El análisis completo está en Comentarios.
function CommentsSummary({ comments, labels, responded, title, href }: { comments: Comment[]; labels: Record<string, string>; responded: number; title: string; href: string }) {
  const tagged = comments.map((c) => ({ c, themes: themesOf(c.comment) }));
  const top = Object.keys(labels)
    .map((k) => {
      const hits = tagged.filter((t) => t.themes.includes(k));
      return { key: k, total: hits.length, detractors: hits.filter((t) => segment(t.c.nps) === "detractor").length };
    })
    .filter((t) => t.total)
    .sort((a, b) => b.detractors - a.detractors || b.total - a.total)
    .slice(0, 3);
  return (
    <Panel
      title={`Lo que dicen los clientes · ${title}`}
      subtitle={`${comments.length} comentarios de ${responded} respuestas`}
    >
      {comments.length ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm text-muted-foreground">Temas con más menciones de detractores</h3>
            <ol className="flex flex-col gap-2 text-sm">
              {top.map((t) => (
                <li key={t.key} className="flex items-baseline justify-between gap-3">
                  <span>{labels[t.key]}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t.total} menciones · <span className={cn(t.detractors > 0 && "text-destructive")}>{t.detractors} de detractores</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm text-muted-foreground">Últimos comentarios</h3>
            <ul className="flex flex-col divide-y divide-border">
              {comments.slice(0, 3).map((c) => {
                const s = segment(c.nps);
                return (
                  <li key={c.invitation_id} className="flex items-start gap-3 py-2 text-sm">
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground" title={SEG_LABEL[s]}>
                      <span className="size-2 rounded-full" style={{ background: SEG_COLOR[s] }} aria-hidden />
                      <span className="sr-only">{SEG_LABEL[s]}</span>
                      {c.nps}
                    </span>
                    <p className="line-clamp-2 text-pretty">“{c.comment}”</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay comentarios en este período.</p>
      )}
      <Link href={href} className="inline-flex items-center gap-1.5 self-start text-sm text-brand underline-offset-4 hover:underline">
        Ver todos los comentarios y su análisis <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Panel>
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

function Kpi({ label, value, unit, delta, vs, hint }: { label: string; value: number | null; unit?: string; delta: number | null; vs?: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-semibold">
        {value === null ? "—" : <AnimatedNumber value={value} />}
        {value !== null && unit && <span className="text-2xl text-muted-foreground">{unit}</span>}
      </p>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        {vs && <Delta value={delta} suffix={` ${vs}`} />}
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
