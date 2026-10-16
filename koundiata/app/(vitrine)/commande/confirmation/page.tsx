import { settleCheckoutReturn } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { ConfirmView } from "@/components/store/view";

export const metadata = { title: "Confirmation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; session_id?: string }> }) {
  const { id, session_id: sessionId } = await searchParams;
  const order = id ? await settleCheckoutReturn(id, sessionId) : null;
  if (!order) {
    return (
      <div className="wrap article">
        <h1 className="page-title">Commande introuvable</h1>
      </div>
    );
  }
  const paid = order.status === "payee" || order.status === "preparation" || order.status === "expediee" || order.status === "livree";
  return <ConfirmView id={order.id} total={formatPrice(order.total)} paid={paid} simulated={order.payment?.provider !== "stripe"} />;
}
