import { notFound } from "next/navigation";
import { productBySlug } from "@/lib/catalog";
import { visibleContent } from "@/lib/content";
import { ProductView } from "@/components/store/view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { content } = await visibleContent();
  const { slug } = await params;
  const product = productBySlug(content, slug);
  return { title: product?.name ?? "Produit", description: product?.subtitle };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { content } = await visibleContent();
  const { slug } = await params;
  const product = productBySlug(content, slug);
  if (!product) notFound();
  return <ProductView content={content} product={product} />;
}
