"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  changeCustomerPassword,
  deleteAddress,
  deleteMyAccount,
  exportMyData,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  saveAddress,
  setDefaultAddress,
  updateProfile,
  type FormState,
} from "@/lib/customer-actions";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";
import { useCart } from "@/components/store/cart";
import type { CustomerAddress, Order, Product, PublicCustomer } from "@/lib/types";

export type ClientOrder = Omit<Order, "cancelToken">;

function Notice({ state }: { state: FormState }) {
  if (state?.error) return <p className="alert" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="success-note" role="status">{state.ok}</p>;
  return null;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "L'opération a échoué.";
}

/* ---------- Connexion / inscription ---------- */

export function CustomerLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginCustomer, undefined);
  return (
    <div className="auth-card">
      <h1 className="page-title">Se connecter</h1>
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <Notice state={state} />
        <label className="field">
          <span>E-mail</span>
          <input key={state?.fields?.email} name="email" type="email" autoComplete="email" defaultValue={state?.fields?.email} required />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <Link className="note" href="/compte/mot-de-passe-oublie">
          Mot de passe oublié ?
        </Link>
        <button className="kd-btn" type="submit" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <div className="auth-switch">
        <p>Nouveau client ?</p>
        <Link className="kd-btn ghost" href={`/compte/inscription?next=${encodeURIComponent(next)}`}>
          Créer un compte
        </Link>
      </div>
    </div>
  );
}

export function CustomerRegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerCustomer, undefined);
  const f = state?.fields;
  return (
    <div className="auth-card">
      <h1 className="page-title">Créer un compte</h1>
      <p className="note">Un compte est nécessaire pour commander. Il vous permet de suivre vos commandes, d&apos;enregistrer vos adresses et vos favoris.</p>
      <form action={action} className="auth-form" key={f?.email}>
        <input type="hidden" name="next" value={next} />
        <Notice state={state} />
        <div className="name-grid">
          <label className="field">
            <span>Prénom</span>
            <input name="firstName" autoComplete="given-name" defaultValue={f?.firstName} required />
          </label>
          <label className="field">
            <span>Nom</span>
            <input name="lastName" autoComplete="family-name" defaultValue={f?.lastName} required />
          </label>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input name="email" type="email" autoComplete="email" defaultValue={f?.email} required />
        </label>
        <label className="field">
          <span>Téléphone (facultatif)</span>
          <input name="phone" type="tel" autoComplete="tel" defaultValue={f?.phone} />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input name="password" type="password" autoComplete="new-password" minLength={10} required />
          <span className="note">10 caractères minimum, avec des lettres et des chiffres.</span>
        </label>
        <label className="check-line">
          <input type="checkbox" name="terms" required /> J&apos;accepte les <Link href="/cgv">conditions générales de vente</Link> et la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>
        </label>
        <label className="check-line">
          <input type="checkbox" name="marketing" /> Je souhaite recevoir les offres et nouveautés par e-mail
        </label>
        <button className="kd-btn" type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </button>
      </form>
      <div className="auth-switch">
        <p>Déjà client ?</p>
        <Link className="kd-btn ghost" href={`/compte/connexion?next=${encodeURIComponent(next)}`}>
          Se connecter
        </Link>
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, undefined);
  return (
    <div className="auth-card">
      <h1 className="page-title">Mot de passe oublié</h1>
      <p className="note">Indiquez l&apos;e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      <form action={action} className="auth-form">
        <Notice state={state} />
        <label className="field">
          <span>E-mail</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="kd-btn" type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Recevoir le lien"}
        </button>
      </form>
      <Link className="note" href="/compte/connexion">
        Retour à la connexion
      </Link>
    </div>
  );
}

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, undefined);
  return (
    <div className="auth-card">
      <h1 className="page-title">Nouveau mot de passe</h1>
      <form action={action} className="auth-form">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <Notice state={state} />
        <label className="field">
          <span>Nouveau mot de passe</span>
          <input name="password" type="password" autoComplete="new-password" minLength={10} required />
        </label>
        <button className="kd-btn" type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer et me connecter"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Tableau de bord client ---------- */

type Tab = "apercu" | "commandes" | "adresses" | "favoris" | "profil" | "donnees";

const TABS: { id: Tab; label: string }[] = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "commandes", label: "Mes commandes" },
  { id: "adresses", label: "Mes adresses" },
  { id: "favoris", label: "Mes favoris" },
  { id: "profil", label: "Profil et sécurité" },
  { id: "donnees", label: "Mes données" },
];

