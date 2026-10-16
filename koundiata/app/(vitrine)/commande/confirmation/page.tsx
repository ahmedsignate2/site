import { settleCheckoutReturn } from "@/lib/orders";
import { currentCustomer } from "@/lib/customer-auth";
import { formatPrice } from "@/lib/format";
import { ConfirmView } from "@/components/store/view";

export const metadata = { title: "Confirmation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; session_id?: string }> }) {
  const { id, session_id: sessionId } = await searchParams;
  const customer = await currentCustomer();
  const found = id ? await settleCheckoutReturn(id, sessionId) : null;
  // Seul le client de la commande voit sa confirmation.
  const order = found && customer && found.customerId === customer.id ? found : null;
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
