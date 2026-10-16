import { ForgotPasswordForm } from "@/components/store/account";

export const metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function Page() {
  return (
    <div className="wrap auth-page">
      <ForgotPasswordForm />
    </div>
  );
}
