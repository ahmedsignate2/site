import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { can, permissionForStudioPath } from "@/lib/permissions";
import { StudioView } from "@/components/studio/studio";

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const path = `/studio${slug?.length ? `/${slug.join("/")}` : ""}`;
  if (path === "/studio" && !can(user.role, "content")) redirect(can(user.role, "orders") ? "/studio/commandes" : "/studio/messages");
  if (!can(user.role, permissionForStudioPath(path))) {
    return (
      <div className="panel">
        <h2>Accès réservé</h2>
        <p className="note">Votre rôle ne donne pas accès à cet écran. Demandez au propriétaire de la boutique.</p>
      </div>
    );
  }
  return <StudioView />;
}
