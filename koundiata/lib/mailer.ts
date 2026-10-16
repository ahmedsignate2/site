import { getConfig } from "@/lib/config";

/*
 * Envoi d'e-mails par l'API HTTP de Resend (https://resend.com).
 * Une simple requête fetch : fonctionne sur Vercel, Cloudflare, Netlify, Docker, VPS.
 * Sans clé, rien n'est envoyé et le journal l'indique (« simulé »).
 */

export type MailResult = { status: "envoye" | "echec" | "simule"; id?: string; error?: string };

export async function sendEmail(input: { to: string; subject: string; html: string; replyTo?: string; idempotencyKey?: string }): Promise<MailResult> {
  const config = await getConfig();
  if (!config.resendApiKey) {
    return { status: "simule", error: "Aucun service d'e-mail configuré : ajoutez la clé Resend dans Studio → Installation." };
  }
  // Sans domaine vérifié, Resend fournit une adresse de test (elle n'écrit qu'au titulaire du compte Resend).
  const from = config.emailFrom || "Boutique <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) return { status: "echec", error: explainResendError(response.status, body.message) };
    return { status: "envoye", id: body.id };
  } catch (error) {
    return { status: "echec", error: `Impossible de joindre Resend (${error instanceof Error ? error.message : "erreur réseau"}).` };
  }
}

function explainResendError(status: number, message = "") {
  const text = message.toLowerCase();
  if (status === 401 || text.includes("api key is invalid")) return "Clé Resend invalide : vérifiez-la dans Studio → Installation.";
  if (text.includes("only send testing emails") || text.includes("verify a domain")) {
    return "Resend est en mode test : il n'envoie qu'à l'adresse de votre compte Resend. Vérifiez votre domaine sur resend.com/domains puis indiquez un expéditeur de ce domaine (ex. Boutique <bonjour@votredomaine.fr>).";
  }
  if (text.includes("domain is not verified") || text.includes("not verified")) {
    return "Le domaine de l'expéditeur n'est pas vérifié chez Resend (resend.com/domains).";
  }
  if (status === 429) return "Trop d'envois en même temps chez Resend : réessayez dans un instant.";
  if (status === 422) return `Adresse refusée par Resend : ${message}`;
  return message || `Erreur Resend ${status}`;
}
