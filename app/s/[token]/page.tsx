import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { closeDate } from "@/lib/invites";
import { db, isUuid } from "@/lib/supabase";
import type { Answer } from "./actions";
import { SurveyForm } from "./survey-form";

export const metadata = { title: "Tu experiencia en ONE" };

type Invitation = {
  clients: { full_name: string };
  waves: { closes_at: string };
  responses: { nps: number; comment: string | null; contact_ok: boolean; csat_scores: { item: string; score: number }[] } | null;
};

export default function Page({ params }: PageProps<"/s/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-8 sm:px-6">
      <Logo className="mx-auto mb-10 w-24" />
      <Suspense fallback={<p className="text-center text-muted-foreground">Cargando tu encuesta…</p>}>
        <Survey params={params} />
      </Suspense>
    </main>
  );
}

async function Survey({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: inv } = isUuid(token)
    ? await db()
        .from("invitations")
        .select("clients(full_name), waves(closes_at), responses(nps, comment, contact_ok, csat_scores(item, score))")
        .eq("id", token)
        .maybeSingle<Invitation>()
    : { data: null };

  if (!inv)
    return (
      <Notice title="Este link no es válido">
        Revisa que lo hayas abierto completo desde el email, o escríbenos y te enviamos uno nuevo.
      </Notice>
    );

  const closes = new Date(inv.waves.closes_at);
  if (closes <= new Date())
    return (
      <Notice title="Esta encuesta ya cerró">
        Gracias por tu interés. La próxima te llegará en unos días.
      </Notice>
    );

  const r = inv.responses;
  const initial: Answer | null = r && {
    nps: r.nps,
    csat: Object.fromEntries(r.csat_scores.map((c) => [c.item, c.score])),
    comment: r.comment ?? "",
    contactOk: r.contact_ok,
  };

  return (
    <SurveyForm
      id={token}
      firstName={inv.clients.full_name.split(" ")[0]}
      closesAt={closeDate(inv.waves.closes_at)}
      initial={initial}
    />
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-sm text-pretty text-muted-foreground">{children}</p>
      <a href="https://wa.me/56956723743" className="mt-4 text-sm text-brand underline-offset-4 hover:underline">
        Escríbenos por WhatsApp
      </a>
    </div>
  );
}
