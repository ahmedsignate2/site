import { visibleContent } from "@/lib/content";
import { CheckoutView } from "@/components/store/view";

export const metadata = { title: "Commande" };

export default async function Page() {
  const { content } = await visibleContent();
  return <CheckoutView content={content} />;
}
