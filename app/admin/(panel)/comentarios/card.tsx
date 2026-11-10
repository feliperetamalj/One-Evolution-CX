import { Button } from "@/components/ui/button";
import {
  CASE_STATUS, PLANS, caseStatus, hoursSince, isCase, isOverdue, segment, themesOf,
  type CaseFields, type CaseStatus, type PlanKey, type Segment,
} from "@/lib/survey";
import { cn } from "@/lib/utils";
import { flagCase, setCaseStatus } from "../../actions";
import { SEGMENT_COLORS } from "../charts";
import { day } from "../ui";
import { CaseNote } from "./forms";

export type Reply = CaseFields & {
  invitation_id: string;
  comment: string | null;
  followup_note: string | null;
  invitations: { wave_id: number; plan: PlanKey | null; clients: { full_name: string; email: string | null; phone: string | null } };
  csat_scores: { item: string; score: number }[];
};
export const REPLY_FIELDS =
  "invitation_id, nps, comment, contact_ok, flagged, followed_up_at, closed_at, followup_note, created_at, " +
  "invitations!inner(wave_id, plan, clients(full_name, email, phone)), csat_scores(item, score)";

export const SEG_LABEL: Record<Segment, string> = { detractor: "Detractor", pasivo: "Pasivo", promotor: "Promotor" };
export const SEG_COLOR: Record<Segment, string> = { detractor: SEGMENT_COLORS.detractores, pasivo: SEGMENT_COLORS.pasivos, promotor: SEGMENT_COLORS.promotores };

const ago = (iso: string) => {
  const h = Math.floor(hoursSince(iso));
  return h < 48 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} días`;
};

// Tarjeta de una respuesta. `loop` agrega la nota editable del seguimiento.
export function ReplyCard({ r, labels, loop }: { r: Reply; labels: Record<string, string>; loop?: boolean }) {
  const s = segment(r.nps);
  const who = r.invitations.clients;
  const themes = r.comment ? themesOf(r.comment) : [];
  const low = r.csat_scores.filter((x) => x.score <= 2).sort((a, b) => a.score - b.score);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full" style={{ background: SEG_COLOR[s] }} aria-hidden />
            {SEG_LABEL[s]} · {r.nps}/10
          </span>
          <span className="text-muted-foreground">
            {r.invitations.plan ? PLANS[r.invitations.plan] : "Sin plan"} · Ola {r.invitations.wave_id} · {day(r.created_at)}
          </span>
        </div>
        {isCase(r) && <StatusBadge r={r} />}
      </div>

      {r.comment ? <p className="text-pretty">“{r.comment}”</p> : <p className="text-sm text-muted-foreground">Sin comentario.</p>}

      {(themes.length > 0 || low.length > 0) && (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {themes.map((k) => (
            <li key={k} className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {labels[k]}
            </li>
          ))}
          {low.map((x) => (
            <li key={x.item} className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
              {labels[x.item] ?? x.item} {x.score}/5
            </li>
          ))}
        </ul>
      )}

      {loop ? (
        <CaseNote id={r.invitation_id} note={r.followup_note} />
      ) : (
        r.followup_note && <p className="text-sm text-pretty text-muted-foreground">Nota: {r.followup_note}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
        {r.contact_ok ? (
          <span>
            {who.full_name}
            {who.phone && (
              <a href={`https://wa.me/${who.phone}`} className="ml-2 text-brand underline-offset-4 hover:underline">
                WhatsApp
              </a>
            )}
            {who.email && (
              <a href={`mailto:${who.email}`} className="ml-2 text-brand underline-offset-4 hover:underline">
                Email
              </a>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Cliente confidencial</span>
        )}
        <CaseActions r={r} />
      </div>
    </li>
  );
}

function StatusBadge({ r }: { r: Reply }) {
  const status = caseStatus(r);
  const late = isOverdue(r);
  const text =
    status === "pendiente" ? `${late ? "Atrasado" : CASE_STATUS.pendiente} · ${ago(r.created_at)}`
    : status === "contactado" ? `${CASE_STATUS.contactado} · desde el ${day(r.followed_up_at!)}`
    : `${CASE_STATUS.cerrado} el ${day(r.closed_at!)}`;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "pendiente" && (late ? "bg-destructive/15 text-destructive" : "bg-brand/15 text-brand"),
        status === "contactado" && "bg-muted text-foreground",
        status === "cerrado" && "bg-success/15 text-success",
      )}
    >
      {text}
    </span>
  );
}

function Act({ action, children, variant = "secondary" }: { action: () => Promise<void>; children: React.ReactNode; variant?: "secondary" | "ghost" | "default" }) {
  return (
    <form action={action}>
      <Button variant={variant}>{children}</Button>
    </form>
  );
}

function CaseActions({ r }: { r: Reply }) {
  if (!r.contact_ok) return null;
  const id = r.invitation_id;
  const to = (s: CaseStatus) => setCaseStatus.bind(null, id, s);
  if (!isCase(r)) return <Act action={flagCase.bind(null, id, true)} variant="ghost">Hacer seguimiento</Act>;
  const status = caseStatus(r);
  return (
    <div className="flex flex-wrap gap-2">
      {status === "pendiente" && r.flagged && r.nps > 6 && <Act action={flagCase.bind(null, id, false)} variant="ghost">Quitar del seguimiento</Act>}
      {status === "pendiente" && <Act action={to("contactado")} variant="default">Marcar contactado</Act>}
      {status === "contactado" && <Act action={to("pendiente")} variant="ghost">Deshacer</Act>}
      {status === "contactado" && <Act action={to("cerrado")}>Cerrar caso</Act>}
      {status === "cerrado" && <Act action={to("contactado")} variant="ghost">Reabrir</Act>}
    </div>
  );
}
