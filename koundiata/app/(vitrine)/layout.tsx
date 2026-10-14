import type { ReactNode } from "react";
import { visibleContent } from "@/lib/content";
import { StoreShell } from "@/components/store/view";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { content } = await visibleContent();
  return {
    title: {
      default: `${content.settings.brandName} — ${content.settings.tagline}`,
      template: `%s — ${content.settings.brandName}`,
    },
    description: content.footer.blurb,
  };
}

export default async function VitrineLayout({ children }: { children: ReactNode }) {
  const { content, preview } = await visibleContent();
  return (
    <StoreShell content={content} preview={preview}>
      {children}
    </StoreShell>
  );
}
