import { ChevronDown, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { CSAT_SCALE, PLANS, plain, segment, type PlanKey } from "@/lib/survey";
import { cn } from "@/lib/utils";
import { SEG_COLOR, SEG_LABEL } from "../comentarios/card";
import { input } from "../configuracion/forms";

export const metadata = { title: "ONE · Respuestas" };

const PAGE = 20;

type Row = {
  invitation_id: string;
  nps: number;
  comment: string | null;
  contact_ok: boolean;
  created_at: string;
  invitations: {
    wave_id: number;
    plan: PlanKey | null;
    clients: { full_name: string };
    invitation_questions: { category: string; questions: { text: string } }[];
  };
  csat_scores: { item: string; score: number }[];
};

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Medianoche de ese día en Santiago, con el desfase que corresponda (−03 en verano, −04 en invierno).
const santiago = (date: string) => {
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")!.value.replace("GMT", "");
  return `${date}T00:00:00${off || "+00:00"}`;
};
const nextDay = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
const when = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

// Lista paginada de respuestas. Solo lee: no toca invitaciones ni enlaces.
// El nombre solo se muestra (y se busca) si el cliente aceptó que lo contacten, como promete la encuesta.
export default async function Respuestas({ searchParams }: PageProps<"/admin/respuestas">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? sp[k].trim() : "");
  const q = str("q");
  const plan = str("plan") in PLANS ? (str("plan") as PlanKey) : null;
  const desde = isDate(str("desde")) ? str("desde") : "";
  const hasta = isDate(str("hasta")) ? str("hasta") : "";
  const page = Math.max(1, Number.parseInt(str("p"), 10) || 1);
  const sb = db();

  const { data: categories } = await sb.from("csat_categories").select("key, label").order("position");
  const order = (categories ?? []).map((c) => c.key);
  const label = Object.fromEntries((categories ?? []).map((c) => [c.key, c.label]));

  // Búsqueda sin tildes ni mayúsculas (como en Clientes): se resuelve a ids en memoria.
  // ponytail: trae todos los clientes; si el padrón pasa de unos miles, mover a una columna normalizada en SQL.
  let ids: string[] | null = null;
  if (q) {
    const { data: clients } = await sb.from("clients").select("id, full_name");
    ids = (clients ?? []).filter((c) => plain(c.full_name).includes(plain(q))).map((c) => c.id);
  }

  const href = (p: number) => {
    const params = new URLSearchParams(Object.entries({ q, plan: plan ?? "", desde, hasta }).filter(([, v]) => v));
    if (p > 1) params.set("p", String(p));
    return `/admin/respuestas${params.size ? `?${params}` : ""}`;
  };

  let rows: Row[] = [];
  let total = 0;
  if (!ids || ids.length) {
    let query = sb
      .from("responses")
      .select(
        "invitation_id, nps, comment, contact_ok, created_at, invitations!inner(wave_id, plan, client_id, clients(full_name), invitation_questions(category, questions(text))), csat_scores(item, score)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (ids) query = query.eq("contact_ok", true).in("invitations.client_id", ids);
    if (plan) query = query.eq("invitations.plan", plan);
    if (desde) query = query.gte("created_at", santiago(desde));
    if (hasta) query = query.lt("created_at", santiago(nextDay(hasta)));
    const res = await query.returns<Row[]>();
    if (res.error && page > 1) redirect(href(1)); // página que ya no existe (p. ej. tras filtrar)
    rows = res.data ?? [];
    total = res.count ?? 0;
  }
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const filtered = !!(q || plan || desde || hasta);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-eyebrow text-brand">Experiencia de clientes</p>
        <h1 className="text-display !text-4xl">Respuestas</h1>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          Cada encuesta respondida, de la más reciente a la más antigua. Toca una para ver sus notas. El nombre solo aparece si el
          cliente aceptó que lo contacten; por eso la búsqueda por nombre encuentra solo a esos clientes.
        </p>
      </header>

      <Form action="/admin/respuestas" role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_10rem_auto]">
        <label className="flex flex-col gap-1.5 text-sm">
          Nombre
          <input type="search" name="q" defaultValue={q} placeholder="Buscar…" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Plan
          <select name="plan" defaultValue={plan ?? ""} className={input}>
            <option value="">Todos los planes</option>
            {Object.entries(PLANS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Respondió desde
          <input type="date" name="desde" defaultValue={desde} max={hasta || undefined} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} min={desde || undefined} className={input} />
        </label>
        <div className="flex items-end gap-2">
          <button className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Filtrar</button>
          {filtered && (
            <Link href="/admin/respuestas" className="flex h-11 items-center rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              Limpiar
            </Link>
          )}
        </div>
      </Form>

      <p className="-mt-4 text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "respuesta" : "respuestas"}
        {filtered && " con estos filtros"}
      </p>

      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const s = segment(r.nps);
            const scores = Object.fromEntries(r.csat_scores.map((c) => [c.item, c.score]));
            const asked = Object.fromEntries(r.invitations.invitation_questions.map((x) => [x.category, x.questions.text]));
            const avg = r.csat_scores.length ? r.csat_scores.reduce((t, c) => t + c.score, 0) / r.csat_scores.length : null;
            return (
              <li key={r.invitation_id}>
                <details className="group rounded-2xl border border-border bg-card open:border-ring/40">
                  <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold tabular-nums text-white"
                      style={{ background: SEG_COLOR[s] }}
                      title={`NPS ${r.nps} · ${SEG_LABEL[s]}`}
                    >
                      {r.nps}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-medium", !r.contact_ok && "text-muted-foreground")}>
                        {r.contact_ok ? r.invitations.clients.full_name : "Cliente confidencial"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.invitations.plan ? PLANS[r.invitations.plan] : "Sin plan"} · Ola {r.invitations.wave_id} · {when(r.created_at)}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                      {avg === null ? "Sin CSAT" : `CSAT ${avg.toFixed(1)}`}
                      {r.comment && <MessageSquareText className="size-4" aria-label="Con comentario" />}
                    </span>
                    <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                  </summary>
                  <div className="flex flex-col gap-4 border-t border-border px-4 pt-3 pb-4">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {order.filter((k) => asked[k] || scores[k]).map((k) => (
                        <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
                          <dt className="min-w-0">
                            <span className="text-muted-foreground">{label[k]}</span>
                            {asked[k] && <span className="block text-xs text-muted-foreground/80 text-pretty">{asked[k]}</span>}
                          </dt>
                          <dd className={cn("shrink-0 tabular-nums font-medium", scores[k] && scores[k] <= 2 && "text-destructive")}>
                            {scores[k] ? `${scores[k]} · ${CSAT_SCALE[scores[k] - 1]}` : "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className={cn("text-sm text-pretty", !r.comment && "text-muted-foreground")}>
                      {r.comment ? `“${r.comment}”` : "Sin comentario."}
                    </p>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {filtered ? "Ninguna respuesta coincide con estos filtros." : "Aún no hay respuestas."}
        </p>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          <Pager href={href(page - 1)} disabled={page <= 1} label="Anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </Pager>
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {Math.min(page, pages)} de {pages}
          </span>
          <Pager href={href(page + 1)} disabled={page >= pages} label="Siguiente">
            <ChevronRight className="size-5" aria-hidden />
          </Pager>
        </nav>
      )}
    </div>
  );
}

function Pager({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "flex size-11 items-center justify-center rounded-xl border border-border";
  return disabled ? (
    <span aria-disabled className={cn(cls, "opacity-30")} title={label}>
      {children}
    </span>
  ) : (
    <Link href={href} aria-label={label} title={label} className={cn(cls, "hover:bg-muted")}>
      {children}
    </Link>
  );
}
