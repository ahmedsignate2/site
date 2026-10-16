import { cancelCheckout } from "@/lib/orders";
import { visibleContent } from "@/lib/content";
import { stripeEnabled } from "@/lib/payment";
import { CheckoutView } from "@/components/store/view";
import { redirect } from "next/navigation";
import { currentCustomer, toPublicCustomer } from "@/lib/customer-auth";

export const metadata = { title: "Commande" };

export default async function Page({ searchParams }: { searchParams: Promise<{ annulee?: string; commande?: string; jeton?: string }> }) {
  const { annulee, commande, jeton } = await searchParams;
  if (annulee === "1" && commande && jeton) await cancelCheckout(commande, jeton);
  const customer = await currentCustomer();
  if (!customer) redirect("/compte/connexion?next=/commande");
  const { content } = await visibleContent();
  return <CheckoutView content={content} paymentsLive={await stripeEnabled()} customer={toPublicCustomer(customer)} />;
}
