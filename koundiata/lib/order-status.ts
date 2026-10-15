import type { OrderStatus } from "@/lib/types";

export const orderStatusLabel: Record<OrderStatus, string> = {
  en_attente: "En attente de paiement",
  payee: "Payée",
  preparation: "Préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  echouee: "Paiement échoué",
  remboursee_partiel: "Remboursée partiellement",
  remboursee_total: "Remboursée totalement",
};

export function countsAsSale(status: OrderStatus) {
  return status === "payee" || status === "preparation" || status === "expediee" || status === "livree";
}
