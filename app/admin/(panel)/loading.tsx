// Se muestra al instante al cambiar de sección mientras llegan los datos de la página.
export default function Loading() {
  const block = "rounded-2xl bg-muted motion-safe:animate-pulse";
  return (
    <div role="status" className="flex flex-col gap-8">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-4 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-10 w-72 max-w-full rounded-lg bg-muted motion-safe:animate-pulse" />
      </div>
      <div aria-hidden className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-28 ${block}`} />
        ))}
      </div>
      <div aria-hidden className={`h-72 ${block}`} />
    </div>
  );
}
