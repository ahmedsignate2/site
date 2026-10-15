import { releaseUnpaidOrder } from "@/lib/actions";
import { visibleContent } from "@/lib/content";
import { stripeEnabled } from "@/lib/payment";
import { CheckoutView } from "@/components/store/view";

export const metadata = { title: "Commande" };

export default async function Page({ searchParams }: { searchParams: Promise<{ annulee?: string; commande?: string }> }) {
  const { annulee, commande } = await searchParams;
  if (annulee === "1" && commande) await releaseUnpaidOrder(commande);
  const { content } = await visibleContent();
  return <CheckoutView content={content} paymentsLive={stripeEnabled()} />;
}
