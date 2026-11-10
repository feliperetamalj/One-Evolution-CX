"use client";

import { LayoutDashboard, ListChecks, LoaderCircle, MessageSquareText, Settings, Users } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/comentarios", label: "Comentarios", short: "Comentarios", icon: MessageSquareText },
  { href: "/admin/clientes", label: "Clientes y olas", short: "Clientes", icon: Users },
  { href: "/admin/preguntas", label: "Banco de preguntas", short: "Preguntas", icon: ListChecks },
  { href: "/admin/configuracion", label: "Configuración", short: "Ajustes", icon: Settings },
];

function useIsActive() {
  const path = usePathname();
  return (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
}

// Spinner del ítem tocado mientras la sección no está precargada; siempre montado para no mover el layout.
function Pending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return <LoaderCircle aria-hidden className={cn("size-4 transition-opacity", pending ? "animate-spin opacity-100" : "opacity-0", className)} />;
}

// Escritorio: menú vertical; el fondo del ítem activo se desliza al cambiar de página.
export function SideNav() {
  const isActive = useIsActive();
  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label="Panel" className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-muted"
                  transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                />
              )}
              <Icon className={cn("relative size-5 shrink-0", active && "text-brand")} aria-hidden />
              <span className="relative">{label}</span>
              <Pending className="relative ml-auto text-muted-foreground" />
            </Link>
          );
        })}
      </nav>
    </MotionConfig>
  );
}

// Móvil: barra inferior translúcida, al alcance del pulgar.
export function TabBar() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Panel"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {ITEMS.map(({ href, short, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("size-5", active && "text-brand")} aria-hidden />
            {short}
            <Pending className="absolute top-2 right-[calc(50%-1.5rem)] size-3.5 text-muted-foreground" />
          </Link>
        );
      })}
    </nav>
  );
}
