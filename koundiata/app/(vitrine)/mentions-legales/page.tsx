import { visibleContent } from "@/lib/content";
import { Article } from "@/components/store/view";

export const metadata = { title: "Mentions légales" };

export default async function Page() {
  const { content } = await visibleContent();
  const settings = content.settings;
  const page = {
    ...content.mentions,
    blocks: content.mentions.blocks.map((block) =>
      block.id === "ml1"
        ? {
            ...block,
            body: `${settings.legalName}, ${settings.legalForm}.\nSiège : ${settings.address}.\nE-mail : ${settings.supportEmail}.\nSIRET : ${settings.siret}.\nTVA : ${settings.vat}.\nDirecteur de la publication : ${settings.publicationDirector}.`,
          }
        : block.id === "ml2"
          ? { ...block, body: `Hébergeur : ${settings.host}.` }
          : block,
    ),
  };
  return <Article page={page} />;
}
