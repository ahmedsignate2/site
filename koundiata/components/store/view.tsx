"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Headset,
  Heart,
  Leaf,
  Lock,
  Menu,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  Truck,
  User,
  X,
} from "lucide-react";
import { categoryById, categoryBySlug, productsFor, relatedProducts, shippingCost } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { themeStyle } from "@/lib/theme";
import type { HeroContent, PageContent, Product, PromoCard, Section, SiteContent, TrustIcon } from "@/lib/types";
import { placeOrder, sendMessage, subscribeEmail, ordersForEmail } from "@/lib/actions";
import { useCart } from "@/components/store/cart";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function Photo({ src, alt, priority = false, sizes = "40vw" }: { src: string; alt: string; priority?: boolean; sizes?: string }) {
  if (!src) return <div className="fill" style={{ background: "#efe6da" }} />;
  if (src.startsWith("http")) {
    return <img src={src} alt={alt} className="fill" />;
  }
  return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />;
}

function Stars({ value, count }: { value: number; count?: number }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} sur 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={13} fill={index < full ? "currentColor" : "none"} aria-hidden />
      ))}
      {typeof count === "number" ? <span className="count">({count})</span> : null}
    </span>
  );
}

const trustIcons: Record<TrustIcon, typeof Truck> = {
  truck: Truck,
  lock: Lock,
  leaf: Leaf,
  headset: Headset,
  return: RotateCcw,
};

export function ProductCard({ product, quiet = false }: { product: Product; quiet?: boolean }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const wished = cart.wished(product.id);
  return (
    <article className="pcard">
      {product.badge ? <span className="badge">{product.badge}</span> : null}
      <button
        className="wish"
        type="button"
        aria-pressed={wished}
        data-on={wished}
        aria-label={wished ? `Retirer ${product.name} des envies` : `Ajouter ${product.name} aux envies`}
        onClick={() => !quiet && cart.toggleWish(product.id)}
      >
        <Heart size={16} fill={wished ? "currentColor" : "none"} />
      </button>
      <Link href={`/produit/${product.slug}`} className="media square" tabIndex={quiet ? -1 : undefined}>
        <Photo src={product.images[0] ?? ""} alt={product.name} sizes="(max-width:760px) 50vw, 16vw" />
      </Link>
      <h3>
        <Link href={`/produit/${product.slug}`}>{product.name}</Link>
      </h3>
      <p className="sub">{product.subtitle}</p>
      <div className="price-row">
        <div>
          <span className="price">{formatPrice(product.price)}</span>
          {product.compareAt ? <span className="compare">{formatPrice(product.compareAt)}</span> : null}
          <div>
            <Stars value={product.rating} count={product.reviewCount} />
          </div>
        </div>
        <button
          className="add"
          type="button"
          aria-label={product.stock > 0 ? `Ajouter ${product.name} au panier` : `${product.name} épuisé`}
          disabled={product.stock <= 0}
          onClick={() => {
            if (quiet || product.stock <= 0) return;
            cart.add(product.id, 1);
            setAdded(true);
            window.setTimeout(() => setAdded(false), 1200);
          }}
        >
          {added ? "OK" : <Plus size={16} />}
        </button>
      </div>
    </article>
  );
}

function Announcement({ content }: { content: SiteContent }) {
  return (
    <div className="announce">
      <span>{content.settings.announcement}</span>
      <span className="locale">{content.settings.localeLabel}</span>
    </div>
  );
}

