import { visibleContent } from "@/lib/content";
import { Article } from "@/components/store/view";

export const metadata = { title: "Confidentialité" };

export default async function Page() {
  const { content } = await visibleContent();
  return <Article page={content.privacy} />;
}
