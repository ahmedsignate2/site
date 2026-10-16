"use client";

import { useState } from "react";
import { changeOwnPassword, createStaff, resetStaffPassword, updateStaff } from "@/lib/team-actions";
import { ROLE_LABELS } from "@/lib/permissions";
import type { AdminRole, PublicAdminUser } from "@/lib/types";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [AdminRole, string][];

function message(error: unknown) {
  return error instanceof Error ? error.message : "L'opération a échoué.";
}

export function TeamPanel({ initial, me }: { initial: PublicAdminUser[]; me: PublicAdminUser }) {
  const [users, setUsers] = useState(initial);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "support" as AdminRole, password: "" });
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<PublicAdminUser[] | void>, done: string) {
    setBusy(true);
    setNotice("");
    try {
      const next = await task();
      if (next) setUsers(next);
      setNotice(done);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Équipe et rôles</h3>
      <p className="note" style={{ marginBottom: 14 }}>
        Chaque action du studio est vérifiée côté serveur selon le rôle. Un changement de rôle ou de mot de passe ferme les sessions ouvertes du compte.
      </p>
      {notice ? (
        <p className="note" role="status" style={{ marginBottom: 12 }}>
          {notice}
        </p>
      ) : null}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <div className="note">{user.email}</div>
                </td>
                <td>
                  <select
                    value={user.role}
                    disabled={busy || user.id === me.id}
                    aria-label={`Rôle de ${user.name}`}
                    onChange={(event) => run(() => updateStaff(user.id, { role: event.target.value as AdminRole }), "Rôle modifié.")}
                  >
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{user.active ? "Actif" : "Désactivé"}</td>
                <td className="note">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("fr-FR") : "Jamais"}</td>
                <td>
                  <div className="row-actions">
                    {user.id !== me.id ? (
                      <button
                        className="kd-btn ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => updateStaff(user.id, { active: !user.active }), user.active ? "Compte désactivé." : "Compte réactivé.")}
                      >
                        {user.active ? "Désactiver" : "Réactiver"}
                      </button>
                    ) : null}
                    <button
                      className="kd-btn ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const password = window.prompt(`Nouveau mot de passe pour ${user.email} (10 caractères minimum, lettres et chiffres) :`);
                        if (password) run(() => resetStaffPassword(user.id, password), "Mot de passe réinitialisé. Transmettez-le de façon sûre.");
                      }}
                    >
                      Mot de passe
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        className="panel-form"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16, alignItems: "end" }}
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const next = await createStaff(form);
            setForm({ name: "", email: "", role: "support", password: "" });
            return next;
          }, "Compte créé. Transmettez le mot de passe de façon sûre.");
        }}
      >
        <label className="field">
          <span>Nom</span>
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label className="field">
          <span>Rôle</span>
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mot de passe provisoire</span>
          <input type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <button className="kd-btn" type="submit" disabled={busy}>
          Ajouter un membre
        </button>
      </form>
    </div>
  );
}

export function OwnPasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <form
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end", marginBottom: 28 }}
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await changeOwnPassword(current, next);
          setCurrent("");
          setNext("");
          setNotice("Mot de passe modifié.");
        } catch (error) {
          setNotice(message(error));
        }
      }}
    >
      <label className="field">
        <span>Mot de passe actuel</span>
        <input type="password" required autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
      </label>
      <label className="field">
        <span>Nouveau mot de passe</span>
        <input type="password" required minLength={10} autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
      </label>
      <button className="kd-btn" type="submit">
        Changer mon mot de passe
      </button>
      {notice ? <p className="note" role="status">{notice}</p> : null}
    </form>
  );
}
