import Link from "next/link";
import { closeDate, isOpen, type Wave } from "@/lib/invites";
import { PERIODS, PLANS, periodWaves, type PeriodKey } from "@/lib/survey";
import { cn } from "@/lib/utils";
import { ParamSelect } from "./charts";

// Piezas que comparten el dashboard y Comentarios: filtros de período y plan (viven en la URL), chips y paneles.

export const day = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });
export const span = (ids: number[]) => (ids.length === 1 ? `Ola ${ids[0]}` : `Olas ${ids[0]} a ${ids.at(-1)}`);

const MONTHS: Record<Exclude<PeriodKey, "ola" | "olas">, { title: string; vs?: string }> = {
  "1m": { title: "Último mes", vs: "vs mes anterior" },
  "3m": { title: "Últimos 3 meses", vs: "vs 3 meses anteriores" },
  "6m": { title: "Últimos 6 meses", vs: "vs 6 meses anteriores" },
  "12m": { title: "Último año", vs: "vs año anterior" },
  total: { title: "Todas las olas" },
};
// Valores por defecto: no se escriben en la URL.
const DEFAULTS: Record<string, string> = { periodo: "ola", seg: "todos", vista: "comentarios" };

type SearchParams = Awaited<PageProps<"/admin">["searchParams"]>;
export type Filters = ReturnType<typeof readFilters>;

export function readFilters(sp: SearchParams, waves: Wave[]) {
  const str = (k: string) => (typeof sp[k] === "string" ? sp[k] : undefined);
  const num = (k: string) => (/^\d+$/.test(str(k) ?? "") ? Number(str(k)) : undefined);
  const pick = <T extends object>(o: T, k: string) => (Object.hasOwn(o, str(k) ?? "") ? (str(k) as keyof T) : undefined);
  const plan = pick(PLANS, "plan");
  const period = pick(PERIODS, "periodo") ?? "ola";
  const { current, previous } = periodWaves({ key: period, ola: num("ola"), desde: num("desde"), hasta: num("hasta") }, waves);
  const byWave = period === "ola" || period === "olas";
  const title = byWave ? span(current) : MONTHS[period].title;
  const vs = previous.length ? (byWave ? `vs ${span(previous)}` : MONTHS[period].vs) : undefined;
  // Enlace que conserva los filtros de la URL y cambia los de `next` (undefined los quita).
  const href = (next: Record<string, string | undefined>, path = "") => {
    const p = new URLSearchParams();
    Object.entries({ ...Object.fromEntries(Object.keys(sp).map((k) => [k, str(k)])), ...next })
      .forEach(([k, v]) => v && v !== DEFAULTS[k] && p.set(k, v));
    return `${path}?${p}`;
  };
  return { str, pick, plan, period, current, previous, byWave, title, vs, href };
}

export function PeriodFilter({ f, waves }: { f: Filters; waves: Wave[] }) {
  const options = [...waves].reverse().map((w) => ({ value: String(w.id), label: `Ola ${w.id} · ${day(w.opens_at)}` }));
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {Object.entries(PERIODS).map(([k, v]) => (
          <Chip key={k} href={f.href({ periodo: k })} active={f.period === k}>
            {v}
          </Chip>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        {f.period === "ola" && <ParamSelect param="ola" label="Ola" value={String(f.current[0])} options={options} />}
        {f.period === "olas" && (
          <>
            <ParamSelect param="desde" label="Desde la ola" value={String(f.current[0])} options={options} />
            <span className="text-sm text-muted-foreground">a</span>
            <ParamSelect param="hasta" label="Hasta la ola" value={String(f.current.at(-1))} options={options} />
          </>
        )}
        <ParamSelect
          param="plan"
          label="Plan"
          value={f.plan ?? ""}
          options={[{ value: "", label: "Todos los planes" }, ...Object.entries(PLANS).map(([value, label]) => ({ value, label }))]}
        />
      </div>
    </div>
  );
}

// Fechas del período y, si la última ola sigue abierta, cuándo cierra.
export function PeriodRange({ f, waves }: { f: Filters; waves: Wave[] }) {
  const inPeriod = waves.filter((w) => f.current.includes(w.id));
  const last = inPeriod.at(-1);
  if (!last) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {!f.byWave && `${span(f.current)} · `}
      {day(inPeriod[0].opens_at)} – {day(last.closes_at)}
      {isOpen(last) && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-brand">En curso · cierra el {closeDate(last.closes_at)}</span>}
    </p>
  );
}

export function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
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

export function Panel({ title, subtitle, className, children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    // min-w-0: dentro de una grilla, deja que el panel se achique y su contenido ancho (el mapa de calor) haga scroll.
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div>
        <h2 className="text-base font-semibold font-sans">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
