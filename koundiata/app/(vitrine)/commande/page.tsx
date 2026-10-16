import { cancelCheckout } from "@/lib/orders";
import { visibleContent } from "@/lib/content";
import { stripeEnabled } from "@/lib/payment";
import { CheckoutView } from "@/components/store/view";
import { redirect } from "next/navigation";
import { currentCustomer, toPublicCustomer } from "@/lib/customer-auth";
import { mailEnabled } from "@/lib/config";
import { VerifyNotice } from "@/components/store/account";

export const metadata = { title: "Commande" };

export default async function Page({ searchParams }: { searchParams: Promise<{ annulee?: string; commande?: string; jeton?: string }> }) {
  const { annulee, commande, jeton } = await searchParams;
  if (annulee === "1" && commande && jeton) await cancelCheckout(commande, jeton);
  const customer = await currentCustomer();
  if (!customer) redirect("/compte/connexion?next=/commande");
  if (!customer.emailVerified && (await mailEnabled())) {
    return (
      <div className="wrap auth-page">
        <div className="auth-card">
          <h1 className="page-title">Encore une étape</h1>
          <VerifyNotice email={customer.email} blocking />
          <p className="note">Une fois l&apos;adresse confirmée, revenez sur cette page : votre panier est conservé.</p>
        </div>
      </div>
    );
  }
  const { content } = await visibleContent();
  return <CheckoutView content={content} paymentsLive={await stripeEnabled()} customer={toPublicCustomer(customer)} />;
}
