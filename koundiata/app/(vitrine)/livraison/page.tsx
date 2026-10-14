import { visibleContent } from "@/lib/content";
import { Article } from "@/components/store/view";

export const metadata = { title: "Livraison et retours" };

export default async function Page() {
  const { content } = await visibleContent();
  return <Article page={content.shipping} />;
}
