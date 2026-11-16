import { Download, Pencil, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { closeDate, currentWave, isOpen, reminderWhatsapp } from "@/lib/invites";
import { db } from "@/lib/supabase";
import { PLANS, plain, type PlanKey } from "@/lib/survey";
import { cn } from "@/lib/utils";
import { setClientActive } from "../../actions";
import { ParamSelect } from "../charts";
import { planOptions } from "../ui";
import { ImportClients, OpenWave } from "./forms";

export const metadata = { title: "ONE · Clientes y olas" };

type Client = { id: string; full_name: string; email: string | null; phone: string | null; plan: PlanKey | null; active: boolean };
type Invite = { id: string; sent_at: string | null; clients: { full_name: string; phone: string | null }; responses: { invitation_id: string } | null };

const whatsapp = (i: Invite) => reminderWhatsapp(i.id, i.clients.full_name, i.clients.phone);

export default async function Clientes({ searchParams }: PageProps<"/admin/clientes">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const plan = typeof sp.plan === "string" && sp.plan in PLANS ? (sp.plan as PlanKey) : null;
  const sb = db();
  const [wave, { data: clients }] = await Promise.all([
    currentWave(),
    sb.from("clients").select("id, full_name, email, phone, plan, active").order("active", { ascending: false }).order("full_name").returns<Client[]>(),
  ]);
  const open = isOpen(wave);
  const { data: invites } = open
    ? await sb.from("invitations").select("id, sent_at, clients(full_name, phone), responses(invitation_id)").eq("wave_id", wave!.id).returns<Invite[]>()
    : { data: [] as Invite[] };
  const missing = (invites ?? []).filter((i) => !i.responses).sort((a, b) => a.clients.full_name.localeCompare(b.clients.full_name));
  const all = clients ?? [];
  const active = all.filter((c) => c.active).length;
  // Filtro en memoria: el padrón es de cientos de clientes. Sin tildes ni mayúsculas, como en Comentarios.
  const shown = all.filter((c) => (!plan || c.plan === plan) && (!q || plain(c.full_name).includes(plain(q))));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-eyebrow text-brand">Administración</p>
        <h1 className="text-display !text-4xl">Clientes y olas</h1>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold font-sans">Ola actual</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {open
            ? `Ola ${wave!.id} abierta hasta el ${closeDate(wave!.closes_at)}. Respondieron ${(invites?.length ?? 0) - missing.length} de ${invites?.length ?? 0}; ${(invites ?? []).filter((i) => i.sent_at).length} recibieron el email.`
            : wave
              ? `La Ola ${wave.id} cerró. La próxima se abre sola 14 días después de la anterior; también puedes abrirla ahora.`
              : "Aún no hay olas. Cuando tengas tus clientes importados, abre la primera: desde ahí se abre una nueva cada 14 días."}
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <OpenWave disabled={open || active === 0} />
          {open && (
            // Archivo, no navegación: <a download> en vez de Link.
            <a
              href="/admin/clientes/enlaces"
              download
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" aria-hidden />
              Descargar enlaces (CSV)
            </a>
          )}
        </div>
        {missing.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-brand">Recordar por WhatsApp a quienes faltan ({missing.length})</summary>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {missing.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="truncate">{i.clients.full_name}</span>
                  <a href={whatsapp(i)} target="_blank" rel="noreferrer" className="shrink-0 text-brand underline-offset-4 hover:underline">
                    Enviar WhatsApp
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold font-sans">Importar clientes</h2>
        <ImportClients />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold font-sans">
            Clientes <span className="text-base font-normal text-muted-foreground">· {active} activos de {all.length}</span>
          </h2>
          {all.length > 0 && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Form action="/admin/clientes" role="search" className="flex min-w-0 flex-1 sm:flex-none">
                {plan && <input type="hidden" name="plan" value={plan} />}
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  aria-label="Buscar cliente por nombre"
                  placeholder="Buscar por nombre…"
                  className="h-11 w-full min-w-0 rounded-l-xl border border-input bg-input/20 px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56 sm:text-sm"
                />
                <button aria-label="Buscar" className="flex size-11 shrink-0 items-center justify-center rounded-r-xl border border-l-0 border-input text-muted-foreground hover:text-foreground">
                  <Search className="size-4" aria-hidden />
                </button>
              </Form>
              <ParamSelect param="plan" label="Plan" value={plan ?? ""} options={planOptions} />
            </div>
          )}
        </div>
        {(q || plan) && (
          <p className="-mt-2 text-sm text-muted-foreground" aria-live="polite">
            {shown.length} {shown.length === 1 ? "cliente" : "clientes"}
            {q && ` con “${q}”`}
            {plan && ` en ${PLANS[plan]}`} ·{" "}
            <Link href="/admin/clientes" className="text-brand underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </p>
        )}
        {all.length && !shown.length ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Ningún cliente coincide con la búsqueda.</p>
        ) : all.length ? (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">Nombre</th>
                  <th scope="col" className="px-4 py-3 font-normal">Email</th>
                  <th scope="col" className="px-4 py-3 font-normal">Teléfono</th>
                  <th scope="col" className="px-4 py-3 font-normal">Plan</th>
                  <th scope="col" className="px-4 py-3 font-normal">Encuestas</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className={cn("border-t border-border", !c.active && "text-muted-foreground")}>
                    <td className="px-4 py-1 whitespace-nowrap">
                      <Link
                        href={`/admin/clientes/editar?id=${c.id}`}
                        aria-label={`Editar a ${c.full_name}`}
                        className="-mx-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-muted"
                      >
                        {c.full_name}
                        <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
                      </Link>
                    </td>
                    <td className="px-4 py-3">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.phone ? `+${c.phone}` : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.plan ? PLANS[c.plan] : "—"}</td>
                    <td className="px-4 py-3">
                      <form action={setClientActive.bind(null, c.id, !c.active)}>
                        <button className="rounded-lg px-2 py-1 whitespace-nowrap text-brand hover:bg-muted">
                          {c.active ? "Activo · pausar" : "Pausado · activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aún no hay clientes.</p>
        )}
      </section>
    </div>
  );
}
