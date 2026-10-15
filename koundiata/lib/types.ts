export type Theme = {
  background: string;
  foreground: string;
  muted: string;
  card: string;
  border: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  announcement: string;
  announcementForeground: string;
  radius: number;
};

export type NavLink = { id: string; label: string; href: string };

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  linkLabel: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  compareAt?: number;
  categoryId: string;
  images: string[];
  rating: number;
  reviewCount: number;
  badge?: string;
  stock: number;
  featured: boolean;
  bestseller: boolean;
  ingredients: string;
  usage: string;
  volume: string;
  sku: string;
};

export type TrustIcon = "truck" | "lock" | "leaf" | "headset" | "return";

export type TrustItem = {
  id: string;
  title: string;
  text: string;
  icon: TrustIcon;
};

export type PromoCard = {
  id: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  image: string;
  tone: "overlay" | "panel";
  badge?: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  detail: string;
};

export type GalleryImage = { id: string; src: string; alt: string };

export type HeroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonHref: string;
  image: string;
  imageAlt: string;
  mobileImage: string;
  distinctMobileImage: boolean;
  layout: "text-left" | "text-right";
  height: "small" | "medium" | "large";
  overlay: number;
};

export type SectionBase = { id: string; enabled: boolean; label: string };

export type Section =
  | (SectionBase & { type: "header" })
  | (SectionBase & { type: "hero"; hero: HeroContent })
  | (SectionBase & { type: "trust"; items: TrustItem[] })
  | (SectionBase & {
      type: "categories";
      title: string;
      linkLabel: string;
      linkHref: string;
    })
  | (SectionBase & {
      type: "products";
      title: string;
      source: "bestsellers" | "featured" | "all" | "category";
      categoryId?: string;
      linkLabel: string;
      linkHref: string;
      limit: number;
    })
  | (SectionBase & { type: "promos"; cards: PromoCard[] })
  | (SectionBase & { type: "testimonials"; title: string; items: Testimonial[] })
  | (SectionBase & {
      type: "newsletter";
      title: string;
      text: string;
      placeholder: string;
      button: string;
    })
  | (SectionBase & { type: "gallery"; title: string; images: GalleryImage[] })
  | (SectionBase & {
      type: "custom";
      title: string;
      text: string;
      buttonLabel: string;
      buttonHref: string;
      image: string;
      imageAlt: string;
      layout: "text-left" | "text-right";
    })
  | (SectionBase & { type: "footer" });

export type FooterColumn = { id: string; title: string; links: NavLink[] };

export type SiteSettings = {
  brandName: string;
  studioName: string;
  tagline: string;
  announcement: string;
  localeLabel: string;
  currency: "EUR";
  freeShippingCents: number;
  shippingFlatCents: number;
  supportEmail: string;
  phone: string;
  address: string;
  hours: string;
  instagram: string;
  legalName: string;
  legalForm: string;
  siret: string;
  vat: string;
  host: string;
  publicationDirector: string;
};

export type PageContent = {
  title: string;
  intro: string;
  blocks: { id: string; heading: string; body: string }[];
};

export type FaqItem = { id: string; question: string; answer: string };

export type SiteContent = {
  settings: SiteSettings;
  theme: Theme;
  navigation: NavLink[];
  categories: Category[];
  products: Product[];
  sections: Section[];
  footer: {
    blurb: string;
    columns: FooterColumn[];
    newsletterTitle: string;
    newsletterText: string;
    copyright: string;
  };
  about: PageContent;
  marques: PageContent;
  faq: FaqItem[];
  mentions: PageContent;
  cgv: PageContent;
  privacy: PageContent;
  shipping: PageContent;
  contact: {
    title: string;
    intro: string;
    subjects: string[];
  };
};

export type OrderStatus = "payee" | "preparation" | "expediee" | "livree" | "annulee";

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  image: string;
};

export type PaymentRecord = {
  provider: "simulated";
  status: "authorized";
  reference: string;
};

export type Order = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  demo: boolean;
  payment?: PaymentRecord;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    postal: string;
    city: string;
    country: string;
  };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
};

export type Subscriber = { id: string; email: string; createdAt: string };

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type StoreData = {
  draft: SiteContent;
  published: SiteContent;
  orders: Order[];
  subscribers: Subscriber[];
  messages: ContactMessage[];
};

export type CheckoutInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postal: string;
  city: string;
  country: string;
  items: { productId: string; qty: number }[];
  note?: string;
};
