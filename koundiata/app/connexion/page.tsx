import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { LoginForm } from "@/components/studio/login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion au studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(next?.startsWith("/studio") ? next : "/studio");
  const data = await readStore();
  const hasAccounts = (data.adminUsers || []).some((user) => user.passwordHash);
  const bootstrapReady = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow">{data.published.settings.brandName}</p>
        <h1>Connexion au studio</h1>
        {!hasAccounts && !bootstrapReady ? (
          <p className="note">
            Aucun compte n&apos;est encore créé. Définissez <code>ADMIN_EMAIL</code> et <code>ADMIN_PASSWORD</code> dans
            les variables d&apos;environnement, redémarrez, puis connectez-vous avec ces identifiants : le compte
            propriétaire sera créé à la première connexion.
          </p>
        ) : null}
        {!hasAccounts && bootstrapReady ? (
          <p className="note">Première connexion : utilisez les identifiants ADMIN_EMAIL et ADMIN_PASSWORD.</p>
        ) : null}
        <LoginForm next={next ?? "/studio"} />
      </div>
    </main>
  );
}
