import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { AddAdmin, AlertEmails, ChangePassword, RemoveAdmin } from "./forms";

export const metadata = { title: "ONE · Configuración" };

export default async function Configuracion() {
  const me = await requireAdmin();
  const sb = db();
  const [{ data: admins }, { data: settings }] = await Promise.all([
    sb.from("admins").select("email").order("email").returns<{ email: string }[]>(),
    sb.from("settings").select("alert_emails").single<{ alert_emails: string[] }>(),
  ]);
  const emailReady = !!process.env.RESEND_API_KEY;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-eyebrow text-brand">Administración</p>
        <h1 className="text-display !text-4xl">Configuración</h1>
      </header>

      <Section title="Accesos al panel" description="Estas personas entran al panel con su email y contraseña.">
        <ul className="flex flex-col divide-y divide-border">
          {(admins ?? []).map(({ email }) => (
            <li key={email} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
              <span className="truncate">{email}</span>
              {email === me ? <span className="px-3 text-muted-foreground">Tú</span> : <RemoveAdmin email={email} />}
            </li>
          ))}
        </ul>
        <AddAdmin />
      </Section>

      <Section
        title="Alertas de detractores"
        description="Reciben un email apenas un cliente pone 0 a 6 y acepta que lo contacten, con su nota, su comentario y cómo ubicarlo."
      >
        {!emailReady && (
          <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-pretty text-muted-foreground">
            El envío de emails aún no está configurado (falta la cuenta de Resend), así que por ahora las alertas no salen.
            Los detractores igual aparecen en “Por contactar” del dashboard.
          </p>
        )}
        <AlertEmails emails={settings?.alert_emails ?? []} />
      </Section>

      <Section title="Tu contraseña" description={`Cuenta: ${me}`}>
        <ChangePassword />
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold font-sans">{title}</h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
