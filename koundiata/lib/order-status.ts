import type { OrderStatus } from "@/lib/types";

export const orderStatusLabel: Record<OrderStatus, string> = {
  en_attente: "En attente de paiement",
  payee: "Payée",
  preparation: "Préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  echouee: "Paiement échoué",
};

export function countsAsSale(status: OrderStatus) {
  return status === "payee" || status === "preparation" || status === "expediee" || status === "livree";
}
