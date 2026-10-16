import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { currentCustomer } from "@/lib/customer-auth";
import { formatPrice } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readStore } from "@/lib/store";
import { PrintButton } from "@/components/store/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facture", robots: { index: false } };

/** Facture imprimable / PDF (via « Imprimer → Enregistrer en PDF »). Accessible au client de la commande et à l'équipe. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const [customer, staff, data] = await Promise.all([currentCustomer(), currentUser(), readStore()]);
  const order = data.orders.find((item) => item.id === id);
  if (!order) notFound();
  const allowed = (customer && order.customerId === customer.id) || (staff && can(staff.role, "orders"));
  if (!allowed) {
    if (!customer && !staff) redirect(`/compte/connexion?next=/facture/${encodeURIComponent(id)}`);
    notFound();
  }
  const s = data.published.settings;
  const vatRate = Number(process.env.VAT_RATE || 20);
  const ht = Math.round(order.total / (1 + vatRate / 100));
  return (
    <main className="invoice">
      <div className="invoice-actions">
        <PrintButton />
      </div>
      <header>
        <div>
          <h1>{s.brandName}</h1>
          <p>
            {s.legalName} {s.legalForm ? `· ${s.legalForm}` : ""}
            <br />
            {s.address}
            <br />
            {s.siret ? `SIRET ${s.siret}` : ""} {s.vat ? `· TVA ${s.vat}` : ""}
            <br />
            {s.supportEmail}
          </p>
        </div>
        <div className="right">
          <h2>Facture</h2>
          <p>
            N° {order.id}
            <br />
            Date : {new Date(order.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </header>
      <section>
        <strong>Facturé à</strong>
        <p>
          {order.customer.firstName} {order.customer.lastName}
          <br />
          {order.customer.address}
          <br />
          {order.customer.postal} {order.customer.city}, {order.customer.country}
          <br />
          {order.customer.email}
        </p>
      </section>
      <table>
        <thead>
          <tr>
            <th>Article</th>
            <th>Qté</th>
            <th>Prix unitaire TTC</th>
            <th>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.productId}>
              <td>{item.name}</td>
              <td>{item.qty}</td>
              <td>{formatPrice(item.price)}</td>
              <td>{formatPrice(item.price * item.qty)}</td>
            </tr>
          ))}
          {order.discount ? (
            <tr>
              <td colSpan={3}>Réduction {order.promoCode}</td>
              <td>-{formatPrice(order.discount)}</td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={3}>Livraison</td>
            <td>{formatPrice(order.shipping)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total HT</td>
            <td>{formatPrice(ht)}</td>
          </tr>
          <tr>
            <td colSpan={3}>TVA {vatRate} %</td>
            <td>{formatPrice(order.total - ht)}</td>
          </tr>
          <tr>
            <th colSpan={3}>Total TTC</th>
            <th>{formatPrice(order.total)}</th>
          </tr>
        </tfoot>
      </table>
      <footer>
        Paiement : {order.payment?.provider === "stripe" ? "carte bancaire (Stripe)" : "simulation"} · Réf. {order.payment?.reference || "—"}
      </footer>
    </main>
  );
}
