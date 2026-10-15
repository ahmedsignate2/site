import type {
  Product,
  Section,
  SiteContent,
  TrustIcon,
} from "@/lib/types";

export function categoryById(content: SiteContent, id: string) {
  return content.categories.find((category) => category.id === id);
}

export function categoryBySlug(content: SiteContent, slug: string) {
  return content.categories.find((category) => category.slug === slug);
}

export function productBySlug(content: SiteContent, slug: string) {
  return content.products.find((product) => product.slug === slug);
}

export function productsFor(
  content: SiteContent,
  source: "bestsellers" | "featured" | "all" | "category",
  categoryId?: string,
  limit = 12,
) {
  let list = [...content.products];
  if (source === "bestsellers") list = list.filter((product) => product.bestseller);
  if (source === "featured") list = list.filter((product) => product.featured);
  if (source === "category" && categoryId) {
    list = list.filter((product) => product.categoryId === categoryId);
  }
  return list.slice(0, limit);
}

export function relatedProducts(content: SiteContent, product: Product, limit = 4) {
  return content.products
    .filter((item) => item.id !== product.id && item.categoryId === product.categoryId)
    .slice(0, limit);
}

export function searchProducts(content: SiteContent, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return content.products.filter((product) => {
    const category = categoryById(content, product.categoryId)?.name ?? "";
    return [product.name, product.subtitle, product.description, category, product.sku]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function shippingCost(content: SiteContent, subtotal: number) {
  if (subtotal <= 0) return 0;
  if (subtotal >= content.settings.freeShippingCents) return 0;
  return content.settings.shippingFlatCents;
}

export function trustIconLabel(icon: TrustIcon) {
  const labels: Record<TrustIcon, string> = {
    truck: "Livraison",
    lock: "Paiement",
    leaf: "Qualité",
    headset: "Support",
    return: "Retours",
  };
  return labels[icon];
}

export function createSection(type: Section["type"]): Section {
  const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case "header":
      return { id, type, enabled: true, label: "En-tête" };
    case "hero":
      return {
        id,
        type,
        enabled: true,
        label: "Bannière",
        hero: {
          eyebrow: "Nouvelle collection",
          title: "Un titre,\navec intention.",
          subtitle: "Décrivez la promesse de cette bannière en une ou deux phrases.",
          buttonLabel: "Découvrir",
          buttonHref: "/boutique",
          image: "/images/hero.jpg",
          imageAlt: "Campagne KOUNDIATA",
          mobileImage: "",
          distinctMobileImage: false,
          layout: "text-left",
          height: "large",
          overlay: 0,
        },
      };
    case "trust":
      return {
        id,
        type,
        enabled: true,
        label: "Avantages",
        items: [
          { id: "t1", title: "Livraison offerte", text: "Dès le seuil indiqué", icon: "truck" },
          { id: "t2", title: "Paiement sécurisé", text: "Visa, Mastercard, PayPal", icon: "lock" },
        ],
      };
    case "categories":
      return {
        id,
        type,
        enabled: true,
        label: "Collections",
        title: "Nos catégories",
        linkLabel: "Tout voir",
        linkHref: "/boutique",
      };
    case "products":
      return {
        id,
        type,
        enabled: true,
        label: "Grille produits",
        title: "Nos best-sellers",
        source: "bestsellers",
        linkLabel: "Tout voir",
        linkHref: "/boutique",
        limit: 6,
      };
    case "promos":
      return {
        id,
        type,
        enabled: true,
        label: "Bannière promotionnelle",
        cards: [
          {
            id: "p1",
            title: "Une attention particulière",
            text: "Ajoutez ici un message de saison.",
            cta: "En savoir plus",
            href: "/a-propos",
            image: "/images/texture.jpg",
            tone: "overlay",
          },
        ],
      };
    case "testimonials":
      return { id, type, enabled: true, label: "Témoignages", title: "Elles en parlent", items: [] };
    case "newsletter":
      return {
        id,
        type,
        enabled: true,
        label: "Newsletter",
        title: "La lettre de la maison",
        text: "Les lancements, les rituels, rien de plus.",
        placeholder: "Votre adresse e-mail",
        button: "S'inscrire",
      };
    case "gallery":
      return {
        id,
        type,
        enabled: true,
        label: "Galerie",
        title: "Galerie & Savoir-Faire",
        images: [
          {
            id: "g1",
            src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=80",
            alt: "Atelier & Matières d'exception",
          },
          {
            id: "g2",
            src: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1000&q=80",
            alt: "Rituels & Savoir-faire",
          },
        ],
      };
    case "custom":
      return {
        id,
        type,
        enabled: true,
        label: "Section personnalisée",
        title: "Texte et image",
        text: "Racontez un rituel, une matière, une saison.",
        buttonLabel: "Lire",
        buttonHref: "/a-propos",
        image: "/images/about.jpg",
        imageAlt: "Section éditoriale",
        layout: "text-left",
      };
    case "footer":
      return { id, type, enabled: true, label: "Pied de page" };
  }
}
