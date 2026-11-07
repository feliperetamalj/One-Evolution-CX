import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "ONE · Panel" };

export default function Login({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-4 py-16">
      <Logo className="mx-auto w-28" />
      <div className="flex flex-col gap-2 text-center">
        <p className="text-eyebrow text-brand">Panel de experiencia</p>
        <h1 className="text-2xl font-semibold font-sans">Ingresa a tu cuenta</h1>
      </div>
      <Suspense>
        <NoAccess searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </main>
  );
}

async function NoAccess({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const { e } = await searchParams;
  if (e !== "sin-acceso") return null;
  return (
    <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      Tu cuenta no tiene acceso al panel. Pide que agreguen tu email a la lista de administradores.
    </p>
  );
}
