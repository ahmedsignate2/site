import { notFound } from "next/navigation";
import { categoryBySlug } from "@/lib/catalog";
import { visibleContent } from "@/lib/content";
import { ShopView } from "@/components/store/view";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ tri?: string }>;
}) {
  const { content } = await visibleContent();
  const { category } = await params;
  const { tri } = await searchParams;
  if (!categoryBySlug(content, category)) notFound();
  return <ShopView content={content} categorySlug={category} sort={tri} />;
}
