import { getConfig } from "@/lib/config";

/*
 * Envoi d'e-mails par l'API HTTP de Resend (https://resend.com).
 * Une simple requête fetch : fonctionne sur Vercel, Cloudflare, Netlify, Docker, VPS.
 * Sans clé, rien n'est envoyé et le journal l'indique (« simulé »).
 */

export type MailResult = { status: "envoye" | "echec" | "simule"; id?: string; error?: string };

export async function sendEmail(input: { to: string; subject: string; html: string; replyTo?: string; idempotencyKey?: string }): Promise<MailResult> {
  const config = await getConfig();
  if (!config.resendApiKey || !config.emailFrom) {
    return { status: "simule", error: "Aucun service d'e-mail configuré (Studio → Installation)." };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) return { status: "echec", error: body.message || `Erreur ${response.status}` };
    return { status: "envoye", id: body.id };
  } catch (error) {
    return { status: "echec", error: error instanceof Error ? error.message : "Erreur réseau" };
  }
}
