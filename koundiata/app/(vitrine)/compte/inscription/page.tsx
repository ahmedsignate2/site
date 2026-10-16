import { redirect } from "next/navigation";
import { CustomerRegisterForm } from "@/components/store/account";
import { currentCustomer } from "@/lib/customer-auth";

export const metadata = { title: "Créer un compte", robots: { index: false } };

function safe(next?: string) {
  return next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/studio") ? next : "/compte";
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentCustomer()) redirect(safe(next));
  return (
    <div className="wrap auth-page">
      <CustomerRegisterForm next={safe(next)} />
    </div>
  );
}
