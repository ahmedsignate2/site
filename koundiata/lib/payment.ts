import type { PaymentRecord } from "@/lib/types";

/**
 * Seul point de passage du paiement.
 * Le mode actuel n'appelle aucune banque.
 * Pour encaisser vraiment, ce module devra créer un paiement Stripe
 * et ne confirmer la commande qu'une fois le paiement autorisé.
 */
export const paymentMode = {
  provider: "simulated" as const,
  notice: "Paiement simulé : aucune carte n'est débitée. L'encaissement bancaire sera branché ensuite.",
};

export async function authorizePayment(amountCents: number, orderId: string): Promise<PaymentRecord> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Le montant à encaisser est invalide.");
  }
  return {
    provider: paymentMode.provider,
    status: "authorized",
    reference: `sim_${orderId}`,
  };
}
