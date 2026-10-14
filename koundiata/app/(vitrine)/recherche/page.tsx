import { visibleContent } from "@/lib/content";
import { SearchView } from "@/components/store/view";

export const metadata = { title: "Recherche" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { content } = await visibleContent();
  const { q } = await searchParams;
  return <SearchView content={content} query={q ?? ""} />;
}
