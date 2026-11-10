import { Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Wave } from "@/lib/invites";
import { db } from "@/lib/supabase";
import {
  CONTACT_SLA_HOURS, caseStatus, hoursSince, isOverdue, plain, pool, segment, themesOf,
  type Category, type CsatStat, type Segment, type WavePlanStat,
} from "@/lib/survey";
import { cn } from "@/lib/utils";
import { Chip, Panel, PeriodFilter, PeriodRange, readFilters, type Filters } from "../ui";
import { REPLY_FIELDS, ReplyCard, SEG_COLOR, SEG_LABEL, type Reply } from "./card";

const VIEWS = { comentarios: "Comentarios", seguimiento: "Close the loop" } as const;
const SEGMENTS = { todos: "Todos", detractor: "Detractores", pasivo: "Pasivos", promotor: "Promotores" } as const;
const ORDER: Segment[] = ["detractor", "pasivo", "promotor"];
const RECENT_DAYS = 90; // ventana de las métricas de tiempo de contacto

const pct = (part: number, total: number) => (total ? Math.round((100 * part) / total) : null);

export default async function Comentarios({ searchParams }: PageProps<"/admin/comentarios">) {
  await requireAdmin();
  const sp = await searchParams;
  const sb = db();
  const [waves, categories, cases] = await Promise.all([
    sb.from("waves").select("id, opens_at, closes_at").order("id").returns<Wave[]>(),
    sb.from("csat_categories").select("key, label").order("position").returns<Category[]>(),
    // Casos del close the loop: aceptaron contacto y son detractores o los marcó el admin.
    sb.from("responses").select(REPLY_FIELDS).eq("contact_ok", true).or("nps.lte.6,flagged.is.true").order("created_at").limit(1000).returns<Reply[]>(),
  ]);
  const allWaves = waves.data ?? [];
  const labels = Object.fromEntries((categories.data ?? []).map((c) => [c.key, c.label]));
  const f = readFilters(sp, allWaves);
  const view = f.pick(VIEWS, "vista") ?? "comentarios";
  const allCases = cases.data ?? [];
  const pending = allCases.filter((c) => caseStatus(c) === "pendiente");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-eyebrow text-brand">Voz del cliente</p>
        <h1 className="text-display !text-4xl">Comentarios</h1>
      </header>

      <nav aria-label="Vista" className="-mt-2 flex w-fit gap-1 rounded-xl bg-muted p-1">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link
            key={k}
            href={f.href({ vista: k })}
            aria-current={view === k ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm transition-colors",
              view === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v}
            {k === "seguimiento" && pending.length > 0 && (
              <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-background tabular-nums">
                <span className="sr-only">, por contactar: </span>
                {pending.length}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {!allWaves.length ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aún no hay olas ni respuestas.</p>
      ) : view === "seguimiento" ? (
        <Loop cases={allCases} labels={labels} />
      ) : (
        <Analysis f={f} waves={allWaves} labels={labels} categories={categories.data ?? []} pending={pending.length} />
      )}
    </div>
  );
}

