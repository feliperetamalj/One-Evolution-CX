import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-16 text-center">
      <Logo className="w-44 text-foreground" />

      <div className="flex max-w-md flex-col items-center gap-5">
        <p className="text-eyebrow text-brand">Experiencia ONE</p>
        <h1 className="text-display">Tu opinión mueve tu evolución</h1>
        <p className="text-pretty text-muted-foreground">
          La encuesta se abre desde el link personal que te enviamos por email.
          Si no lo encuentras, escríbenos y te lo reenviamos.
        </p>
      </div>

      <a href="https://wa.me/56956723743" className={buttonVariants({ size: "lg" })}>
        Escríbenos por WhatsApp
      </a>
    </main>
  );
}
