import { cache } from "react";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readStore } from "@/lib/store";

export const getStoreCached = cache(readStore);

/** Le brouillon n'est montré qu'aux membres du studio connectés qui ont activé l'aperçu. */
const canPreview = cache(async () => {
  if ((await cookies()).get("kd-preview")?.value !== "1") return false;
  const user = await currentUser();
  return Boolean(user && can(user.role, "content"));
});

export async function visibleContent() {
  const preview = await canPreview();
  const store = await getStoreCached();
  return {
    content: preview ? store.draft : store.published,
    preview,
    store,
  };
}
