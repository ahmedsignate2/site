import { headers } from "next/headers";
import { getConfig } from "@/lib/config";

/** Adresse publique du site : NEXT_PUBLIC_SITE_URL / Studio → Installation, sinon l'hôte de la requête. */
export async function siteOrigin() {
  const configured = (await getConfig()).siteUrl;
  if (configured) return configured;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3847";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