const IN_PROGRESS = new Set(["en_attente", "payee", "preparation", "expediee"]);

export function AccountDashboard({
  customer: initialCustomer,
  orders,
  products,
  initialTab,
}: {
  customer: PublicCustomer;
  orders: ClientOrder[];
  products: Product[];
  initialTab?: string;
}) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.id === initialTab) ? (initialTab as Tab) : "apercu");
  const active = orders.filter((order) => IN_PROGRESS.has(order.status));
  const cart = useCart();
  const favorites = products.filter((product) => cart.wished(product.id)).length;

  return (
    <div className="wrap account">
      <div className="account-head">
        <div>
          <p className="eyebrow">Mon compte</p>
          <h1 className="page-title">Bonjour {customer.firstName}</h1>
        </div>
        <form action={logoutCustomer}>
          <button className="kd-btn ghost" type="submit">
            Se déconnecter
          </button>
        </form>
      </div>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Espace client">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>
              {item.label}
              {item.id === "commandes" && orders.length ? <span className="badge-count">{orders.length}</span> : null}
            </button>
          ))}
        </nav>
        <section className="account-main">
          {tab === "apercu" ? <Overview customer={customer} orders={orders} active={active} favorites={favorites} go={setTab} /> : null}
          {tab === "commandes" ? <OrdersList orders={orders} /> : null}
          {tab === "adresses" ? (
            <AddressBook addresses={customer.addresses} onChange={(addresses) => setCustomer({ ...customer, addresses })} />
          ) : null}
          {tab === "favoris" ? <Favorites products={products} /> : null}
          {tab === "profil" ? <Profile customer={customer} onChange={setCustomer} /> : null}
          {tab === "donnees" ? <MyData /> : null}
        </section>
      </div>
    </div>
  );
}

function Overview({
  customer,
  orders,
  active,
  favorites,
  go,
}: {
  customer: PublicCustomer;
  orders: ClientOrder[];
  active: ClientOrder[];
  favorites: number;
  go: (tab: Tab) => void;
}) {
  const spent = orders.filter((order) => order.status !== "annulee" && order.status !== "echouee").reduce((sum, order) => sum + order.total, 0);
  const defaultAddress = customer.addresses.find((item) => item.isDefault);
  return (
    <div className="account-section">
      <div className="stat-grid">
        <button type="button" className="stat" onClick={() => go("commandes")}>
          <strong>{orders.length}</strong>
          <span>commande{orders.length > 1 ? "s" : ""}</span>
        </button>
        <button type="button" className="stat" onClick={() => go("commandes")}>
          <strong>{active.length}</strong>
          <span>en cours</span>
        </button>
        <button type="button" className="stat" onClick={() => go("favoris")}>
          <strong>{favorites}</strong>
          <span>favoris</span>
        </button>
        <div className="stat">
          <strong>{formatPrice(spent)}</strong>
          <span>d&apos;achats</span>
        </div>
      </div>
      <h2>Commandes en cours</h2>
      {active.length ? <OrdersList orders={active} compact /> : <p className="note">Aucune commande en cours.</p>}
      <h2>Adresse par défaut</h2>
      {defaultAddress ? (
        <AddressCard address={defaultAddress} />
      ) : (
        <p className="note">
          Aucune adresse enregistrée.{" "}
          <button type="button" className="link-btn" onClick={() => go("adresses")}>
            Ajouter une adresse
          </button>
        </p>
      )}
    </div>
  );
}

