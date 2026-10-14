import { visibleContent } from "@/lib/content";
import { ShopView } from "@/components/store/view";

export const metadata = { title: "Boutique" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tri?: string }> }) {
  const { content } = await visibleContent();
  const { tri } = await searchParams;
  return <ShopView content={content} sort={tri} />;
}
