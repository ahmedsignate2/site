import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/store/account";
import { visibleContent } from "@/lib/content";
import { currentCustomer, toPublicCustomer } from "@/lib/customer-auth";
import { ordersForCustomer } from "@/lib/customer-orders";

export const metadata = { title: "Mon compte", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const customer = await currentCustomer();
  if (!customer) redirect("/compte/connexion?next=/compte");
  const { onglet } = await searchParams;
  const { content } = await visibleContent();
  return <AccountDashboard customer={toPublicCustomer(customer)} orders={await ordersForCustomer(customer)} products={content.products} initialTab={onglet} />;
}
