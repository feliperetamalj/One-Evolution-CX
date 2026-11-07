import "server-only";

export type Email = { to: string; subject: string; html: string };

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Envía en lotes de 100 (máximo de Resend por llamada). Devuelve false si algún lote falla.
export async function sendEmails(emails: Email[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !emails.length) {
    if (!key) console.warn(`RESEND_API_KEY no configurada: ${emails.length} email(s) sin enviar`);
    return false;
  }
  for (let i = 0; i < emails.length; i += 100) {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(emails.slice(i, i + 100).map((e) => ({ from: process.env.EMAIL_FROM, ...e }))),
    });
    if (!res.ok) {
      console.error("Resend", res.status, await res.text());
      return false;
    }
  }
  return true;
}

// Plantilla con la marca: fondo negro, texto hueso, un solo botón.
export function brandEmail({ title, body, cta }: { title: string; body: string; cta?: { label: string; url: string } }) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0b0b0b;color:#edede8;font-family:Inter,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" style="max-width:480px"><tr><td>
<p style="margin:0 0 32px;font:700 28px/1 Helvetica,Arial,sans-serif;letter-spacing:2px">ONE</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600">${title}</h1>
<div style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#c9c9c4">${body}</div>
${cta ? `<a href="${cta.url}" style="display:inline-block;background:#edede8;color:#0b0b0b;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px">${cta.label}</a>` : ""}
<p style="margin:40px 0 0;font-size:12px;color:#8a8a8a;letter-spacing:3px">YOUR EVOLUTION · ALTO LAS RASTRAS, TALCA</p>
</td></tr></table></td></tr></table></body></html>`;
}
