import { requireAdmin } from "@/lib/auth";
import { currentWave, surveyUrl } from "@/lib/invites";
import { db } from "@/lib/supabase";
import { isPhone } from "@/lib/survey";

type Row = { id: string; clients: { full_name: string; phone: string | null } };

// CSV con el link personal de cada invitado de la ola, para enviarlos por WhatsApp desde otro número o agente.
// /admin/clientes/enlaces (ola actual) o ?ola=N. Solo quienes tienen un celular válido: uno malo haría fallar el envío.
export async function GET(request: Request) {
  await requireAdmin();
  const n = Number(new URL(request.url).searchParams.get("ola"));
  const wave = Number.isInteger(n) && n > 0 ? n : (await currentWave())?.id;
  if (!wave) return new Response("Aún no hay olas.", { status: 404 });

  const { data } = await db().from("invitations").select("id, clients(full_name, phone)").eq("wave_id", wave).returns<Row[]>();
  const rows = (data ?? [])
    .filter((i) => i.clients.phone && isPhone(i.clients.phone))
    .sort((a, b) => a.clients.full_name.localeCompare(b.clients.full_name))
    .map((i) => [i.clients.full_name, i.clients.phone!, surveyUrl(i.id)]);

  const cell = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const csv = [["Nombre", "Telefono", "Enlace"], ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // BOM: Excel abre bien las tildes en UTF-8.
  return new Response("﻿" + csv + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ONE-ola-${wave}-enlaces.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
