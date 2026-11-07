import { requireAdmin } from "@/lib/auth";
import { closeDate, currentWave, firstName, isOpen, surveyUrl } from "@/lib/invites";
import { db } from "@/lib/supabase";
import { PLANS, type PlanKey } from "@/lib/survey";
import { cn } from "@/lib/utils";
import { setClientActive } from "../../actions";
import { ImportClients, OpenWave } from "./forms";

export const metadata = { title: "ONE · Clientes y olas" };

type Client = { id: string; full_name: string; email: string | null; phone: string | null; plan: PlanKey | null; active: boolean };
type Invite = { id: string; sent_at: string | null; clients: { full_name: string; phone: string | null }; responses: { invitation_id: string } | null };

const whatsapp = (i: Invite) =>
  `https://wa.me/${i.clients.phone ?? ""}?text=${encodeURIComponent(
    `¡Hola ${firstName(i.clients.full_name)}! En ONE queremos saber cómo ha sido tu experiencia estas 2 semanas. Toma 1 minuto: ${surveyUrl(i.id)}`,
  )}`;

export default async function Clientes() {
  await requireAdmin();
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
        <OpenWave disabled={open || active === 0} />
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
        <h2 className="text-xl font-semibold font-sans">
          Clientes <span className="text-base font-normal text-muted-foreground">· {active} activos de {all.length}</span>
        </h2>
        {all.length ? (
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
                {all.map((c) => (
                  <tr key={c.id} className={cn("border-t border-border", !c.active && "text-muted-foreground")}>
                    <td className="px-4 py-3 whitespace-nowrap">{c.full_name}</td>
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
