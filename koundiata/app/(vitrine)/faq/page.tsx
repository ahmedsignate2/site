import { visibleContent } from "@/lib/content";
import { FaqView } from "@/components/store/view";

export const metadata = { title: "Questions fréquentes" };

export default async function Page() {
  const { content } = await visibleContent();
  return <FaqView content={content} />;
}
