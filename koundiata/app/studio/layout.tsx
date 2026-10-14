import type { ReactNode } from "react";
import { readStore } from "@/lib/store";
import { StudioShell } from "@/components/studio/studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio" };

export default async function Layout({ children }: { children: ReactNode }) {
  const data = await readStore();
  return <StudioShell initial={data}>{children}</StudioShell>;
}
