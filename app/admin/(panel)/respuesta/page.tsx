import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { closeDate, isOpen, reminderWhatsapp, type Wave } from "@/lib/invites";
import { db } from "@/lib/supabase";
import { PLANS, summarize, type PlanKey, type WavePlanStat } from "@/lib/survey";
import { ParamSelect, RateTrend } from "../charts";
import { Kpi, Panel, day, diff, planOptions, readFilters, waveOptions } from "../ui";

export const metadata = { title: "ONE · Tasa de respuesta" };

const RESPONSE_TARGET = 40; // meta del sistema: ≥ 40 % (docs/ROADMAP.md)

type Invite = {
  id: string;
  plan: PlanKey | null;
  sent_at: string | null;
  reminded_at: string | null;
  clients: { full_name: string; email: string | null; phone: string | null };
  responses: { invitation_id: string } | null;
};

// Detalle de la tarjeta "Tasa de respuesta" del dashboard: la tasa por ola y quiénes no respondieron una ola.
export default async function Respuesta({ searchParams }: PageProps<"/admin/respuesta">) {
  await requireAdmin();
  const sp = await searchParams;
  const sb = db();
  const [stats, waves] = await Promise.all([
    sb.from("wave_plan_stats").select("*").returns<WavePlanStat[]>(),
    sb.from("waves").select("id, opens_at, closes_at").order("id").returns<Wave[]>(),
  ]);
  const allWaves = waves.data ?? [];
  if (!allWaves.length) return <p className="text-muted-foreground">Aún no hay olas.</p>;

  // Aquí siempre se mira una ola; el período del dashboard se conserva solo para el enlace de vuelta.
  const f = readFilters({ ...sp, periodo: "ola" }, allWaves);
  const back = readFilters(sp, allWaves).href({}, "/admin");
  const wave = allWaves.find((w) => w.id === f.current[0])!;

  let query = sb.from("invitations").select("id, plan, sent_at, reminded_at, clients(full_name, email, phone), responses(invitation_id)").eq("wave_id", wave.id);
  if (f.plan) query = query.eq("plan", f.plan);
  const invites = (await query.returns<Invite[]>()).data ?? [];
  const missing = invites.filter((i) => !i.responses).sort((a, b) => a.clients.full_name.localeCompare(b.clients.full_name));

  const summary = summarize(stats.data ?? [], [], f.plan);
  const at = summary.findIndex((w) => w.wave === wave.id);
  const cur = summary[at];
  const prev = summary[at - 1];
  const chart = summary.slice(Math.max(0, at - 11), at + 1); // hasta 12 olas, terminando en la elegida
  const open = isOpen(wave);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={back} className="-ml-1 inline-flex w-fit items-center gap-1 rounded-lg px-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Dashboard
        </Link>
        <p className="text-eyebrow text-brand">Experiencia de clientes</p>
        <h1 className="text-display !text-4xl">Tasa de respuesta</h1>
        <p className="text-sm text-muted-foreground">
          Ola {wave.id} · {day(wave.opens_at)} – {day(wave.closes_at)}
          {open && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-brand">En curso · cierra el {closeDate(wave.closes_at)}</span>}
        </p>
      </header>

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <ParamSelect param="ola" label="Ola" value={String(wave.id)} options={waveOptions(allWaves)} />
        <ParamSelect param="plan" label="Plan" value={f.plan ?? ""} options={planOptions} />
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label="Tasa de respuesta"
          value={cur?.responseRate ?? null}
          unit="%"
          delta={diff(cur?.responseRate ?? null, prev?.responseRate)}
          vs={prev ? `vs Ola ${prev.wave}` : undefined}
          hint={open ? `Ola en curso: la tasa aún puede subir · meta ${RESPONSE_TARGET} %` : `Meta: ${RESPONSE_TARGET} % o más`}
        />
        <Kpi label="Respondieron" value={cur?.responded ?? 0} delta={null} hint={`de ${cur?.invited ?? 0} invitaciones`} />
        <div className="col-span-2 lg:col-span-1">
          <Kpi
            label="Sin responder"
            value={missing.length}
            delta={null}
            hint={open ? `Aún pueden responder hasta el ${closeDate(wave.closes_at)}` : "La ola ya cerró"}
          />
        </div>
      </section>

      <Panel title="Tasa de respuesta por ola" subtitle={`% de invitados que respondieron. Línea punteada: meta de ${RESPONSE_TARGET} %.`}>
        <RateTrend data={chart} target={RESPONSE_TARGET} />
      </Panel>

      <section aria-labelledby="faltan" className="flex flex-col gap-4">
        <div>
          <h2 id="faltan" className="text-xl font-semibold font-sans">
            No respondieron la Ola {wave.id} <span className="text-muted-foreground tabular-nums">· {missing.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {open ? "La ola sigue abierta: puedes recordarles por WhatsApp con su link personal." : "Para ver otra ola, elígela arriba."}
          </p>
        </div>
        {missing.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missing.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{i.clients.full_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{i.plan ? PLANS[i.plan] : "Sin plan"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {!i.clients.email
                    ? "Sin email: no recibió la encuesta"
                    : i.sent_at
                      ? `Email el ${day(i.sent_at)}${i.reminded_at ? ` · recordatorio el ${day(i.reminded_at)}` : ""}`
                      : "Email pendiente de envío"}
                </span>
                {open && i.clients.phone && (
                  <a
                    href={reminderWhatsapp(i.id, i.clients.full_name, i.clients.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 w-fit text-brand underline-offset-4 hover:underline"
                  >
                    Recordar por WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Todos respondieron esta ola.
          </p>
        )}
      </section>
    </div>
  );
}
