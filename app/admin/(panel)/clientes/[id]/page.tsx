import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db, isUuid } from "@/lib/supabase";
import { EditClient } from "../forms";

export const metadata = { title: "ONE · Editar cliente" };

export default async function EditarCliente({ params }: PageProps<"/admin/clientes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: client } = await db().from("clients").select("id, full_name, email, phone, plan, active").eq("id", id).maybeSingle();
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/admin/clientes" className="-ml-1 inline-flex w-fit items-center gap-1 rounded-lg px-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Clientes y olas
        </Link>
        <p className="text-eyebrow text-brand">Editar cliente</p>
        <h1 className="text-display !text-4xl">{client.full_name}</h1>
        <p className="max-w-xl text-sm text-pretty text-muted-foreground">
          Los cambios no alteran su enlace de la ola actual ni sus respuestas anteriores. El plan de las olas ya abiertas se mantiene; el nuevo
          corre desde la próxima.
        </p>
      </header>
      <section className="rounded-2xl border border-border bg-card p-5">
        <EditClient client={client} />
      </section>
    </div>
  );
}
