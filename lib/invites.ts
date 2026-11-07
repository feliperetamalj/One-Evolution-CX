import "server-only";
import { brandEmail, esc, sendEmails } from "./email";
import { db } from "./supabase";

const DAY = 864e5;
const LIMIT = Number(process.env.EMAIL_DAILY_LIMIT ?? 100); // Resend Free: 100 emails/día

export type Wave = { id: number; opens_at: string; closes_at: string };
type Recipient = { id: string; clients: { full_name: string; email: string } };

export const surveyUrl = (id: string) => `${process.env.APP_URL}/s/${id}`;
export const firstName = (full: string) => full.split(" ")[0];
export const closeDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago" }).replace(",", "");

export async function currentWave() {
  const { data } = await db().from("waves").select("id, opens_at, closes_at").order("id", { ascending: false }).limit(1).maybeSingle<Wave>();
  return data;
}

export const isOpen = (w: Wave | null) => !!w && Date.now() < Date.parse(w.closes_at);

// Envía las invitaciones pendientes de la ola y, desde el día 3, un recordatorio a quien no ha respondido.
// Lo que no alcanza por el límite diario sale en la próxima corrida del cron.
export async function sendInvites(wave: Wave) {
  const result = { sent: 0, reminded: 0 };
  if (!isOpen(wave)) return result;
  const sb = db();
  const closes = closeDate(wave.closes_at);

  const { data: pending } = await sb
    .from("invitations")
    .select("id, clients!inner(full_name, email)")
    .eq("wave_id", wave.id)
    .is("sent_at", null)
    .not("clients.email", "is", null)
    .limit(LIMIT)
    .returns<Recipient[]>();

  if (pending?.length) {
    const ok = await sendEmails(
      pending.map(({ id, clients: c }) => ({
        to: c.email,
        subject: `${firstName(c.full_name)}, ¿cómo estuvo tu experiencia en ONE estas 2 semanas?`,
        html: brandEmail({
          title: `${esc(firstName(c.full_name))}, ¿cómo estuvo tu experiencia en ONE?`,
          body: `Cada sesión en ONE está pensada para ti y queremos saber cómo lo estamos haciendo.
            Responder toma 1 minuto y tus respuestas son confidenciales.<br><br>La encuesta está abierta hasta el ${closes}.`,
          cta: { label: "Responder encuesta", url: surveyUrl(id) },
        }),
      })),
    );
    if (ok) {
      await sb.from("invitations").update({ sent_at: new Date().toISOString() }).in("id", pending.map((p) => p.id));
      result.sent = pending.length;
    }
  }

  const budget = LIMIT - result.sent;
  if (budget <= 0 || Date.now() - Date.parse(wave.opens_at) < 3 * DAY) return result;

  const { data: late } = await sb
    .from("invitations")
    .select("id, clients!inner(full_name, email), responses(invitation_id)")
    .eq("wave_id", wave.id)
    .not("sent_at", "is", null)
    .is("reminded_at", null)
    .is("responses", null)
    .not("clients.email", "is", null)
    .limit(budget)
    .returns<Recipient[]>();

  if (late?.length) {
    const ok = await sendEmails(
      late.map(({ id, clients: c }) => ({
        to: c.email,
        subject: `${firstName(c.full_name)}, aún estás a tiempo de contarnos cómo te fue`,
        html: brandEmail({
          title: "Tu opinión nos falta",
          body: `La encuesta de esta quincena cierra el ${closes}. Toma 1 minuto y nos ayuda a cuidar cada detalle de tu experiencia.`,
          cta: { label: "Responder encuesta", url: surveyUrl(id) },
        }),
      })),
    );
    if (ok) {
      await sb.from("invitations").update({ reminded_at: new Date().toISOString() }).in("id", late.map((p) => p.id));
      result.reminded = late.length;
    }
  }
  return result;
}
