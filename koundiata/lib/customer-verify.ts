import { createHash } from "crypto";
import { queueAutomation } from "@/lib/automation";
import { siteOrigin } from "@/lib/origin";
import { updateStore } from "@/lib/store";

/** Valide le lien reçu par e-mail. Appelé par la page /compte/verifier (pas un point d'accès du navigateur). */
export async function verifyCustomerEmail(email: string, token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  let result = "invalid" as "ok" | "already" | "invalid";
  let name = "";
  await updateStore((data) => {
    const customer = data.customers?.find((item) => item.email === email.trim().toLowerCase());
    if (!customer) return;
    if (customer.emailVerified) {
      result = "already";
      return;
    }
    const match = customer.tokens?.find((item) => item.kind === "verify" && item.hash === hash && new Date(item.expiresAt) > new Date());
    if (!match) return;
    customer.emailVerified = true;
    customer.tokens = customer.tokens?.filter((item) => item.kind !== "verify");
    name = customer.firstName;
    result = "ok";
  });
  if (result === "ok") {
    queueAutomation("customer.welcome", email, { customer_name: name, account_url: `${await siteOrigin()}/compte` });
  }
  return result;
}
