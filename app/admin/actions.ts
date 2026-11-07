"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { authClient, requireAdmin } from "@/lib/auth";
import { currentWave, isOpen, sendInvites } from "@/lib/invites";
import { db, isUuid } from "@/lib/supabase";
import { QUESTIONS_PER_CATEGORY as LIMIT, parseClients } from "@/lib/survey";

export async function signIn(_: string | null, form: FormData) {
  const { error } = await (await authClient()).auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) return "Email o contraseña incorrectos.";
  redirect("/admin");
}

export async function signOut() {
  await (await authClient()).auth.signOut();
  redirect("/admin/login");
}

export async function markFollowedUp(invitationId: string) {
  await requireAdmin();
  if (!isUuid(invitationId)) return;
  await db().from("responses").update({ followed_up_at: new Date().toISOString() }).eq("invitation_id", invitationId);
  refresh();
}

export async function openWaveNow(): Promise<string> {
  await requireAdmin();
  if (isOpen(await currentWave())) return "Ya hay una ola abierta.";
  const { error } = await db().rpc("open_wave");
  if (error) return "No se pudo abrir la ola.";
  const wave = (await currentWave())!;
  const { sent } = await sendInvites(wave);
  refresh();
  return sent
    ? `Ola ${wave.id} abierta: ${sent} emails enviados.`
    : `Ola ${wave.id} abierta. No se enviaron emails (revisa la configuración de Resend); usa los botones de WhatsApp.`;
}

export async function importClients(_: string | null, form: FormData): Promise<string> {
  await requireAdmin();
  const { rows, errors } = parseClients(String(form.get("csv") ?? ""));
  // Por email se actualiza (sin duplicar); sin email se inserta.
  const withEmail = [...new Map(rows.filter((r) => r.email).map((r) => [r.email, r])).values()];
  const withoutEmail = rows.filter((r) => !r.email);
  const sb = db();
  const [a, b] = await Promise.all([
    withEmail.length ? sb.from("clients").upsert(withEmail, { onConflict: "email" }) : { error: null },
    withoutEmail.length ? sb.from("clients").insert(withoutEmail) : { error: null },
  ]);
  if (a.error || b.error) return `No se pudo importar: ${(a.error ?? b.error)!.message}`;
  refresh();
  return [`${rows.length} clientes importados.`, ...errors].join("\n");
}

export async function setClientActive(id: string, active: boolean) {
  await requireAdmin();
  if (!isUuid(id)) return;
  await db().from("clients").update({ active }).eq("id", id);
  refresh();
}

const activeQuestions = async (category: string) =>
  (await db().from("questions").select("id", { count: "exact", head: true }).eq("category", category).eq("active", true)).count ?? 0;

export async function addQuestion(category: string, _: string | null, form: FormData): Promise<string | null> {
  await requireAdmin();
  const text = String(form.get("text") ?? "").trim().replace(/\s+/g, " ");
  if (text.length < 5 || text.length > 160) return "La pregunta debe tener entre 5 y 160 caracteres.";
  if ((await activeQuestions(category)) >= LIMIT.max) return `Ya hay ${LIMIT.max} preguntas: quita una antes de añadir otra.`;
  const { error } = await db().from("questions").insert({ category, text });
  if (error) return "No se pudo guardar la pregunta.";
  refresh();
  return null;
}

// Quitar archiva la pregunta (sus respuestas siguen contando); restaurar la vuelve a activar.
export async function setQuestionActive(id: number, active: boolean) {
  await requireAdmin();
  if (!Number.isInteger(id)) return;
  const sb = db();
  const { data: q } = await sb.from("questions").select("category").eq("id", id).maybeSingle();
  if (!q) return;
  const n = await activeQuestions(q.category);
  if (active ? n >= LIMIT.max : n <= LIMIT.min) return;
  await sb.from("questions").update({ active }).eq("id", id);
  refresh();
}
