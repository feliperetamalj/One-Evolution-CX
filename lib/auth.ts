import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./supabase";

// Sesión del panel (Supabase Auth, email + contraseña) guardada en cookies.
export async function authClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // En Server Components no se pueden escribir cookies; proxy.ts refresca la sesión.
        }
      },
    },
  });
}

// Para páginas y Server Actions del panel: exige sesión y que el email esté en `admins`.
export async function requireAdmin() {
  const { data } = await (await authClient()).auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) redirect("/admin/login");
  const { data: admin } = await db().from("admins").select("email").eq("email", email).maybeSingle();
  if (!admin) redirect("/admin/login?e=sin-acceso");
  return email;
}
