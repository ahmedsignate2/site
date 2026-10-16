import { cancelCheckout } from "@/lib/orders";
import { visibleContent } from "@/lib/content";
import { stripeEnabled } from "@/lib/payment";
import { CheckoutView } from "@/components/store/view";

export const metadata = { title: "Commande" };

export default async function Page({ searchParams }: { searchParams: Promise<{ annulee?: string; commande?: string; jeton?: string }> }) {
  const { annulee, commande, jeton } = await searchParams;
  if (annulee === "1" && commande && jeton) await cancelCheckout(commande, jeton);
  const { content } = await visibleContent();
  return <CheckoutView content={content} paymentsLive={stripeEnabled()} />;
}
