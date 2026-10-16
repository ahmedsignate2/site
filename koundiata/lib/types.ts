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

export type BusinessSector = "cosmetique" | "automobile" | "mode" | "hightech" | "universel";

export type AutomotiveSpecs = {
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuel: "Essence" | "Diesel" | "Hybride" | "Électrique";
  gearbox: "Manuelle" | "Automatique";
  powerCh: number;
  vin?: string;
  warrantyMonths?: number;
};

export type CosmeticSpecs = {
  inci: string;
  volumeMl?: string;
  skinType?: string;
  routineStep?: string;
  batchNumber?: string;
  expirationDate?: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  compareAt?: number;
  stock: number;
  attributes: Record<string, string>;
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
  stockAlertThreshold?: number;
  stockReorderQty?: number;
  featured: boolean;
  bestseller: boolean;
  ingredients: string;
  usage: string;
  volume: string;
  sku: string;
  variants?: ProductVariant[];
  automotiveSpecs?: AutomotiveSpecs;
  cosmeticSpecs?: CosmeticSpecs;
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
  sector?: BusinessSector;
  slogan?: string;
  businessType?: string;
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

export type OrderStatus =
  | "en_attente"
  | "payee"
  | "preparation"
  | "expediee"
  | "livree"
  | "annulee"
  | "echouee"
  | "remboursee_partiel"
  | "remboursee_total";

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  image: string;
  sku?: string;
  variantId?: string;
  variantName?: string;
};

export type PaymentRecord = {
  provider: "simulated" | "stripe";
  status: "pending" | "authorized" | "failed";
  reference: string;
};

export type ShippingDetails = {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
};

export type RefundRecord = {
  id: string;
  amount: number;
  reason: string;
  date: string;
  stripeRefundId?: string;
};

export type ReturnRequest = {
  id: string;
  status: "demande" | "validee" | "refusee" | "recue" | "remboursee";
  reason: string;
  items?: { productId: string; qty: number }[];
  requestedAt: string;
};

export type Order = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  demo: boolean;
  stockHeld?: boolean;
  /** Jeton aléatoire qui autorise l'annulation du paiement depuis le retour Stripe. */
  cancelToken?: string;
  /** Compte client qui a passé la commande. */
  customerId?: string;
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
  discount?: number;
  promoCode?: string;
  total: number;
  shippingDetails?: ShippingDetails;
  refunds?: RefundRecord[];
  returns?: ReturnRequest[];
};

export type PromoCode = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minPurchaseCents: number;
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  active: boolean;
};

export type AutomationEventName =
  | "order.created"
  | "payment.succeeded"
  | "payment.failed"
  | "order.preparation"
  | "order.shipped"
  | "order.delivered"
  | "order.refunded"
  | "stock.low"
  | "message.received"
  | "auth.login_alert"
  | "customer.welcome"
  | "customer.verify"
  | "customer.password_reset"
  | "admin.new_order";

export type EmailTemplate = {
  slug: string;
  name: string;
  category: "compte" | "commande" | "suivi" | "marketing" | "admin";
  subject: string;
  bodyHtml: string;
  variables: string[];
};

export type EmailLog = {
  id: string;
  event: string;
  recipient: string;
  subject: string;
  templateSlug: string;
  /** "simule" : aucun service d'envoi configuré, l'e-mail n'est pas parti. */
  status: "envoye" | "en_attente" | "echec" | "simule";
  sentAt: string;
  errorMessage?: string;
  idempotencyKey: string;
};

export type AdminRole = "owner" | "admin" | "order_manager" | "catalog_manager" | "support";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt?: string;
  /** Propriétaire principal (créé à l'installation) : personne d'autre ne peut le modifier, le désactiver ni le rétrograder. */
  primary?: boolean;
  /** Hachage scrypt du mot de passe ("scrypt$sel$hash"). Jamais envoyé au navigateur. */
  passwordHash?: string;
  /** Incrémenté à chaque changement de mot de passe ou de rôle : invalide les sessions ouvertes. */
  sessionVersion?: number;
};

/** Utilisateur du studio tel qu'il est exposé au navigateur (sans secret). */
export type PublicAdminUser = Omit<AdminUser, "passwordHash" | "sessionVersion">;

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
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

export type CustomerAddress = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postal: string;
  city: string;
  country: string;
  isDefault: boolean;
};

export type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  passwordHash: string;
  sessionVersion: number;
  createdAt: string;
  lastLoginAt?: string;
  emailVerified: boolean;
  marketingOptIn: boolean;
  /** Suspendu par l'équipe du studio : ne peut plus se connecter ni commander. */
  blocked: boolean;
  addresses: CustomerAddress[];
  wishlist: string[];
  /** Jeton à usage unique (haché) pour la réinitialisation du mot de passe ou la vérification d'e-mail. */
  tokens?: { kind: "reset" | "verify"; hash: string; expiresAt: string }[];
};

/** Client tel qu'il est exposé au navigateur. */
export type PublicCustomer = Omit<Customer, "passwordHash" | "sessionVersion" | "tokens">;

/**
 * Clés des services externes saisies depuis le studio (page Installation).
 * Les secrets sont chiffrés (AES-GCM, clé dérivée de AUTH_SECRET).
 * Une variable d'environnement du même nom est toujours prioritaire.
 */
export type IntegrationSettings = {
  siteUrl?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  resendApiKey?: string;
  emailFrom?: string;
  adminNotifyEmail?: string;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3PublicUrl?: string;
  s3Region?: string;
};

export type StoreData = {
  draft: SiteContent;
  published: SiteContent;
  orders: Order[];
  subscribers: Subscriber[];
  messages: ContactMessage[];
  promoCodes?: PromoCode[];
  emailTemplates?: EmailTemplate[];
  emailLogs?: EmailLog[];
  auditLogs?: AuditLogEntry[];
  adminUsers?: AdminUser[];
  customers?: Customer[];
  integrations?: IntegrationSettings;
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
  promoCode?: string;
  acceptTerms?: boolean;
  saveAddress?: boolean;
};
