import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { signOut } from "../actions";

export const metadata = { title: "ONE · Panel de experiencia" };

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Link href="/admin" aria-label="Inicio del panel">
          <Logo className="w-20" />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-muted">
            Dashboard
          </Link>
          <Link href="/admin/clientes" className="rounded-lg px-3 py-2 hover:bg-muted">
            Clientes y olas
          </Link>
          <form action={signOut}>
            <button className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Salir</button>
          </form>
        </nav>
      </header>
      {/* Sin verificación aquí: layout y página se renderizan en paralelo y al navegar solo se pide la página.
          Cada página llama a requireAdmin(). */}
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>{children}</Suspense>
    </div>
  );
}
