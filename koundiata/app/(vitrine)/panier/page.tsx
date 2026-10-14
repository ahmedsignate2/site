import { visibleContent } from "@/lib/content";
import { CartView } from "@/components/store/view";

export const metadata = { title: "Panier" };

export default async function Page() {
  const { content } = await visibleContent();
  return <CartView content={content} />;
}