function Header({ content }: { content: SiteContent }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <header className="header">
      <div className="wrap header-row">
        <button className="icon-btn menu-btn" type="button" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <Link href="/" className="wordmark">
          {content.settings.brandName}
        </Link>
        <nav className="nav" aria-label="Principale">
          {content.navigation.map((link) => (
            <Link key={link.id} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="tools">
          <button className="icon-btn" type="button" aria-label="Rechercher" onClick={() => setSearch(true)}>
            <Search size={18} />
          </button>
          <Link className="icon-btn" href="/compte" aria-label="Compte">
            <User size={18} />
          </Link>
          <Link className="icon-btn" href="/panier" aria-label={`Panier, ${cart.count} article${cart.count > 1 ? "s" : ""}`}>
            <ShoppingBag size={18} />
            {cart.count > 0 ? <span className="cart-count">{cart.count}</span> : null}
          </Link>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[86vw] sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="font-display tracking-[0.2em]">{content.settings.brandName}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
            {content.navigation.map((link) => (
              <Link key={link.id} href={link.href} className="min-h-11 flex items-center" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/studio" className="min-h-11 flex items-center" onClick={() => setOpen(false)}>
              Studio
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
      <Sheet open={search} onOpenChange={setSearch}>
        <SheetContent side="top" className="h-auto">
          <SheetHeader>
            <SheetTitle>Rechercher</SheetTitle>
          </SheetHeader>
          <form action="/recherche" className="px-4 pb-4 flex gap-2" onSubmit={() => setSearch(false)}>
            <label className="field" style={{ flex: 1 }}>
              <span className="sr-only">Recherche</span>
              <input name="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sérum, parfum, rouge…" autoFocus />
            </label>
            <button className="kd-btn" type="submit">
              Voir
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <Link href="/" className="wordmark">
            {content.settings.brandName}
          </Link>
          <p className="blurb">{content.footer.blurb}</p>
        </div>
        {content.footer.columns.map((column) => (
          <div key={column.id}>
            <h3>{column.title}</h3>
            {column.links.map((link) => (
              <Link key={link.id} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="wrap legal">
        <span>
          © {new Date().getFullYear()} {content.footer.copyright}
        </span>
        <span>Visa · Mastercard · PayPal · Apple Pay</span>
        <Link href="/studio">Studio</Link>
      </div>
    </footer>
  );
}

function CookieBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("koundiata-cookie")) setOpen(true);
  }, []);
  if (!open) return null;
  return (
    <div className="cookie" role="dialog" aria-label="Cookies">
      <p style={{ margin: 0 }}>
        Ce site mémorise votre panier dans le navigateur. Pas de publicité tierce.{" "}
        <Link href="/confidentialite">Confidentialité</Link>
      </p>
      <button
        className="kd-btn"
        type="button"
        onClick={() => {
          localStorage.setItem("koundiata-cookie", "1");
          setOpen(false);
        }}
      >
        D'accord
      </button>
    </div>
  );
}

export function StoreShell({
  content,
  preview,
  children,
}: {
  content: SiteContent;
  preview?: boolean;
  children: ReactNode;
}) {
  const header = content.sections.find((section) => section.type === "header");
  const footer = content.sections.find((section) => section.type === "footer");
  return (
    <div className="store" style={themeStyle(content.theme)}>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      {preview ? (
        <div className="preview-bar">
          Aperçu du brouillon. <a href="/api/preview?off=1">Voir le site publié</a>
        </div>
      ) : null}
      {header?.enabled !== false ? (
        <>
          <Announcement content={content} />
          <Header content={content} />
        </>
      ) : null}
      <main id="contenu">{children}</main>
      {footer?.enabled !== false ? <Footer content={content} /> : null}
      <CookieBar />
    </div>
  );
}

function Hero({ hero }: { hero: HeroContent }) {
  const src = hero.image;
  return (
    <section className="hero" data-height={hero.height} data-layout={hero.layout}>
      <div className="hero-copy">
        <p className="eyebrow">{hero.eyebrow}</p>
        <h1>{hero.title}</h1>
        <p className="lede">{hero.subtitle}</p>
        <Link className="kd-btn" href={hero.buttonHref} style={{ marginTop: 28, alignSelf: "flex-start" }}>
          {hero.buttonLabel} <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="hero-media">
        <Photo src={src} alt={hero.imageAlt} priority sizes="60vw" />
        <div className="overlay" style={{ opacity: Math.max(0, Math.min(80, hero.overlay)) / 100 }} />
      </div>
    </section>
  );
}

function Promo({ card }: { card: PromoCard }) {
  return (
    <Link href={card.href} className="promo" data-tone={card.tone}>
      <Photo src={card.image} alt="" sizes="33vw" />
      <div className="shade" />
      <div className="promo-body">
        {card.badge ? <div className="mini">{card.badge}</div> : null}
        <h3>{card.title}</h3>
        <p>{card.text}</p>
        <span className="mini">{card.cta} →</span>
      </div>
    </Link>
  );
}

function Newsletter({ title, text, placeholder, button }: { title: string; text: string; placeholder: string; button: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="newsletter">
      <h2>{title}</h2>
      <p>{text}</p>
      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const result = await subscribeEmail(email);
          if (!result.ok) setError(result.error);
          else {
            setMessage("Vous êtes inscrit.");
            setEmail("");
          }
        }}
      >
        <label className="field">
          <span className="sr-only">E-mail</span>
          <input
            type="email"
            required
            value={email}
            placeholder={placeholder}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "news-err" : undefined}
            onChange={(event) => setEmail(event.target.value)}
            style={{ minWidth: 260 }}
          />
        </label>
        <button className="kd-btn" type="submit">
          {button}
        </button>
      </form>
      {error ? (
        <p id="news-err" className="err" role="alert" style={{ color: "#9f2d2d" }}>
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

export function HomeSections({ content, quiet = false }: { content: SiteContent; quiet?: boolean }) {
  return (
    <>
      {content.sections
        .filter((section) => section.enabled && section.type !== "header" && section.type !== "footer")
        .map((section) => (
          <SectionView key={section.id} section={section} content={content} quiet={quiet} />
        ))}
    </>
  );
}

function SectionView({ section, content, quiet }: { section: Section; content: SiteContent; quiet?: boolean }) {
  if (section.type === "hero") return <Hero hero={section.hero} />;
  if (section.type === "trust") {
    return (
      <section className="trust" aria-label="Avantages">
        <div className="wrap trust-grid">
          {section.items.map((item) => {
            const Icon = trustIcons[item.icon] ?? Leaf;
            return (
              <div className="trust-item" key={item.id}>
                <Icon size={22} aria-hidden />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  if (section.type === "categories") {
    return (
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>{section.title}</h2>
            <Link className="quiet" href={section.linkHref}>
              {section.linkLabel} →
            </Link>
          </div>
          <div className="cat-grid">
            {content.categories.map((category) => (
              <Link key={category.id} href={`/boutique/${category.slug}`} className="cat">
                <div className="media wide">
                  <Photo src={category.image} alt="" sizes="16vw" />
                </div>
                <h3>{category.name}</h3>
                <p>{category.linkLabel} →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "products") {
    const products = productsFor(content, section.source, section.categoryId, section.limit);
    return (
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>{section.title}</h2>
            <Link className="quiet" href={section.linkHref}>
              {section.linkLabel} →
            </Link>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} quiet={quiet} />
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "promos") {
    return (
      <section>
        <div className="wrap promo-grid">
          {section.cards.map((card) => (
            <Promo key={card.id} card={card} />
          ))}
        </div>
      </section>
    );
  }
  if (section.type === "testimonials") {
    if (!section.items.length) return null;
    return (
      <section className="section">
        <div className="wrap">
          <h2 className="display" style={{ fontSize: "2.4rem" }}>
            {section.title}
          </h2>
          <div className="promo-grid">
            {section.items.map((item) => (
              <blockquote key={item.id} className="summary">
                <p style={{ fontFamily: "var(--font-display), serif", fontSize: "1.5rem", marginTop: 0 }}>{item.quote}</p>
                <footer>
                  {item.name}
                  {item.detail ? ` · ${item.detail}` : ""}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "newsletter") {
    return <Newsletter title={section.title} text={section.text} placeholder={section.placeholder} button={section.button} />;
  }
  if (section.type === "gallery") {
    return (
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>{section.title}</h2>
          </div>
          <div className="gallery-grid">
            {section.images.map((image) => (
              <div key={image.id} className="media square">
                <Photo src={image.src} alt={image.alt} sizes="25vw" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "custom") {
    return (
      <section className="section">
        <div className="wrap pdp">
          {section.layout === "text-left" ? null : (
            <div className="media portrait">
              <Photo src={section.image} alt={section.imageAlt} sizes="50vw" />
            </div>
          )}
          <div>
            <h2 className="display" style={{ fontSize: "3rem" }}>
              {section.title}
            </h2>
            <p className="lede">{section.text}</p>
            {section.buttonLabel ? (
              <Link className="kd-btn" href={section.buttonHref} style={{ marginTop: 18 }}>
                {section.buttonLabel}
              </Link>
            ) : null}
          </div>
          {section.layout === "text-left" ? (
            <div className="media portrait">
              <Photo src={section.image} alt={section.imageAlt} sizes="50vw" />
            </div>
          ) : null}
        </div>
      </section>
    );
  }
  return null;
}

export function PreviewSite({ content }: { content: SiteContent }) {
  const header = content.sections.find((section) => section.type === "header");
  const footer = content.sections.find((section) => section.type === "footer");
  return (
    <div
      className="store"
      style={themeStyle(content.theme)}
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (anchor) event.preventDefault();
      }}
    >
      {header?.enabled !== false ? (
        <>
          <Announcement content={content} />
          <Header content={content} />
        </>
      ) : null}
      <HomeSections content={content} quiet />
      {footer?.enabled !== false ? <Footer content={content} /> : null}
    </div>
  );
}

export function ShopView({
  content,
  categorySlug,
  sort,
}: {
  content: SiteContent;
  categorySlug?: string;
  sort?: string;
}) {
  const category = categorySlug ? categoryBySlug(content, categorySlug) : undefined;
  const products = useMemo(() => {
    let list = category ? content.products.filter((product) => product.categoryId === category.id) : [...content.products];
    if (sort === "prix-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "prix-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "nom") list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return list;
  }, [category, content.products, sort]);
  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <p className="crumbs">
        <Link href="/">Accueil</Link> / <Link href="/boutique">Boutique</Link>
        {category ? ` / ${category.name}` : ""}
      </p>
      <h1 className="page-title">{category ? category.name : "Boutique"}</h1>
      <p className="intro">{category ? category.description : "Toute la collection, du soin au parfum."}</p>
      <form className="filters" action={category ? `/boutique/${category.slug}` : "/boutique"}>
        <span className="note">
          {products.length} produit{products.length > 1 ? "s" : ""}
        </span>
        <label className="field">
          <span className="sr-only">Trier</span>
          <select name="tri" defaultValue={sort ?? ""} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="">Mis en avant</option>
            <option value="prix-asc">Prix croissant</option>
            <option value="prix-desc">Prix décroissant</option>
            <option value="nom">Nom</option>
          </select>
        </label>
      </form>
      {products.length === 0 ? <p className="empty">Aucun produit dans cette catégorie.</p> : null}
      <div className="product-grid shop-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

export function ProductView({ content, product }: { content: SiteContent; product: Product }) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const category = categoryById(content, product.categoryId);
  const related = relatedProducts(content, product);
  return (
    <div className="wrap">
      <p className="crumbs">
        <Link href="/">Accueil</Link> / <Link href="/boutique">Boutique</Link>
        {category ? (
          <>
            {" "}
            / <Link href={`/boutique/${category.slug}`}>{category.name}</Link>
          </>
        ) : null}
      </p>
      <article className="pdp">
        <div className="media portrait">
          <Photo src={product.images[0] ?? ""} alt={product.name} priority sizes="50vw" />
        </div>
        <div>
          {product.badge ? <p className="eyebrow">{product.badge}</p> : null}
          <h1>{product.name}</h1>
          <p className="lede" style={{ marginTop: 0 }}>
            {product.subtitle}
          </p>
          <p>
            <span className="price" style={{ fontSize: 20 }}>
              {formatPrice(product.price)}
            </span>
            {product.compareAt ? <span className="compare">{formatPrice(product.compareAt)}</span> : null}
          </p>
          <Stars value={product.rating} count={product.reviewCount} />
          <p>{product.description}</p>
          <p className="note">
            {product.volume} · {product.sku}
            {product.stock <= 0 ? " · Épuisé" : ` · ${product.stock} en stock`}
          </p>
          <div className="buy">
            <div className="qty" aria-label="Quantité">
              <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Diminuer">
                −
              </button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((value) => Math.min(8, product.stock, value + 1))} aria-label="Augmenter">
                +
              </button>
            </div>
            <button
              className="kd-btn"
              type="button"
              disabled={product.stock <= 0}
              onClick={() => {
                cart.add(product.id, qty);
                setAdded(true);
              }}
            >
              {added ? "Ajouté au panier" : "Ajouter au panier"}
            </button>
          </div>
          <div className="details">
            <details open>
              <summary>Ingrédients</summary>
              <p>{product.ingredients}</p>
            </details>
            <details>
              <summary>Utilisation</summary>
              <p>{product.usage}</p>
            </details>
            <details>
              <summary>Livraison et retours</summary>
              <p>
                Offerte dès {formatPrice(content.settings.freeShippingCents)}. Retour sous 14 jours pour les produits non
                ouverts. <Link href="/livraison">Détails</Link>
              </p>
            </details>
          </div>
        </div>
      </article>
      {related.length ? (
        <section className="section">
          <div className="section-head">
            <h2>Dans le même geste</h2>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function CartView({ content }: { content: SiteContent }) {
  const cart = useCart();
  const lines = cart.lines
    .map((line) => {
      const product = content.products.find((item) => item.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((line): line is { productId: string; qty: number; product: Product } => Boolean(line));
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const shipping = shippingCost(content, subtotal);
  const missing = Math.max(0, content.settings.freeShippingCents - subtotal);
  return (
    <div className="wrap">
      <h1 className="page-title">Panier</h1>
      {lines.length === 0 ? (
        <div className="empty">
          <p>Votre panier est vide.</p>
          <Link className="kd-btn" href="/boutique">
            Voir la boutique
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div>
            {lines.map((line) => (
              <div className="line" key={line.productId}>
                <div className="media square">
                  <Photo src={line.product.images[0] ?? ""} alt="" sizes="92px" />
                </div>
                <div>
                  <strong>{line.product.name}</strong>
                  <div className="note">{formatPrice(line.product.price)}</div>
                  <div className="qty">
                    <button type="button" aria-label="Diminuer" onClick={() => cart.setQty(line.productId, line.qty - 1)}>
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button type="button" aria-label="Augmenter" onClick={() => cart.setQty(line.productId, line.qty + 1)}>
                      +
                    </button>
                  </div>
                  <button type="button" className="quiet" onClick={() => cart.remove(line.productId)}>
                    Retirer
                  </button>
                </div>
                <strong>{formatPrice(line.product.price * line.qty)}</strong>
              </div>
            ))}
          </div>
          <aside className="summary">
            <h2 className="display" style={{ fontSize: "1.8rem", marginTop: 0 }}>
              Récapitulatif
            </h2>
            <div className="sum-row">
              <span>Sous-total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="sum-row">
              <span>Livraison</span>
              <span>{shipping === 0 ? "Offerte" : formatPrice(shipping)}</span>
            </div>
            <div className="sum-row">
              <strong>Total</strong>
              <strong>{formatPrice(subtotal + shipping)}</strong>
            </div>
            {missing > 0 ? <p className="note">Plus que {formatPrice(missing)} pour la livraison offerte.</p> : <p className="note">Livraison offerte.</p>}
            <Link className="kd-btn" href="/commande" style={{ width: "100%", marginTop: 12 }}>
              Commander
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

export function CheckoutView({ content }: { content: SiteContent }) {
  const cart = useCart();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const lines = cart.lines
    .map((line) => {
      const product = content.products.find((item) => item.id === line.productId);
      return product ? { product, qty: line.qty } : null;
    })
    .filter((line): line is { product: Product; qty: number } => Boolean(line));
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const shipping = shippingCost(content, subtotal);
  if (!lines.length) {
    return (
      <div className="wrap empty">
        <h1 className="page-title">Commande</h1>
        <p>Votre panier est vide.</p>
        <Link className="kd-btn" href="/boutique">
          Retour à la boutique
        </Link>
      </div>
    );
  }
  return (
    <div className="wrap">
      <h1 className="page-title">Commande</h1>
      <p className="note">Paiement simulé : aucune carte n'est débitée.</p>
      <form
        className="check-layout"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const form = new FormData(event.currentTarget);
          const result = await placeOrder({
            firstName: String(form.get("firstName") ?? ""),
            lastName: String(form.get("lastName") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? ""),
            address: String(form.get("address") ?? ""),
            postal: String(form.get("postal") ?? ""),
            city: String(form.get("city") ?? ""),
            country: String(form.get("country") ?? "France"),
            items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
          });
          setPending(false);
          if (!result.ok) {
            setErrors(result.errors);
            document.getElementById("error-title")?.focus();
            return;
          }
          localStorage.setItem("koundiata-email", String(form.get("email") ?? "").toLowerCase());
          cart.clear();
          window.location.href = `/commande/confirmation?id=${result.orderId}`;
        }}
      >
        <div className="stack-form" style={{ display: "grid", gap: 12 }}>
          {errors.form ? (
            <div className="alert" role="alert" tabIndex={-1} id="error-title">
              <strong>La commande n'a pas abouti.</strong>
              <div>{errors.form}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field name="firstName" label="Prénom" error={errors.firstName} />
            <Field name="lastName" label="Nom" error={errors.lastName} />
          </div>
          <Field name="email" label="E-mail" type="email" error={errors.email} />
          <Field name="phone" label="Téléphone" error={errors.phone} />
          <Field name="address" label="Adresse" error={errors.address} />
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
            <Field name="postal" label="Code postal" error={errors.postal} />
            <Field name="city" label="Ville" error={errors.city} />
          </div>
          <Field name="country" label="Pays" defaultValue="France" />
        </div>
        <aside className="summary">
          {lines.map((line) => (
            <div className="sum-row" key={line.product.id}>
              <span>
                {line.product.name} × {line.qty}
              </span>
              <span>{formatPrice(line.product.price * line.qty)}</span>
            </div>
          ))}
          <div className="sum-row">
            <span>Livraison</span>
            <span>{shipping === 0 ? "Offerte" : formatPrice(shipping)}</span>
          </div>
          <div className="sum-row">
            <strong>Total</strong>
            <strong>{formatPrice(subtotal + shipping)}</strong>
          </div>
          <button className="kd-btn" type="submit" disabled={pending} style={{ width: "100%", marginTop: 12 }}>
            {pending ? "Validation…" : "Valider la commande"}
          </button>
        </aside>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  error,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  error?: string;
  type?: string;
  defaultValue?: string;
}) {
  const id = `f-${name}`;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} name={name} type={type} defaultValue={defaultValue} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} />
      {error ? (
        <span id={`${id}-err`} className="err">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Article({ page }: { page: PageContent }) {
  return (
    <article className="wrap article">
      <h1 className="page-title">{page.title}</h1>
      <p className="intro">{page.intro}</p>
      {page.blocks.map((block) => (
        <section key={block.id}>
          <h2>{block.heading}</h2>
          {block.body.split("\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

export function FaqView({ content }: { content: SiteContent }) {
  return (
    <div className="wrap article faq">
      <h1 className="page-title">Questions fréquentes</h1>
      {content.faq.map((item) => (
        <details key={item.id}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function ContactView({ content }: { content: SiteContent }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <div className="wrap article">
      <h1 className="page-title">{content.contact.title}</h1>
      <p className="intro">{content.contact.intro}</p>
      <p>
        {content.settings.address}
        <br />
        {content.settings.hours}
        <br />
        <a href={`mailto:${content.settings.supportEmail}`}>{content.settings.supportEmail}</a>
        {content.settings.phone ? (
          <>
            <br />
            {content.settings.phone}
          </>
        ) : null}
      </p>
      {done ? <p role="status">Message envoyé. Nous vous répondons à l'adresse indiquée.</p> : null}
      <form
        className="stack-form"
        style={{ display: "grid", gap: 12, maxWidth: 560 }}
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const form = new FormData(event.currentTarget);
          const result = await sendMessage({
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            subject: String(form.get("subject") ?? ""),
            body: String(form.get("body") ?? ""),
          });
          setPending(false);
          if (!result.ok) {
            setErrors(result.errors);
            return;
          }
          setErrors({});
          setDone(true);
          event.currentTarget.reset();
        }}
      >
        <Field name="name" label="Nom" error={errors.name} />
        <Field name="email" label="E-mail" type="email" error={errors.email} />
        <label className="field">
          <span>Sujet</span>
          <select name="subject" defaultValue={content.contact.subjects[0] ?? ""} aria-invalid={Boolean(errors.subject)}>
            {content.contact.subjects.map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </select>
          {errors.subject ? <span className="err">{errors.subject}</span> : null}
        </label>
        <label className="field">
          <span>Message</span>
          <textarea name="body" aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? "body-err" : undefined} />
          {errors.body ? (
            <span id="body-err" className="err">
              {errors.body}
            </span>
          ) : null}
        </label>
        <button className="kd-btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </div>
  );
}

export function AccountView() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof ordersForEmail>> | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="wrap article">
      <h1 className="page-title">Votre compte</h1>
      <p className="intro">Retrouvez vos commandes avec l'e-mail utilisé au paiement. Pas de mot de passe : cette page ne crée pas de compte.</p>
      <form
        className="inline-form"
        style={{ justifyContent: "flex-start" }}
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const list = await ordersForEmail(email);
          setOrders(list);
          setPending(false);
        }}
      >
        <label className="field">
          <span>E-mail</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button className="kd-btn" type="submit" disabled={pending} style={{ alignSelf: "flex-end" }}>
          {pending ? "Recherche…" : "Voir mes commandes"}
        </button>
      </form>
      {orders && orders.length === 0 ? <p>Aucune commande pour cette adresse.</p> : null}
      {orders?.map((order) => (
        <article key={order.id} className="summary" style={{ marginTop: 12 }}>
          <strong>{order.id}</strong>
          <div className="note">
            {new Date(order.createdAt).toLocaleDateString("fr-FR")} · {order.status} · {formatPrice(order.total)}
          </div>
          <ul>
            {order.items.map((item) => (
              <li key={item.productId}>
                {item.name} × {item.qty}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function SearchView({ content, query }: { content: SiteContent; query: string }) {
  const needle = query.trim().toLowerCase();
  const products = needle
    ? content.products.filter((product) =>
        `${product.name} ${product.subtitle} ${product.description}`.toLowerCase().includes(needle),
      )
    : [];
  return (
    <div className="wrap" style={{ paddingBottom: 64 }}>
      <h1 className="page-title">Recherche</h1>
      <form action="/recherche" className="inline-form" style={{ justifyContent: "flex-start", margin: "16px 0 28px" }}>
        <label className="field">
          <span className="sr-only">Recherche</span>
          <input name="q" defaultValue={query} />
        </label>
        <button className="kd-btn" type="submit">
          Rechercher
        </button>
      </form>
      {!needle ? <p>Saisissez un nom de produit.</p> : null}
      {needle && products.length === 0 ? <p>Aucun résultat pour « {query} ».</p> : null}
      <div className="product-grid shop-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

export function ConfirmView({ id, total }: { id: string; total: string }) {
  return (
    <div className="wrap article">
      <p className="eyebrow">Commande confirmée</p>
      <h1 className="page-title">Merci.</h1>
      <p className="intro">
        Votre commande <strong>{id}</strong> est enregistrée. Total {total}. Le paiement de cette démonstration n'a rien débité.
      </p>
      <Link className="kd-btn" href="/compte">
        Suivre la commande
      </Link>
    </div>
  );
}
