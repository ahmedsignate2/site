import { visibleContent } from "@/lib/content";
import { ContactView } from "@/components/store/view";

export const metadata = { title: "Contact" };

export default async function Page() {
  const { content } = await visibleContent();
  return <ContactView content={content} />;
}
