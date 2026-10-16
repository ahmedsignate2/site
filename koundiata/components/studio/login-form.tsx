"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/team-actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="login-form">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>E-mail</span>
        <input key={state?.email} name="email" type="email" autoComplete="username" defaultValue={state?.email} required />
      </label>
      <label className="field">
        <span>Mot de passe</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error ? (
        <p className="err" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="kd-btn" type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
