// Pie de todas las páginas. En el panel, en el móvil, deja espacio para la barra inferior fija (data-tabbar).
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground in-[body:has([data-tabbar])]:pb-24 md:in-[body:has([data-tabbar])]:pb-6">
      <span>Todos los derechos reservados © ONE Your Evolution 2026</span>
      <span>© RB Software Solutions 2026</span>
    </footer>
  );
}