async function Analysis({ f, waves, labels, categories, pending }: { f: Filters; waves: Wave[]; labels: Record<string, string>; categories: Category[]; pending: number }) {
  const sb = db();
  let query = sb.from("responses").select(REPLY_FIELDS).not("comment", "is", null).in("invitations.wave_id", f.current);
  if (f.plan) query = query.eq("invitations.plan", f.plan);
  const [stats, csat, replies] = await Promise.all([
    sb.from("wave_plan_stats").select("*").returns<WavePlanStat[]>(),
    sb.from("csat_stats").select("*").returns<CsatStat[]>(),
    query.order("created_at", { ascending: false }).limit(1000).returns<Reply[]>(),
  ]);
  const cur = pool(stats.data ?? [], csat.data ?? [], f.current, f.plan);
  const tagged = (replies.data ?? []).map((r) => ({ r, themes: themesOf(r.comment!) }));
  const bySeg = (rows: typeof tagged) => Object.fromEntries(ORDER.map((s) => [s, rows.filter((t) => segment(t.r.nps) === s).length])) as Record<Segment, number>;

  // Menciones por tema y segmento; "otros" = sin tema reconocido, siempre al final.
  const has = (k: string) => (t: (typeof tagged)[number]) => (k === "otros" ? !t.themes.length : t.themes.includes(k));
  const themes = [...categories.map((c) => c.key), "otros"]
    .map((k) => {
      const hits = tagged.filter(has(k));
      return { key: k, label: labels[k] ?? "Sin tema reconocido", total: hits.length, by: bySeg(hits), csat: cur?.items[k]?.top2 };
    })
    .filter((t) => t.total)
    .sort((a, b) => Number(a.key === "otros") - Number(b.key === "otros") || b.by.detractor - a.by.detractor || b.total - a.total);
  const max = Math.max(1, ...themes.map((t) => t.total));
  const total = bySeg(tagged);

  const seg = f.pick(SEGMENTS, "seg") ?? "todos";
  const tema = f.str("tema");
  const q = plain(f.str("q") ?? "").trim();
  const list = tagged
    .filter((t) => (seg === "todos" || segment(t.r.nps) === seg) && (!tema || has(tema)(t)) && (!q || plain(t.r.comment!).includes(q)))
    .map((t) => t.r);
  const hidden = Object.entries({ periodo: f.str("periodo"), ola: f.str("ola"), desde: f.str("desde"), hasta: f.str("hasta"), plan: f.plan, seg: f.str("seg"), tema });

  return (
    <>
      <div className="-mt-2 flex flex-col gap-3">
        <PeriodRange f={f} waves={waves} />
        <PeriodFilter f={f} waves={waves} />
      </div>

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Comentarios · {f.title}</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{tagged.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {cur?.responded ? `${pct(tagged.length, cur.responded)} % de las ${cur.responded} respuestas dejó un comentario` : "Sin respuestas en el período"}
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Quién comenta</p>
          <SegBar by={total} max={Math.max(1, tagged.length)} label="Comentarios por segmento" />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {ORDER.map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: SEG_COLOR[s] }} aria-hidden />
                {SEG_LABEL[s]}s <span className="tabular-nums text-muted-foreground">{total[s]}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link href={f.href({ vista: "seguimiento" })} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ring/60 sm:p-5">
          <p className="text-sm text-muted-foreground">Por contactar</p>
          <p className={cn("mt-2 text-4xl font-semibold tabular-nums", pending > 0 && "text-destructive")}>{pending}</p>
          <p className="mt-2 text-xs text-muted-foreground">Casos del close the loop, todas las olas →</p>
        </Link>
      </section>

      <Panel
        title="Temas de los comentarios"
        subtitle="Menciones por segmento, primero los temas que más mencionan los detractores. A la derecha, el % de satisfechos de esa categoría en el período. Toca un tema para ver sus comentarios."
      >
        {themes.length ? (
          <>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
              {ORDER.map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: SEG_COLOR[s] }} />
                  {SEG_LABEL[s]}s
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-1">
              {themes.map((t) => (
                <li key={t.key}>
                  <Link
                    href={f.href({ tema: tema === t.key ? undefined : t.key })}
                    scroll={false}
                    aria-current={tema === t.key ? "true" : undefined}
                    className={cn(
                      "grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted sm:grid-cols-[10rem_1fr_9rem]",
                      tema === t.key && "bg-muted",
                    )}
                  >
                    <span className="truncate">{t.label}</span>
                    <SegBar by={t.by} max={max} label={`${t.label}: ${t.by.detractor} detractores, ${t.by.pasivo} pasivos, ${t.by.promotor} promotores`} />
                    <span className="text-right text-muted-foreground tabular-nums">
                      <span className="text-foreground">{t.total}</span>
                      {t.csat !== undefined && <span className="hidden sm:inline"> · CSAT {t.csat} %</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No hay comentarios en este período.</p>
        )}
      </Panel>

      <section className="flex flex-col gap-4" aria-labelledby="lista">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="lista" className="text-xl font-semibold font-sans">
            {list.length} {list.length === 1 ? "comentario" : "comentarios"}
            {tema && <span className="text-muted-foreground"> sobre {labels[tema] ?? "otros temas"}</span>}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <nav aria-label="Filtrar por segmento" className="flex flex-wrap gap-2">
              {Object.entries(SEGMENTS).map(([k, v]) => (
                <Chip key={k} href={f.href({ seg: k })} active={seg === k}>
                  {v}
                </Chip>
              ))}
            </nav>
            <Form action="/admin/comentarios" role="search" className="flex">
              {hidden.map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
              <input
                type="search"
                name="q"
                defaultValue={f.str("q")}
                aria-label="Buscar en los comentarios"
                placeholder="Buscar…"
                className="h-11 w-full min-w-0 rounded-l-xl border border-input bg-input/20 px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-44 sm:text-sm"
              />
              <button aria-label="Buscar" className="flex size-11 shrink-0 items-center justify-center rounded-r-xl border border-l-0 border-input text-muted-foreground hover:text-foreground">
                <Search className="size-4" aria-hidden />
              </button>
            </Form>
          </div>
        </div>
        {(tema || q) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {tema && <Clear href={f.href({ tema: undefined })}>Tema: {labels[tema] ?? "sin tema reconocido"}</Clear>}
            {q && <Clear href={f.href({ q: undefined })}>Texto: “{f.str("q")}”</Clear>}
          </div>
        )}
        <p className="-mt-2 text-xs text-muted-foreground">
          Etiquetas: en gris, los temas del comentario; en rojo, las categorías que ese cliente calificó con 1 o 2.
        </p>
        {list.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((r) => (
              <ReplyCard key={r.invitation_id} r={r} labels={labels} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay comentarios con este filtro.</p>
        )}
      </section>
    </>
  );
}

// Barra apilada detractores/pasivos/promotores, ancho relativo a `max`; 2px de separación entre tramos.
function SegBar({ by, max, label }: { by: Record<Segment, number>; max: number; label: string }) {
  return (
    <span role="img" aria-label={label} title={label} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
      {ORDER.map((s) =>
        by[s] ? <span key={s} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(100 * by[s]) / max}%`, background: SEG_COLOR[s] }} /> : null,
      )}
    </span>
  );
}

function Clear({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted pr-2 pl-3 text-foreground hover:bg-muted/70">
      {children}
      <X className="size-4 text-muted-foreground" aria-label="Quitar filtro" />
    </Link>
  );
}

function Loop({ cases, labels }: { cases: Reply[]; labels: Record<string, string> }) {
  const of = (s: ReturnType<typeof caseStatus>) => cases.filter((c) => caseStatus(c) === s);
  const pending = of("pendiente"); // los más antiguos primero
  const following = of("contactado");
  const closed = of("cerrado").sort((a, b) => b.closed_at!.localeCompare(a.closed_at!));
  const late = pending.filter((c) => isOverdue(c)).length;

  // Tiempo hasta el primer contacto, casos de los últimos 90 días cuyo plazo ya venció o ya fueron contactados.
  const recent = cases.filter((c) => hoursSince(c.created_at) <= RECENT_DAYS * 24);
  const hours = recent.filter((c) => c.followed_up_at).map((c) => hoursSince(c.created_at, Date.parse(c.followed_up_at!))).sort((a, b) => a - b);
  const due = recent.filter((c) => c.followed_up_at || hoursSince(c.created_at) > CONTACT_SLA_HOURS).length;
  const onTime = pct(hours.filter((h) => h <= CONTACT_SLA_HOURS).length, due);
  const median = hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null;

  return (
    <>
      <p className="-mt-2 max-w-3xl text-sm text-pretty text-muted-foreground">
        Los detractores (0–6) que aceptaron contacto entran solos. Para sumar a un pasivo o promotor, usa «Hacer seguimiento» en su
        comentario. La meta es contactar a cada uno en menos de {CONTACT_SLA_HOURS} h, anotar qué se habló y cerrar el caso cuando
        esté resuelto.
      </p>

      <section aria-label="Estado del seguimiento" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Por contactar" value={String(pending.length)} alert={pending.length > 0} hint={late ? `${late} atrasados (más de ${CONTACT_SLA_HOURS} h)` : "Ninguno atrasado"} />
        <Stat label="En seguimiento" value={String(following.length)} hint="Contactados, falta cerrar" />
        <Stat label={`Contactados en < ${CONTACT_SLA_HOURS} h`} value={onTime === null ? "—" : `${onTime} %`} hint={`Meta 100 % · últimos ${RECENT_DAYS} días`} />
        <Stat label="Tiempo al primer contacto" value={median === null ? "—" : median < 48 ? `${Math.round(median)} h` : `${Math.round(median / 24)} días`} hint={`Mediana · últimos ${RECENT_DAYS} días`} />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Column title="Por contactar" hint="Los más antiguos primero" items={pending} labels={labels} empty="Nadie esperando contacto." />
        <Column title="En seguimiento" items={following} labels={labels} empty="No hay casos abiertos." />
        <Column
          title="Cerrados"
          hint={closed.length > 20 ? `Los 20 más recientes de ${closed.length}` : undefined}
          items={closed.slice(0, 20)}
          labels={labels}
          empty="Aún no hay casos cerrados."
        />
      </div>
    </>
  );
}

function Stat({ label, value, hint, alert }: { label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-4xl font-semibold tabular-nums", alert && "text-destructive")}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Column({ title, hint, items, labels, empty }: { title: string; hint?: string; items: Reply[]; labels: Record<string, string>; empty: string }) {
  const id = `col-${title.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="text-base font-semibold font-sans">
          {title} <span className="text-muted-foreground tabular-nums">{items.length}</span>
        </h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <ReplyCard key={r.invitation_id} r={r} labels={labels} loop />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
