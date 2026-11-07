"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { authClient, requireAdmin } from "@/lib/auth";
import { currentWave, isOpen, sendInvites } from "@/lib/invites";
import { db, isUuid } from "@/lib/supabase";
import { QUESTIONS_PER_CATEGORY as LIMIT, isEmail, parseClients } from "@/lib/survey";

export type FormResult = { ok?: string; error?: string; password?: string } | null;

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

// Da acceso al panel. Si la persona no tiene cuenta, se crea con una contraseña temporal que se muestra una vez.
export async function addAdmin(_: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "Escribe un email válido." };
  const sb = db();
  const password = randomBytes(9).toString("base64url");
  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  const existed = error?.code === "email_exists" || error?.code === "user_already_exists";
  if (error && !existed) return { error: "No se pudo crear la cuenta." };
  const { error: grant } = await sb.from("admins").upsert({ email });
  if (grant) return { error: "No se pudo dar el acceso." };
  refresh();
  return existed ? { ok: `${email} ya tenía cuenta: ahora puede entrar al panel con su contraseña.` } : { ok: email, password };
}

// Quita el acceso y borra la cuenta, para que no queden credenciales sin uso.
export async function removeAdmin(email: string) {
  const me = await requireAdmin();
  if (email === me) return;
  const sb = db();
  await sb.from("admins").delete().eq("email", email);
  // ponytail: busca en la primera página de usuarios; alcanza para un equipo de pocas personas
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (user) await sb.auth.admin.deleteUser(user.id);
  refresh();
}

export async function saveAlertEmails(_: FormResult, form: FormData): Promise<FormResult> {
  await requireAdmin();
  const emails = [...new Set(String(form.get("emails") ?? "").toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const bad = emails.filter((e) => !isEmail(e));
  if (bad.length) return { error: `Revisa: ${bad.join(", ")}` };
  const { error } = await db().from("settings").update({ alert_emails: emails }).eq("id", true);
  if (error) return { error: "No se pudo guardar." };
  refresh();
  return { ok: emails.length ? "Guardado." : "Guardado. Nadie recibirá alertas." };
}

export async function changePassword(_: FormResult, form: FormData): Promise<FormResult> {
  const email = await requireAdmin();
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (next !== form.get("confirm")) return { error: "Las contraseñas nuevas no coinciden." };
  // Se pide la actual para que una sesión abierta en otro equipo no baste para cambiarla.
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({ email, password: String(form.get("current") ?? "") });
  if (wrong) return { error: "La contraseña actual no es correcta." };
  const { error } = await (await authClient()).auth.updateUser({ password: next });
  if (error) return { error: error.code === "same_password" ? "La nueva contraseña debe ser distinta de la actual." : "No se pudo cambiar la contraseña." };
  return { ok: "Contraseña actualizada." };
}
