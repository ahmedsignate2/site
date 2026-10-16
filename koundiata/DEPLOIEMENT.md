# Mise en ligne

La boutique est une application Next.js standard. Elle se déploie sur tout hébergeur Node.js.
Tous les réglages passent par des **variables d'environnement** (voir `.env.example`) ou par
**Studio → Installation & Connexions** une fois le site en ligne.

## Le minimum pour démarrer (5 minutes)

| Variable | Rôle |
| --- | --- |
| `AUTH_SECRET` | Clé de signature des sessions (32 caractères ou plus). `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Premier compte propriétaire, créé à la première connexion sur `/connexion` |
| `DATABASE_URL` | Postgres (Neon, Supabase, Vercel Postgres, Railway…). Obligatoire sur Vercel, Cloudflare, Netlify |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique, ex. `https://maboutique.fr` |

Ensuite, connectez-vous sur `/connexion` : le studio ouvre la page **Installation**, qui liste ce qui
reste à brancher (Stripe, e-mails Resend, stockage des images R2/S3, mentions légales) avec un bouton de test pour chaque service.

La table `kd_store` est créée automatiquement au premier démarrage. Si un fichier `data/store.json`
existe, son contenu est importé dans Postgres.

## Vercel

1. Importez le dépôt sur vercel.com, **Root Directory** : `koundiata`.
2. Ajoutez une base Postgres (Storage → Neon) : `DATABASE_URL` est créé automatiquement.
3. Ajoutez `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.
4. Déployez. Images : configurez Cloudflare R2 ou S3 dans Installation (le disque Vercel n'est pas persistant).

## Cloudflare (Workers, via OpenNext)

```bash
cd koundiata
npm install -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare migrate     # génère wrangler.jsonc et open-next.config.ts
npx wrangler secret put AUTH_SECRET    # idem pour DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```

Activez `nodejs_compat` dans `wrangler.jsonc` (fait par `migrate`). Utilisez une base Postgres
accessible depuis Internet (Neon, Supabase) et R2 pour les images. Ce chemin n'a pas encore été
testé de bout en bout : faites un essai sur un environnement de test avant la mise en production.

Pour un simple serveur derrière Cloudflare (DNS, CDN, WAF), utilisez plutôt Docker ci-dessous et
mettez Cloudflare devant.

## Docker / VPS (OVH, Scaleway, Hetzner, Railway, Render, Fly.io, Coolify)

```bash
docker build -t boutique koundiata
docker run -p 3000:3000 --env-file koundiata/.env.local -v boutique-data:/app/data -v boutique-uploads:/app/public/uploads boutique
```

Sans `DATABASE_URL`, les données sont dans le volume `/app/data` : convient à un serveur unique.

## Stripe

Dans Stripe → Développeurs → Webhooks, ajoutez `https://<votre-domaine>/api/stripe/webhook` avec les
événements `checkout.session.completed`, `checkout.session.async_payment_succeeded` et
`checkout.session.expired`. Collez le secret `whsec_…` dans Installation.

## Shopify

Shopify n'héberge pas d'applications Next.js : ce site le remplace (catalogue, paiement, comptes
clients, studio). Pour une migration depuis Shopify, exportez vos produits en CSV depuis Shopify et
recréez-les dans le studio.

## Tests en local avec un tunnel

`npm run tunnel` expose le site via Cloudflare Tunnel. Ajoutez le domaine du tunnel dans
`ALLOWED_ORIGINS` (ex. `*.trycloudflare.com`) puis redémarrez.
