# KOUNDIATA

Boutique de cosmétiques et studio pour la personnaliser.

```bash
cd koundiata
npm install
npm run dev -- -p 3847
```

- Site : http://localhost:3847
- Studio : http://localhost:3847/studio

Les modifications du studio restent en brouillon jusqu’au bouton Publier. Les commandes, messages et inscriptions sont enregistrés tout de suite dans `data/store.json`.

## Paiement

Sans clé Stripe, la commande est acceptée en simulation : aucune carte n’est débitée, le stock est tout de même réservé.

Pour encaisser, créez `koundiata/.env.local` :

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://votre-domaine
```

Le webhook à déclarer dans Stripe est `POST /api/stripe/webhook`, pour les événements `checkout.session.completed` et `checkout.session.expired`. Tant que le client n’a pas payé, la commande reste « en attente » et le stock est retenu. Un abandon ou une expiration libère le stock.
