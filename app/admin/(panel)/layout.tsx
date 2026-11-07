import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { signOut } from "../actions";
import { SideNav, TabBar } from "./nav";

export const metadata = { title: "ONE · Panel de experiencia" };

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border px-3 py-6 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-10">
        <Link href="/admin" aria-label="Inicio del panel" className="px-3">
          <Logo className="w-20" />
        </Link>
        <SideNav />
        <form action={signOut} className="mt-auto">
          <button className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <LogOut className="size-5" aria-hidden />
            Salir
          </button>
        </form>
      </aside>

      <header className="flex items-center justify-between px-4 pt-5 md:hidden">
        <Link href="/admin" aria-label="Inicio del panel">
          <Logo className="w-16" />
        </Link>
        <form action={signOut}>
          <button aria-label="Salir" className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:px-10 md:pt-10 md:pb-16">
        {/* Sin verificación aquí: layout y página se renderizan en paralelo y al navegar solo se pide la página.
            Cada página llama a requireAdmin(). */}
        <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>{children}</Suspense>
      </main>

      <TabBar />
    </div>
  );
}
