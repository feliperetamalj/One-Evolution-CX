import { ChevronDown, RotateCcw, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { QUESTIONS_PER_CATEGORY as LIMIT, type Category } from "@/lib/survey";
import { setQuestionActive } from "../../actions";
import { AddQuestion } from "./forms";

export const metadata = { title: "ONE · Banco de preguntas" };

type Question = { id: number; category: string; text: string; active: boolean };
type Stat = { question_id: number; n: number; top2: number };

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

export default async function Preguntas() {
  await requireAdmin();
  const sb = db();
  const [{ data: categories }, { data: questions }, { data: stats }] = await Promise.all([
    sb.from("csat_categories").select("key, label").order("position").returns<Category[]>(),
    sb.from("questions").select("id, category, text, active").order("id").returns<Question[]>(),
    sb.from("question_stats").select("question_id, n, top2").returns<Stat[]>(),
  ]);
  const statOf = new Map((stats ?? []).map((s) => [s.question_id, s]));
  const result = (id: number) => {
    const s = statOf.get(id);
    return s ? `${Math.round((100 * s.top2) / s.n)} % satisfechos · ${s.n} respuestas` : "Sin respuestas aún";
  };
  // % satisfechos de la categoría: suma las respuestas de sus preguntas activas.
  const overall = (qs: Question[]) => {
    const [n, top2] = qs.reduce(([n, t], q) => [n + (statOf.get(q.id)?.n ?? 0), t + (statOf.get(q.id)?.top2 ?? 0)], [0, 0]);
    return n ? `${Math.round((100 * top2) / n)} % satisfechos` : "Sin respuestas aún";
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-eyebrow text-brand">Encuesta</p>
        <h1 className="text-display !text-4xl">Banco de preguntas</h1>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          Cada encuesta pregunta por las {categories?.length ?? 8} categorías, con 1 pregunta de cada una elegida al azar y sin
          repetirle a un cliente la de la vez anterior. Cada categoría tiene entre {LIMIT.min} y {LIMIT.max} preguntas. Los cambios
          corren desde la próxima ola, y quitar una pregunta no borra sus respuestas. Toca una categoría para ver y editar sus
          preguntas.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {(categories ?? []).map((c) => {
          const all = (questions ?? []).filter((q) => q.category === c.key);
          const active = all.filter((q) => q.active);
          const removed = all.filter((q) => !q.active);
          return (
            // details nativo: abre y cierra sin JS y conserva su estado al refrescar tras añadir o quitar.
            <details key={c.key} className="group rounded-2xl border border-border bg-card open:border-ring/40">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold font-sans">{c.label}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{overall(active)}</p>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {active.length} de {LIMIT.max} preguntas
                </span>
                <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>

              <div className="flex flex-col gap-3 border-t border-border px-4 pt-2 pb-4 sm:px-5">
                <ul className="flex flex-col divide-y divide-border">
                  {active.map((q) => (
                    <li key={q.id} className="flex items-center gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-pretty">{q.text}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{result(q.id)}</p>
                      </div>
                      <form action={setQuestionActive.bind(null, q.id, false)}>
                        <button
                          disabled={active.length <= LIMIT.min}
                          aria-label={`Quitar «${q.text}»`}
                          title={active.length <= LIMIT.min ? `Mínimo ${LIMIT.min}: añade otra antes de quitar` : "Quitar"}
                          className={iconButton}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>

                {active.length < LIMIT.max ? (
                  <AddQuestion category={c.key} label={c.label} />
                ) : (
                  <p className="text-xs text-muted-foreground">Llegaste al máximo de {LIMIT.max}. Quita una para añadir otra.</p>
                )}

                {removed.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Quitadas ({removed.length})</summary>
                    <ul className="mt-2 flex flex-col divide-y divide-border">
                      {removed.map((q) => (
                        <li key={q.id} className="flex items-center gap-2 py-1.5 text-muted-foreground">
                          <div className="min-w-0 flex-1">
                            <p className="text-pretty">{q.text}</p>
                            <p className="mt-0.5 text-xs">{result(q.id)}</p>
                          </div>
                          <form action={setQuestionActive.bind(null, q.id, true)}>
                            <button disabled={active.length >= LIMIT.max} aria-label={`Restaurar «${q.text}»`} title="Restaurar" className={iconButton}>
                              <RotateCcw className="size-4" aria-hidden />
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
