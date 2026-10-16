import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { orderForCustomer } from "@/lib/customer-orders";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";

export const metadata = { title: "Détail de commande", robots: { index: false } };

const STEPS = [
  { key: "payee", label: "Payée" },
  { key: "preparation", label: "En préparation" },
  { key: "expediee", label: "Expédiée" },
  { key: "livree", label: "Livrée" },
] as const;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await currentCustomer();
  if (!customer) redirect(`/compte/connexion?next=/compte/commandes/${encodeURIComponent(id)}`);
  const order = await orderForCustomer(customer, decodeURIComponent(id));
  if (!order) notFound();
  const reached = STEPS.findIndex((step) => step.key === order.status);
  const refunded = (order.refunds || []).reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="wrap account">
      <Link className="note" href="/compte?onglet=commandes">
        ← Mes commandes
      </Link>
      <div className="account-head">
        <div>
          <p className="eyebrow">Commande du {new Date(order.createdAt).toLocaleDateString("fr-FR")}</p>
          <h1 className="page-title">{order.id}</h1>
        </div>
        <a className="kd-btn ghost" href={`/facture/${encodeURIComponent(order.id)}`} target="_blank" rel="noreferrer">
          Télécharger la facture
        </a>
      </div>
      <p>
        Statut : <span className={`status-pill s-${order.status}`}>{orderStatusLabel[order.status]}</span>
      </p>
      {reached >= 0 ? (
        <ol className="timeline">
          {STEPS.map((step, index) => (
            <li key={step.key} className={index <= reached ? "done" : ""}>
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}
      {order.shippingDetails ? (
        <div className="summary">
          <strong>Suivi du colis</strong>
          <p>
            {order.shippingDetails.carrier} · n° {order.shippingDetails.trackingNumber}
          </p>
          {order.shippingDetails.trackingUrl ? (
            <a className="kd-btn" href={order.shippingDetails.trackingUrl} target="_blank" rel="noreferrer">
              Suivre mon colis
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="account-layout two">
        <section className="summary">
          <strong>Articles</strong>
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
          <div className="sum-row">
            <span>Sous-total</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.discount ? (
            <div className="sum-row">
              <span>Réduction {order.promoCode ? `(${order.promoCode})` : ""}</span>
              <span>-{formatPrice(order.discount)}</span>
            </div>
          ) : null}
          <div className="sum-row">
            <span>Livraison</span>
            <span>{order.shipping ? formatPrice(order.shipping) : "Offerte"}</span>
          </div>
          <div className="sum-row">
            <strong>Total</strong>
            <strong>{formatPrice(order.total)}</strong>
          </div>
          {refunded ? (
            <div className="sum-row">
              <span>Remboursé</span>
              <span>-{formatPrice(refunded)}</span>
            </div>
          ) : null}
        </section>
        <section className="summary">
          <strong>Livraison</strong>
          <p>
            {order.customer.firstName} {order.customer.lastName}
            <br />
            {order.customer.address}
            <br />
            {order.customer.postal} {order.customer.city}, {order.customer.country}
            <br />
            {order.customer.phone}
          </p>
          <strong>Une question ?</strong>
          <p>
            <Link href={`/contact?commande=${encodeURIComponent(order.id)}`}>Contacter le service client</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