function OrdersList({ orders, compact = false }: { orders: ClientOrder[]; compact?: boolean }) {
  if (!orders.length) {
    return (
      <div className="account-section">
        <p>Vous n&apos;avez pas encore passé de commande.</p>
        <Link className="kd-btn" href="/boutique">
          Découvrir la boutique
        </Link>
      </div>
    );
  }
  return (
    <div className="order-list">
      {orders.map((order) => (
        <article key={order.id} className="order-card">
          <header>
            <div>
              <strong>{order.id}</strong>
              <div className="note">Passée le {new Date(order.createdAt).toLocaleDateString("fr-FR")}</div>
            </div>
            <span className={`status-pill s-${order.status}`}>{orderStatusLabel[order.status]}</span>
            <strong>{formatPrice(order.total)}</strong>
          </header>
          {!compact ? (
            <ul className="order-lines">
              {order.items.map((item) => (
                <li key={item.productId}>
                  {item.image ? <img src={item.image} alt="" /> : <span className="thumb" />}
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <span>{formatPrice(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <footer>
            <Link className="kd-btn ghost" href={`/compte/commandes/${encodeURIComponent(order.id)}`}>
              Détail et suivi
            </Link>
            <a className="kd-btn ghost" href={`/facture/${encodeURIComponent(order.id)}`} target="_blank" rel="noreferrer">
              Facture
            </a>
          </footer>
        </article>
      ))}
    </div>
  );
}

function AddressCard({ address }: { address: CustomerAddress }) {
  return (
    <div className="address-card">
      <strong>
        {address.label}
        {address.isDefault ? <span className="tag">Par défaut</span> : null}
      </strong>
      <div>
        {address.firstName} {address.lastName}
      </div>
      <div>{address.address}</div>
      <div>
        {address.postal} {address.city}, {address.country}
      </div>
      <div className="note">{address.phone}</div>
    </div>
  );
}

const EMPTY_ADDRESS: Partial<CustomerAddress> = { label: "Domicile", country: "France" };

function AddressBook({ addresses, onChange }: { addresses: CustomerAddress[]; onChange: (list: CustomerAddress[]) => void }) {
  const [editing, setEditing] = useState<Partial<CustomerAddress> | null>(null);
  const [error, setError] = useState("");

  const run = async (task: () => Promise<CustomerAddress[]>) => {
    setError("");
    try {
      onChange(await task());
      setEditing(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="account-section">
      <div className="section-head">
        <h2>Carnet d&apos;adresses</h2>
        <button className="kd-btn" type="button" onClick={() => setEditing({ ...EMPTY_ADDRESS })}>
          Ajouter une adresse
        </button>
      </div>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      {editing ? (
        <form
          className="address-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const value = Object.fromEntries(form.entries()) as Record<string, string>;
            run(() => saveAddress({ ...editing, ...value, isDefault: form.get("isDefault") === "on" }));
          }}
        >
          <label className="field">
            <span>Nom de l&apos;adresse</span>
            <input name="label" defaultValue={editing.label} placeholder="Domicile, Bureau…" />
          </label>
          <div className="name-grid">
            <label className="field">
              <span>Prénom</span>
              <input name="firstName" defaultValue={editing.firstName} required />
            </label>
            <label className="field">
              <span>Nom</span>
              <input name="lastName" defaultValue={editing.lastName} required />
            </label>
          </div>
          <label className="field">
            <span>Adresse</span>
            <input name="address" defaultValue={editing.address} autoComplete="street-address" required />
          </label>
          <div className="name-grid">
            <label className="field">
              <span>Code postal</span>
              <input name="postal" defaultValue={editing.postal} autoComplete="postal-code" required />
            </label>
            <label className="field">
              <span>Ville</span>
              <input name="city" defaultValue={editing.city} autoComplete="address-level2" required />
            </label>
          </div>
          <div className="name-grid">
            <label className="field">
              <span>Pays</span>
              <input name="country" defaultValue={editing.country} autoComplete="country-name" required />
            </label>
            <label className="field">
              <span>Téléphone</span>
              <input name="phone" type="tel" defaultValue={editing.phone} autoComplete="tel" required />
            </label>
          </div>
          <label className="check-line">
            <input type="checkbox" name="isDefault" defaultChecked={editing.isDefault} /> Adresse par défaut
          </label>
          <div className="row-actions">
            <button className="kd-btn" type="submit">
              Enregistrer
            </button>
            <button className="kd-btn ghost" type="button" onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}
      <div className="address-grid">
        {addresses.map((address) => (
          <div key={address.id}>
            <AddressCard address={address} />
            <div className="row-actions">
              <button className="link-btn" type="button" onClick={() => setEditing(address)}>
                Modifier
              </button>
              {!address.isDefault ? (
                <button className="link-btn" type="button" onClick={() => run(() => setDefaultAddress(address.id))}>
                  Définir par défaut
                </button>
              ) : null}
              <button
                className="link-btn danger"
                type="button"
                onClick={() => {
                  if (window.confirm("Supprimer cette adresse ?")) run(() => deleteAddress(address.id));
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
      {!addresses.length && !editing ? <p className="note">Aucune adresse enregistrée.</p> : null}
    </div>
  );
}

function Favorites({ products }: { products: Product[] }) {
  const cart = useCart();
  const list = products.filter((product) => cart.wished(product.id));
  if (!list.length) {
    return (
      <div className="account-section">
        <p>Aucun favori pour l&apos;instant. Touchez le cœur sur un produit pour le retrouver ici.</p>
        <Link className="kd-btn" href="/boutique">
          Parcourir la boutique
        </Link>
      </div>
    );
  }
  return (
    <div className="fav-grid">
      {list.map((product) => (
        <article key={product.id} className="fav-card">
          <Link href={`/produit/${product.slug}`}>
            {product.images[0] ? <img src={product.images[0]} alt={product.name} /> : <span className="thumb" />}
            <strong>{product.name}</strong>
          </Link>
          <span>{formatPrice(product.price)}</span>
          <div className="row-actions">
            <button className="kd-btn" type="button" disabled={product.stock <= 0} onClick={() => cart.add(product.id)}>
              {product.stock > 0 ? "Ajouter au panier" : "Épuisé"}
            </button>
            <button className="link-btn" type="button" onClick={() => cart.toggleWish(product.id)}>
              Retirer
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Profile({ customer, onChange }: { customer: PublicCustomer; onChange: (customer: PublicCustomer) => void }) {
  const [notice, setNotice] = useState("");
  const [pwNotice, setPwNotice] = useState("");
  return (
    <div className="account-section">
      <h2>Informations personnelles</h2>
      <form
        className="address-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            onChange(
              await updateProfile({
                firstName: String(form.get("firstName") || ""),
                lastName: String(form.get("lastName") || ""),
                phone: String(form.get("phone") || ""),
                marketingOptIn: form.get("marketing") === "on",
              }),
            );
            setNotice("Profil enregistré.");
          } catch (error) {
            setNotice(errorText(error));
          }
        }}
      >
        <div className="name-grid">
          <label className="field">
            <span>Prénom</span>
            <input name="firstName" defaultValue={customer.firstName} required />
          </label>
          <label className="field">
            <span>Nom</span>
            <input name="lastName" defaultValue={customer.lastName} required />
          </label>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input value={customer.email} disabled readOnly />
        </label>
        <label className="field">
          <span>Téléphone</span>
          <input name="phone" type="tel" defaultValue={customer.phone} />
        </label>
        <label className="check-line">
          <input type="checkbox" name="marketing" defaultChecked={customer.marketingOptIn} /> Recevoir les offres et nouveautés par e-mail
        </label>
        <button className="kd-btn" type="submit">
          Enregistrer
        </button>
        {notice ? <p className="note" role="status">{notice}</p> : null}
      </form>

      <h2>Mot de passe</h2>
      <form
        className="address-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const target = event.currentTarget;
          const form = new FormData(target);
          try {
            await changeCustomerPassword(String(form.get("current") || ""), String(form.get("next") || ""));
            target.reset();
            setPwNotice("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
          } catch (error) {
            setPwNotice(errorText(error));
          }
        }}
      >
        <label className="field">
          <span>Mot de passe actuel</span>
          <input name="current" type="password" autoComplete="current-password" required />
        </label>
        <label className="field">
          <span>Nouveau mot de passe</span>
          <input name="next" type="password" autoComplete="new-password" minLength={10} required />
        </label>
        <button className="kd-btn" type="submit">
          Changer le mot de passe
        </button>
        {pwNotice ? <p className="note" role="status">{pwNotice}</p> : null}
      </form>
      <p className="note">Client depuis le {new Date(customer.createdAt).toLocaleDateString("fr-FR")}.</p>
    </div>
  );
}

function MyData() {
  const [error, setError] = useState("");
  return (
    <div className="account-section">
      <h2>Exporter mes données</h2>
      <p className="note">Téléchargez toutes les informations liées à votre compte (RGPD, article 20).</p>
      <button
        className="kd-btn ghost"
        type="button"
        onClick={async () => {
          const json = await exportMyData();
          const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "mes-donnees.json";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Télécharger mes données
      </button>

      <h2>Supprimer mon compte</h2>
      <p className="note">
        Votre compte, vos adresses et vos favoris seront effacés. Les factures sont conservées de façon anonyme, comme la loi l&apos;exige.
      </p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
      <form
        className="inline-form"
        style={{ justifyContent: "flex-start" }}
        onSubmit={async (event) => {
          event.preventDefault();
          const password = String(new FormData(event.currentTarget).get("password") || "");
          if (!window.confirm("Supprimer définitivement votre compte ?")) return;
          try {
            await deleteMyAccount(password);
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <input name="password" type="password" placeholder="Votre mot de passe" autoComplete="current-password" required />
        <button className="kd-btn danger" type="submit">
          Supprimer mon compte
        </button>
      </form>
    </div>
  );
}
