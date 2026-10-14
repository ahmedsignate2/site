import { getOrder } from "@/lib/actions";
import { formatPrice } from "@/lib/format";
import { ConfirmView } from "@/components/store/view";

export const metadata = { title: "Confirmation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const order = id ? await getOrder(id) : null;
  if (!order) {
    return (
      <div className="wrap article">
        <h1 className="page-title">Commande introuvable</h1>
      </div>
    );
  }
  return <ConfirmView id={order.id} total={formatPrice(order.total)} />;
}
