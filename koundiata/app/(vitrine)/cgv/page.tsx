import { visibleContent } from "@/lib/content";
import { Article } from "@/components/store/view";

export const metadata = { title: "Conditions de vente" };

export default async function Page() {
  const { content } = await visibleContent();
  return <Article page={content.cgv} />;
}
