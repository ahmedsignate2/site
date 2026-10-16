import Link from "next/link";
import { verifyCustomerEmail } from "@/lib/customer-verify";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirmation de l'adresse e-mail", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string; jeton?: string }> }) {
  const { email, jeton } = await searchParams;
  const result = email && jeton ? await verifyCustomerEmail(email, jeton) : "invalid";
  return (
    <div className="wrap auth-page">
      <div className="auth-card">
        {result === "invalid" ? (
          <>
            <h1 className="page-title">Lien invalide ou expiré</h1>
            <p>Connectez-vous à votre compte : un bouton permet de recevoir un nouveau lien de confirmation.</p>
            <Link className="kd-btn" href="/compte">
              Mon compte
            </Link>
          </>
        ) : (
          <>
            <h1 className="page-title">Adresse confirmée</h1>
            <p>{result === "already" ? "Votre adresse était déjà confirmée." : "Merci ! Votre compte est actif, vous pouvez commander."}</p>
            <div className="row-actions">
              <Link className="kd-btn" href="/boutique">
                Continuer mes achats
              </Link>
              <Link className="kd-btn ghost" href="/compte">
                Mon compte
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
