import { currentWave, sendInvites } from "@/lib/invites";
import { db } from "@/lib/supabase";

const DAY = 864e5;

// Vercel Cron, una vez al día (vercel.json). Vercel envía "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Esta consulta diaria también evita que Supabase Free pause el proyecto por inactividad.
  let wave = await currentWave();
  let opened: number | null = null;

  // La primera ola se abre a mano desde /admin/clientes; desde ahí, una cada 14 días.
  // 13,5 días de margen porque el cron de Vercel puede correr en cualquier minuto de la hora.
  if (wave && Date.now() - Date.parse(wave.opens_at) >= 13.5 * DAY) {
    const { data, error } = await db().rpc("open_wave");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    opened = data;
    wave = await currentWave();
  }

  const sent = wave ? await sendInvites(wave) : null;
  return Response.json({ wave: wave?.id ?? null, opened, ...sent });
}
