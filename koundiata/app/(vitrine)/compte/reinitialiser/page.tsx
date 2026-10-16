import Link from "next/link";
import { ResetPasswordForm } from "@/components/store/account";

export const metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string; jeton?: string }> }) {
  const { email, jeton } = await searchParams;
  return (
    <div className="wrap auth-page">
      {email && jeton ? (
        <ResetPasswordForm email={email} token={jeton} />
      ) : (
        <div className="auth-card">
          <h1 className="page-title">Lien incomplet</h1>
          <Link className="kd-btn" href="/compte/mot-de-passe-oublie">
            Refaire une demande
          </Link>
        </div>
      )}
    </div>
  );
}
