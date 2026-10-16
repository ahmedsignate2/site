"use client";

import { useEffect, useState } from "react";
import { getSetupStatus, saveIntegrations, testEmail, testStripe, type SetupCheck, type SetupField } from "@/lib/setup-actions";
import type { IntegrationSettings } from "@/lib/types";

type Status = Awaited<ReturnType<typeof getSetupStatus>>;

const GROUPS: { title: string; help: string; fields: (keyof IntegrationSettings)[]; labels: Partial<Record<keyof IntegrationSettings, string>> }[] = [
  {
    title: "1. Site",
    help: "L'adresse publique de la boutique, utilisée dans les e-mails et pour Stripe.",
    fields: ["siteUrl"],
    labels: { siteUrl: "Adresse du site (https://…)" },
  },
  {
    title: "2. Paiement Stripe",
    help: "dashboard.stripe.com → Développeurs → Clés API. Commencez par la clé de test (sk_test_…).",
    fields: ["stripeSecretKey", "stripeWebhookSecret"],
    labels: { stripeSecretKey: "Clé secrète (sk_…)", stripeWebhookSecret: "Secret du webhook (whsec_…)" },
  },
  {
    title: "3. E-mails automatiques",
    help: "resend.com → API Keys. Vérifiez votre domaine chez Resend pour envoyer depuis votre adresse.",
    fields: ["resendApiKey", "emailFrom", "adminNotifyEmail"],
    labels: {
      resendApiKey: "Clé API Resend (re_…)",
      emailFrom: "Expéditeur (ex. Ma Boutique <bonjour@maboutique.fr>)",
      adminNotifyEmail: "E-mail de l'équipe à prévenir des commandes",
    },
  },
  {
    title: "4. Stockage des images (Cloudflare R2 ou S3)",
    help: "Obligatoire sur Vercel / Cloudflare. R2 : endpoint https://<compte>.r2.cloudflarestorage.com, région « auto ».",
    fields: ["s3Endpoint", "s3Bucket", "s3Region", "s3AccessKeyId", "s3SecretAccessKey", "s3PublicUrl"],
    labels: {
      s3Endpoint: "Endpoint (https://…)",
      s3Bucket: "Nom du bucket",
      s3Region: "Région",
      s3AccessKeyId: "Access key ID",
      s3SecretAccessKey: "Secret access key",
      s3PublicUrl: "URL publique des fichiers (https://…)",
    },
  },
];

function CheckRow({ check }: { check: SetupCheck }) {
  const icon = check.ok ? "✓" : check.warn ? "!" : "✕";
  const color = check.ok ? "#047857" : check.warn ? "#b45309" : "#b91c1c";
  return (
    <li style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid #eee6dc" }}>
      <span aria-hidden style={{ color, fontWeight: 700 }}>{icon}</span>
      <div>
        <strong>{check.label}</strong>
        <span className="sr-only">{check.ok ? " : prêt" : " : à faire"}</span>
        <div className="note">{check.detail}</div>
      </div>
    </li>
  );
}

export function SetupAdmin({ myEmail }: { myEmail: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Partial<Record<keyof IntegrationSettings, string>>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState(myEmail);

  useEffect(() => {
    getSetupStatus().then(setStatus).catch((error) => setNotice(error instanceof Error ? error.message : "Erreur"));
  }, []);

  if (!status) return <div className="panel">{notice || "Chargement…"}</div>;
  const done = status.checks.filter((check) => check.ok).length;
  const byField = new Map<string, SetupField>(status.fields.map((field) => [field.field, field]));

  const run = async (task: () => Promise<{ ok: boolean; message: string } | Status>, success?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const result = await task();
      if ("checks" in result) {
        setStatus(result);
        setDraft({});
        setNotice(success || "Enregistré.");
      } else setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <h2 style={{ marginBottom: 4 }}>Installation et connexions</h2>
      <p className="note">
        Branchez vos services en quelques minutes. Une variable d&apos;environnement définie chez l&apos;hébergeur est toujours prioritaire sur la valeur saisie ici. Les clés secrètes sont chiffrées.
      </p>

      <section style={{ margin: "18px 0" }}>
        <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>
          Prêt à vendre : {done} / {status.checks.length}
        </h3>
        <div style={{ height: 8, background: "#eee6dc", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${(done / status.checks.length) * 100}%`, height: "100%", background: "#047857" }} />
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {status.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      </section>

      {notice ? (
        <p className="note" role="status" style={{ background: "#f4eee7", padding: "8px 12px", borderRadius: 8 }}>
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(() => saveIntegrations(draft), "Réglages enregistrés.");
        }}
      >
        {GROUPS.map((group) => (
          <fieldset key={group.title} style={{ border: "1px solid #e2dad2", borderRadius: 10, padding: 16, margin: "0 0 16px", background: "#fff" }}>
            <legend style={{ fontWeight: 700, padding: "0 6px" }}>{group.title}</legend>
            <p className="note" style={{ marginTop: 0 }}>{group.help}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {group.fields.map((name) => {
                const info = byField.get(name)!;
                const locked = info.source === "env";
                return (
                  <label key={name} className="field">
                    <span>{group.labels[name]}</span>
                    <input
                      type={info.secret ? "password" : "text"}
                      autoComplete="off"
                      disabled={locked || busy}
                      placeholder={locked ? `Défini par ${info.env}` : info.display || (info.secret ? "Non renseigné" : "")}
                      value={draft[name] ?? (info.secret ? "" : locked ? "" : info.display)}
                      onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
                    />
                    <span className="note">
                      {locked ? `Variable ${info.env} (hébergeur)` : info.source === "studio" ? (info.secret ? `Enregistrée : ${info.display}` : "Enregistrée dans le studio") : `Ou variable ${info.env}`}
                    </span>
                  </label>
                );
              })}
            </div>
            {group.title.startsWith("2") ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="kd-btn ghost" type="button" disabled={busy} onClick={() => run(() => testStripe())}>
                  Tester la clé Stripe
                </button>
                <span className="note">
                  URL du webhook : <code>{status.webhookUrl}</code>
                </span>
              </div>
            ) : null}
            {group.title.startsWith("3") ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} aria-label="Destinataire du test" />
                <button className="kd-btn ghost" type="button" disabled={busy} onClick={() => run(() => testEmail(testTo))}>
                  Envoyer un e-mail de test
                </button>
              </div>
            ) : null}
          </fieldset>
        ))}
        <button className="kd-btn" type="submit" disabled={busy || !Object.keys(draft).length}>
          Enregistrer les réglages
        </button>
        <p className="note">Pour effacer une valeur enregistrée, videz le champ puis enregistrez.</p>
      </form>
    </div>
  );
}
