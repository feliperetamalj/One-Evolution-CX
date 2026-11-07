"use server";

import { brandEmail, esc, sendEmails } from "@/lib/email";
import { db, isUuid } from "@/lib/supabase";
import { PLANS, type PlanKey } from "@/lib/survey";

export type Answer = { nps: number; csat: Record<string, number>; comment: string; contactOk: boolean };
export type SaveResult = { ok: true } | { ok: false; error: "closed" | "invalid" | "unknown" };

const valid = (id: string, a: Answer) =>
  isUuid(id) &&
  Number.isInteger(a.nps) && a.nps >= 0 && a.nps <= 10 &&
  typeof a.comment === "string" && a.comment.length <= 2000 &&
  typeof a.contactOk === "boolean" &&
  // La base solo acepta categorías que se le preguntaron a esta invitación.
  Object.entries(a.csat ?? {}).every(([k, v]) => /^[a-z]{1,30}$/.test(k) && Number.isInteger(v) && v >= 1 && v <= 5);

// Se llama al pasar el NPS (para no perderlo si abandonan), al pasar los CSAT y al enviar.
export async function saveResponse(id: string, a: Answer, final: boolean): Promise<SaveResult> {
  if (!valid(id, a)) return { ok: false, error: "invalid" };
  const { error } = await db().rpc("save_response", {
    p_invitation: id,
    p_nps: a.nps,
    p_csat: a.csat,
    p_comment: a.comment,
    p_contact_ok: a.contactOk,
  });
  if (error) return { ok: false, error: error.message.includes("invitation_closed") ? "closed" : "unknown" };
  // ponytail: si el detractor edita y reenvía, la alerta sale de nuevo; aceptable por lo poco frecuente
  if (final && a.nps <= 6 && a.contactOk) await alertDetractor(id, a);
  return { ok: true };
}

async function alertDetractor(id: string, a: Answer) {
  const to = process.env.ALERT_EMAIL;
  if (!to) return;
  const { data } = await db()
    .from("invitations")
    .select("wave_id, plan, clients(full_name, email, phone)")
    .eq("id", id)
    .single<{ wave_id: number; plan: PlanKey | null; clients: { full_name: string; email: string | null; phone: string | null } }>();
  if (!data) return;
  const c = data.clients;
  const contact = [c.email, c.phone].filter(Boolean).map((x) => esc(x!)).join(" · ");
  await sendEmails([
    {
      to,
      subject: `Detractor en Ola ${data.wave_id}: ${c.full_name} (${a.nps}/10)`,
      html: brandEmail({
        title: `${esc(c.full_name)} puso ${a.nps}/10 y acepta que lo contacten`,
        body: `Plan: ${data.plan ? PLANS[data.plan] : "—"}<br>Contacto: ${contact || "—"}<br><br>
          ${a.comment ? `“${esc(a.comment)}”` : "Sin comentario."}<br><br>
          Ideal: contactar dentro de 48 horas y marcarlo como contactado en el dashboard.`,
        cta: { label: "Abrir dashboard", url: `${process.env.APP_URL}/admin` },
      }),
    },
  ]);
}
