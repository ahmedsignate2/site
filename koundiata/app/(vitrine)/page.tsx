import { visibleContent } from "@/lib/content";
import { HomeSections } from "@/components/store/view";

export default async function HomePage() {
  const { content } = await visibleContent();
  return <HomeSections content={content} />;
}
