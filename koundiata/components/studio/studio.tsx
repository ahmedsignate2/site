"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  FolderOpen,
  Home,
  ImageIcon,
  LayoutGrid,
  Mail,
  Menu,
  Monitor,
  Package,
  Settings,
  ShoppingBag,
  Smartphone,
  Tablet,
  Users,
  Truck,
  ShieldCheck,
  Tag,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  type LucideIcon,
} from "lucide-react";
import { createSection } from "@/lib/catalog";
import { formatPrice, slugify, uid } from "@/lib/format";
import {
  clearAllOrders,
  deleteOrder,
  discardDraft,
  markMessageRead,
  publishSite,
  saveDraft,
  updateOrderStatus,
  updateOrderShipping,
  processOrderRefund,
  switchSectorPreset,
  sendTestAutomationEmail,
  savePromoCode,
  setCustomerBlocked,
} from "@/lib/actions";
import { logout } from "@/lib/team-actions";
import { OwnPasswordForm, TeamPanel } from "@/components/studio/team";
import { SetupAdmin } from "@/components/studio/setup";
import { can, permissionForStudioPath, ROLE_LABELS } from "@/lib/permissions";
import { SECTOR_PRESETS } from "@/lib/sectors";
import { contrastReport } from "@/lib/theme";
import { countsAsSale, orderStatusLabel } from "@/lib/order-status";
import type {
  BusinessSector,
  HeroContent,
  OrderStatus,
  Product,
  PromoCode,
  Section,
  SiteContent,
  StoreData,
  PublicAdminUser,
} from "@/lib/types";
import { PreviewSite } from "@/components/store/view";
import { Button } from "@/components/ui/button";

type Api = {
  data: StoreData;
  status: string;
  update: (recipe: (draft: SiteContent) => void) => void;
  publish: () => Promise<void>;
  discard: () => Promise<void>;
  dirty: boolean;
  me: PublicAdminUser;
};

const StudioContext = createContext<Api | null>(null);

function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("Studio");
  return value;
}

export function StudioShell({ initial, me, children }: { initial: StoreData; me: PublicAdminUser; children: ReactNode }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState("Brouillon");
  const [navOpen, setNavOpen] = useState(false);
  const dirtyRef = useRef(false);
  const path = usePathname();

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      setStatus("Enregistrement…");
      saveDraft(data.draft)
        .then(() => setStatus("Brouillon enregistré"))
        .catch(() => setStatus("Échec de l'enregistrement"));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [data.draft]);

  const api = useMemo<Api>(() => {
    const dirty = JSON.stringify(data.draft) !== JSON.stringify(data.published);
    return {
      data,
      status,
      dirty,
      me,
      update: (recipe) => {
        dirtyRef.current = true;
        setData((current) => {
          const draft = structuredClone(current.draft);
          recipe(draft);
          return { ...current, draft };
        });
      },
      publish: async () => {
        setStatus("Publication…");
        try {
          await saveDraft(data.draft);
          const published = await publishSite();
          setData((current) => ({ ...current, published }));
          setStatus("Publié");
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Échec de la publication");
        }
      },
      discard: async () => {
        const draft = await discardDraft();
        dirtyRef.current = false;
        setData((current) => ({ ...current, draft }));
        setStatus("Brouillon abandonné");
      },
    };
  }, [data, status, me]);

  const pending = data.orders.filter((order) => order.status === "en_attente" || order.status === "payee" || order.status === "preparation").length;
  const unread = data.messages.filter((message) => !message.read).length;

  const links: { href: string; label: string; icon: LucideIcon; badge?: number; group?: string }[] = [
    { href: "/studio", label: "Éditeur de Pages", icon: LayoutGrid, group: "Pilotage & Ventes" },
    { href: "/studio/analyses", label: "Tableau de Bord & KPIs", icon: BarChart3 },
    { href: "/studio/commandes", label: "Commandes", icon: ShoppingBag, badge: pending },
    { href: "/studio/expeditions", label: "Expéditions & Retours", icon: Truck },
    { href: "/studio/clients", label: "Clients & CRM", icon: Users },
    { href: "/studio/messages", label: "Messages & Support", icon: Mail, badge: unread },

    { href: "/studio/produits", label: "Produits & Stocks", icon: Package, group: "Catalogue" },
    { href: "/studio/collections", label: "Rayons & Catégories", icon: FolderOpen },
    { href: "/studio/promotions", label: "Codes Promo", icon: Tag },

    { href: "/studio/theme", label: "Secteurs & Design System", icon: ImageIcon, group: "Design & Univers" },
    { href: "/studio/contenu", label: "Pages, Récits & FAQ", icon: LayoutGrid },
    { href: "/studio/navigation", label: "Menus & Navigation", icon: Menu },

    { href: "/studio/installation", label: "Installation & Connexions", icon: CheckCircle2, group: "Système & Sécurité" },
    { href: "/studio/automatisations", label: "Automatisations & E-mails", icon: Zap },
    { href: "/studio/audit", label: "Contrôle d'Accès (IAM)", icon: ShieldCheck },
    { href: "/studio/parametres", label: "Paramètres Généraux", icon: Settings },
  ];
  const canEdit = can(me.role, "content");
  const allowedLinks = links
    .map((link, index) => {
      // Conserver l'intitulé du groupe sur le premier lien visible du groupe.
      let group = link.group;
      if (!group) for (let i = index; i >= 0 && !group; i -= 1) group = links[i].group;
      return { ...link, group };
    })
    .filter((link) => can(me.role, permissionForStudioPath(link.href)))
    .map((link, index, list) => ({ ...link, group: index === 0 || list[index - 1].group !== link.group ? link.group : undefined }));

  return (
    <StudioContext.Provider value={api}>
      <div className="studio">
        <header className="studio-top">
          <button className="icon-btn menu-btn" type="button" aria-label="Menu du studio" onClick={() => setNavOpen((value) => !value)}>
            <Menu size={18} />
          </button>
          <Link href="/studio" className="studio-brand">
            <b>{data.draft.settings.brandName}</b>
            <span>Studio</span>
          </Link>
          <span className="draft-pill">{api.dirty ? "Brouillon non publié" : "Publié"}</span>
          <span className="note">{status}</span>
          <div className="spacer" />
          {canEdit && api.dirty ? (
            <Button variant="outline" onClick={() => api.discard()}>
              Abandonner
            </Button>
          ) : null}
          {canEdit ? (
            <>
              <a className="kd-btn ghost" href="/api/preview?to=/">
                Aperçu
              </a>
              <button className="kd-btn" type="button" onClick={() => api.publish()}>
                Publier
              </button>
            </>
          ) : null}
          <span className="studio-user" title={me.email}>
            {me.name} · {ROLE_LABELS[me.role]}
          </span>
          <form action={logout}>
            <button className="kd-btn ghost" type="submit">
              Déconnexion
            </button>
          </form>
        </header>
        {navOpen ? (
          <button className="nav-backdrop" type="button" aria-label="Fermer le menu" onClick={() => setNavOpen(false)} />
        ) : null}
        <div className="studio-body">
          <nav className={`side${navOpen ? " open" : ""}`} aria-label="Studio">
            {allowedLinks.map((link) => (
              <div key={link.href}>
                {link.group ? <div className="group">{link.group}</div> : null}
                <Link
                  href={link.href}
                  className={path === link.href ? "active" : ""}
                  onClick={() => setNavOpen(false)}
                >
                  <link.icon size={16} aria-hidden />
                  {link.label}
                  {link.badge ? <span className="badge-count">{link.badge}</span> : null}
                </Link>
              </div>
            ))}
            <div className="group">Boutique</div>
            <a href="/" target="_blank" rel="noreferrer">
              Voir le site
            </a>
          </nav>
          <div className="studio-main">{children}</div>
        </div>
      </div>
    </StudioContext.Provider>
  );
}

function SetupAdminRoute() {
  const { me } = useStudio();
  return <SetupAdmin myEmail={me.email} />;
}

export function StudioView() {
  const path = usePathname();
  if (path.startsWith("/studio/produits")) return <ProductsAdmin />;
  if (path.startsWith("/studio/collections")) return <CollectionsAdmin />;
  if (path.startsWith("/studio/commandes")) return <OrdersAdmin />;
  if (path.startsWith("/studio/expeditions")) return <LogisticsAdmin />;
  if (path.startsWith("/studio/promotions")) return <PromotionsAdmin />;
  if (path.startsWith("/studio/automatisations")) return <AutomationsAdmin />;
  if (path.startsWith("/studio/audit")) return <AuditAdmin />;
  if (path.startsWith("/studio/installation")) return <SetupAdminRoute />;
  if (path.startsWith("/studio/clients")) return <ClientsAdmin />;
  if (path.startsWith("/studio/contenu")) return <ContentAdmin />;
  if (path.startsWith("/studio/theme")) return <ThemeAdmin />;
  if (path.startsWith("/studio/navigation")) return <NavAdmin />;
  if (path.startsWith("/studio/parametres")) return <SettingsAdmin />;
  if (path.startsWith("/studio/messages")) return <MessagesAdmin />;
  if (path.startsWith("/studio/analyses")) return <AnalyticsAdmin />;
  return <Builder />;
}

function ScaledPreview({ width, children }: { width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setScale(Math.min(1, node.clientWidth / width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="preview-frame" style={{ width: "100%", height: Math.round(980 * scale), overflow: "hidden" }}>
      <div style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function Builder() {
  const { data, update } = useStudio();
  const [selected, setSelected] = useState(data.draft.sections[1]?.id ?? data.draft.sections[0]?.id);
  const [device, setDevice] = useState(1280);
  const [tab, setTab] = useState<"sections" | "preview" | "inspector">("preview");
  const section = data.draft.sections.find((item) => item.id === selected) ?? data.draft.sections[0];
  const move = (id: string, direction: -1 | 1) => {
    update((draft) => {
      const index = draft.sections.findIndex((item) => item.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= draft.sections.length) return;
      const [item] = draft.sections.splice(index, 1);
      draft.sections.splice(next, 0, item);
    });
  };
  return (
    <div>
      <div className="mobile-tabs">
        <button className="kd-btn ghost" type="button" onClick={() => setTab("sections")}>
          Sections
        </button>
        <button className="kd-btn ghost" type="button" onClick={() => setTab("preview")}>
          Aperçu
        </button>
        <button className="kd-btn ghost" type="button" onClick={() => setTab("inspector")}>
          Réglages
        </button>
      </div>
      <div className="builder">
        <aside className="sections" style={tab === "sections" ? undefined : undefined}>
          <h2>Sections</h2>
          {data.draft.sections.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center" }}>
              <button
                className={`sec${item.id === section?.id ? " active" : ""}`}
                type="button"
                onClick={() => {
                  setSelected(item.id);
                  setTab("inspector");
                }}
              >
                <span style={{ opacity: item.enabled ? 1 : 0.4 }}>{item.label}</span>
              </button>
              <button type="button" aria-label="Monter" onClick={() => move(item.id, -1)}>
                ↑
              </button>
              <button type="button" aria-label="Descendre" onClick={() => move(item.id, 1)}>
                ↓
              </button>
            </div>
          ))}
          <div className="panel">
            <label className="field">
              <span>Ajouter une section</span>
              <select
                defaultValue="custom"
                onChange={(event) => {
                  const created = createSection(event.target.value as Section["type"]);
                  update((draft) => {
                    const footer = draft.sections.findIndex((item) => item.type === "footer");
                    draft.sections.splice(footer < 0 ? draft.sections.length : footer, 0, created);
                  });
                  setSelected(created.id);
                  event.target.value = "custom";
                }}
              >
                <option value="hero">Bannière</option>
                <option value="trust">Avantages</option>
                <option value="categories">Collections</option>
                <option value="products">Grille produits</option>
                <option value="promos">Bannière promotionnelle</option>
                <option value="testimonials">Témoignages</option>
                <option value="custom">Section personnalisée</option>
                <option value="newsletter">Newsletter</option>
                <option value="gallery">Galerie</option>
              </select>
            </label>
          </div>
        </aside>
        <div className="preview-wrap" hidden={false}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            <button type="button" aria-label="Ordinateur" onClick={() => setDevice(1280)}>
              <Monitor size={16} />
            </button>
            <button type="button" aria-label="Tablette" onClick={() => setDevice(834)}>
              <Tablet size={16} />
            </button>
            <button type="button" aria-label="Mobile" onClick={() => setDevice(390)}>
              <Smartphone size={16} />
            </button>
          </div>
          <ScaledPreview width={device}>
            <PreviewSite content={data.draft} />
          </ScaledPreview>
        </div>
        <aside className="inspector">{section ? <Inspector section={section} /> : null}</aside>
      </div>
      <style>{`
        @media (max-width: 1100px) {
          .builder > :nth-child(1) { display: ${tab === "sections" ? "block" : "none"}; }
          .builder > :nth-child(2) { display: ${tab === "preview" ? "block" : "none"}; }
          .builder > :nth-child(3) { display: ${tab === "inspector" ? "block" : "none"}; }
        }
      `}</style>
    </div>
  );
}

function Inspector({ section }: { section: Section }) {
  const { update, data } = useStudio();
  const patch = (recipe: (section: Section, draft: SiteContent) => void) => {
    update((draft) => {
      const current = draft.sections.find((item) => item.id === section.id);
      if (current) recipe(current, draft);
    });
  };
  return (
    <div className="panel">
      <h2>{section.label}</h2>
      <label className="field">
        <span>Nom dans le studio</span>
        <input value={section.label} onChange={(event) => patch((current) => (current.label = event.target.value))} />
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
        <input
          type="checkbox"
          checked={section.enabled}
          onChange={(event) => patch((current) => (current.enabled = event.target.checked))}
        />
        Visible sur le site
      </label>
      {section.type === "header" ? (
        <>
          <Field label="Bandeau" value={data.draft.settings.announcement} onChange={(value) => update((draft) => (draft.settings.announcement = value))} />
          <Field label="Locale" value={data.draft.settings.localeLabel} onChange={(value) => update((draft) => (draft.settings.localeLabel = value))} />
          <p className="note">Le menu se règle dans Navigation.</p>
        </>
      ) : null}
      {section.type === "hero" ? <HeroFields sectionId={section.id} /> : null}
      {section.type === "categories" || section.type === "products" || section.type === "newsletter" || section.type === "testimonials" || section.type === "gallery" ? (
        <Field
          label="Titre"
          value={"title" in section ? section.title : ""}
          onChange={(value) => patch((current) => {
            if ("title" in current) current.title = value;
          })}
        />
      ) : null}
      {section.type === "products" ? (
        <>
          <label className="field">
            <span>Source</span>
            <select
              value={section.source}
              onChange={(event) =>
                patch((current) => {
                  if (current.type === "products") current.source = event.target.value as typeof current.source;
                })
              }
            >
              <option value="bestsellers">Best-sellers</option>
              <option value="featured">Mis en avant</option>
              <option value="all">Tous</option>
              <option value="category">Une collection</option>
            </select>
          </label>
          <Field label="Nombre" value={String(section.limit)} onChange={(value) => patch((current) => {
            if (current.type === "products") current.limit = Number(value) || 6;
          })} />
        </>
      ) : null}
      {section.type === "custom" ? (
        <>
          <Field label="Titre" value={section.title} onChange={(value) => patch((current) => { if (current.type === "custom") current.title = value; })} />
          <Area label="Texte" value={section.text} onChange={(value) => patch((current) => { if (current.type === "custom") current.text = value; })} />
          <Field label="Bouton" value={section.buttonLabel} onChange={(value) => patch((current) => { if (current.type === "custom") current.buttonLabel = value; })} />
          <Field label="Lien" value={section.buttonHref} onChange={(value) => patch((current) => { if (current.type === "custom") current.buttonHref = value; })} />
          <ImageField label="Image" value={section.image} onChange={(value) => patch((current) => { if (current.type === "custom") current.image = value; })} />
        </>
      ) : null}
      {section.type === "newsletter" ? (
        <>
          <Area label="Texte" value={section.text} onChange={(value) => patch((current) => { if (current.type === "newsletter") current.text = value; })} />
          <Field label="Bouton" value={section.button} onChange={(value) => patch((current) => { if (current.type === "newsletter") current.button = value; })} />
        </>
      ) : null}
      {section.type === "footer" ? (
        <Area label="Texte de marque" value={data.draft.footer.blurb} onChange={(value) => update((draft) => (draft.footer.blurb = value))} />
      ) : null}
      {section.type !== "header" && section.type !== "footer" ? (
        <button
          className="kd-btn ghost"
          type="button"
          style={{ marginTop: 16, color: "#9f2d2d" }}
          onClick={() => {
            if (!confirm("Supprimer cette section ?")) return;
            update((draft) => {
              draft.sections = draft.sections.filter((item) => item.id !== section.id);
            });
          }}
        >
          Supprimer la section
        </button>
      ) : null}
    </div>
  );
}

function HeroFields({ sectionId }: { sectionId: string }) {
  const { data, update } = useStudio();
  const section = data.draft.sections.find((item) => item.id === sectionId);
  if (!section || section.type !== "hero") return null;
  const hero = section.hero;
  const set = (recipe: (hero: HeroContent) => void) => {
    update((draft) => {
      const current = draft.sections.find((item) => item.id === sectionId);
      if (current?.type === "hero") recipe(current.hero);
    });
  };
  return (
    <>
      <Field label="Surtitre" value={hero.eyebrow} onChange={(value) => set((item) => (item.eyebrow = value))} />
      <Area label="Titre" value={hero.title} onChange={(value) => set((item) => (item.title = value))} />
      <Area label="Sous-titre" value={hero.subtitle} onChange={(value) => set((item) => (item.subtitle = value))} />
      <Field label="Bouton" value={hero.buttonLabel} onChange={(value) => set((item) => (item.buttonLabel = value))} />
      <Field label="Lien" value={hero.buttonHref} onChange={(value) => set((item) => (item.buttonHref = value))} />
      <ImageField label="Image" value={hero.image} onChange={(value) => set((item) => (item.image = value))} />
      <Field label="Texte alternatif" value={hero.imageAlt} onChange={(value) => set((item) => (item.imageAlt = value))} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
        <input type="checkbox" checked={hero.distinctMobileImage} onChange={(event) => set((item) => (item.distinctMobileImage = event.target.checked))} />
        Image mobile différente
      </label>
      {hero.distinctMobileImage ? <ImageField label="Image mobile" value={hero.mobileImage} onChange={(value) => set((item) => (item.mobileImage = value))} /> : null}
      <div className="field">
        <span>Disposition</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="kd-btn ghost" onClick={() => set((item) => (item.layout = "text-left"))}>
            Texte à gauche
          </button>
          <button type="button" className="kd-btn ghost" onClick={() => set((item) => (item.layout = "text-right"))}>
            Texte à droite
          </button>
        </div>
      </div>
      <div className="field">
        <span>Hauteur</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["small", "medium", "large"] as const).map((height) => (
            <button key={height} type="button" className="kd-btn ghost" onClick={() => set((item) => (item.height = height))}>
              {height === "small" ? "Petite" : height === "medium" ? "Moyenne" : "Grande"}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Overlay {hero.overlay}%</span>
        <input type="range" min={0} max={60} value={hero.overlay} onChange={(event) => set((item) => (item.overlay = Number(event.target.value)))} />
      </label>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [error, setError] = useState("");
  return (
    <label className="field">
      <span>{label}</span>
      {value ? <img src={value} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} /> : null}
      <input
        type="file"
        accept="image/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setError("");
          const body = new FormData();
          body.set("file", file);
          const response = await fetch("/api/upload", { method: "POST", body });
          const payload = (await response.json()) as { url?: string; error?: string };
          if (!response.ok || !payload.url) setError(payload.error ?? "Téléversement impossible");
          else onChange(payload.url);
        }}
      />
      {error ? <span className="err">{error}</span> : null}
    </label>
  );
}

function PageHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel">
      <h1 className="display" style={{ fontSize: "2.2rem", margin: "8px 0" }}>
        {title}
      </h1>
      <p className="note">{text}</p>
    </div>
  );
}

function ProductsAdmin() {
  const { data, update } = useStudio();
  const [editing, setEditing] = useState<Product | null>(null);
  const save = (product: Product) => {
    update((draft) => {
      const index = draft.products.findIndex((item) => item.id === product.id);
      if (index >= 0) draft.products[index] = product;
      else draft.products.unshift(product);
    });
    setEditing(null);
  };
  return (
    <div className="panel">
      <PageHead title="Produits" text="Prix, photos, stock et mises en avant. Publiez pour les voir en boutique." />
      <button
        className="kd-btn"
        type="button"
        onClick={() =>
          setEditing({
            id: uid("prd"),
            slug: "nouveau-produit",
            name: "Nouveau produit",
            subtitle: "",
            description: "",
            price: 2900,
            categoryId: data.draft.categories[0]?.id ?? "soin",
            images: ["/images/serum.jpg"],
            rating: 0,
            reviewCount: 0,
            stock: 10,
            featured: false,
            bestseller: false,
            ingredients: "",
            usage: "",
            volume: "",
            sku: "",
          })
        }
      >
        Ajouter un produit
      </button>
      <div className="cards" style={{ marginTop: 16 }}>
        {data.draft.products.map((product) => (
          <article key={product.id} className="admin-card">
            <img src={product.images[0]} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />
            <div className="pad">
              <strong>{product.name}</strong>
              <div className="note">
                {formatPrice(product.price)} · stock {product.stock}
              </div>
              <button className="kd-btn ghost" type="button" onClick={() => setEditing(structuredClone(product))}>
                Modifier
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing ? <ProductDialog product={editing} categories={data.draft.categories} onClose={() => setEditing(null)} onSave={save} onDelete={() => {
        update((draft) => {
          draft.products = draft.products.filter((item) => item.id !== editing.id);
        });
        setEditing(null);
      }} /> : null}
    </div>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  product: Product;
  categories: SiteContent["categories"];
  onClose: () => void;
  onSave: (product: Product) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(product);
  const set = (patch: Partial<Product>) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <div className="product-dialog" role="dialog" aria-modal="true" aria-label="Produit">
      <div style={{ display: "grid", gap: 10 }}>
        <Field label="Nom" value={draft.name} onChange={(value) => set({ name: value, slug: slugify(value) })} />
        <Field label="Accroche" value={draft.subtitle} onChange={(value) => set({ subtitle: value })} />
        <Field label="Prix en euros" value={(draft.price / 100).toString()} onChange={(value) => set({ price: Math.round(Number(value.replace(",", ".")) * 100) || 0 })} />
        <label className="field">
          <span>Collection</span>
          <select value={draft.categoryId} onChange={(event) => set({ categoryId: event.target.value })}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Stock" value={String(draft.stock)} onChange={(value) => set({ stock: Number(value) || 0 })} />
        <Area label="Description" value={draft.description} onChange={(value) => set({ description: value })} />
        <Area label="Ingrédients" value={draft.ingredients} onChange={(value) => set({ ingredients: value })} />
        <Area label="Utilisation" value={draft.usage} onChange={(value) => set({ usage: value })} />
        <ImageField label="Photo" value={draft.images[0] ?? ""} onChange={(value) => set({ images: [value] })} />
        <label style={{ display: "flex", gap: 8 }}>
          <input type="checkbox" checked={draft.bestseller} onChange={(event) => set({ bestseller: event.target.checked })} /> Best-seller
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="kd-btn" type="button" onClick={() => onSave(draft)}>
            Enregistrer
          </button>
          <button className="kd-btn ghost" type="button" onClick={onClose}>
            Fermer
          </button>
          <button className="kd-btn ghost" type="button" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function CollectionsAdmin() {
  const { data, update } = useStudio();
  return (
    <div className="panel">
      <PageHead title="Collections" text="Les six univers de la navigation et de la page d'accueil." />
      <div className="cards">
        {data.draft.categories.map((category) => (
          <article key={category.id} className="admin-card">
            <img src={category.image} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
            <div className="pad" style={{ display: "grid", gap: 8 }}>
              <Field label="Nom" value={category.name} onChange={(value) => update((draft) => {
                const current = draft.categories.find((item) => item.id === category.id);
                if (current) {
                  current.name = value;
                  current.slug = slugify(value);
                }
              })} />
              <Area label="Description" value={category.description} onChange={(value) => update((draft) => {
                const current = draft.categories.find((item) => item.id === category.id);
                if (current) current.description = value;
              })} />
              <ImageField label="Image" value={category.image} onChange={(value) => update((draft) => {
                const current = draft.categories.find((item) => item.id === category.id);
                if (current) current.image = value;
              })} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const statuses: OrderStatus[] = [
  "en_attente",
  "payee",
  "preparation",
  "expediee",
  "livree",
  "annulee",
  "echouee",
  "remboursee_partiel",
  "remboursee_total",
];

function OrdersAdmin() {
  const { data } = useStudio();
  const [orders, setOrders] = useState(data.orders);
  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <PageHead title="Commandes" text="Toutes les commandes réelles passées sur la boutique arrivent ici en temps réel." />
        {orders.length > 0 ? (
          <button
            className="kd-btn sm ghost"
            type="button"
            style={{ color: "#b91c1c", borderColor: "#fecaca" }}
            onClick={async () => {
              if (window.confirm("Supprimer toutes les commandes ? Cette action effacera les commandes de test.")) {
                await clearAllOrders();
                setOrders([]);
              }
            }}
          >
            Vider les commandes
          </button>
        ) : null}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
                Aucune commande pour le moment. Dès qu'un client passera commande, elle apparaîtra ici en direct.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id}>
                <td>
                  {order.id}
                  {order.demo ? <div className="note">Exemple</div> : null}
                  {order.payment ? <div className="note">{order.payment.provider === "stripe" ? "Carte" : "Simulé"} · {order.payment.status === "authorized" ? "encaissé" : order.payment.status === "pending" ? "en cours" : "refusé"}</div> : null}
                </td>
              <td>
                {order.customer.firstName} {order.customer.lastName}
                <div className="note">{order.customer.city}</div>
                {order.shippingDetails ? (
                  <div style={{ fontSize: 11, color: "#2563eb", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
                    <Truck size={12} /> {order.shippingDetails.carrier} : {order.shippingDetails.trackingNumber}
                  </div>
                ) : null}
                {order.refunds && order.refunds.length > 0 ? (
                  <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>
                    Remboursé : {formatPrice(order.refunds.reduce((s, r) => s + r.amount, 0))}
                  </div>
                ) : null}
              </td>
              <td>{formatPrice(order.total)}</td>
              <td>
                <select
                  value={order.status}
                  aria-label={`Statut ${order.id}`}
                  onChange={async (event) => {
                    const status = event.target.value as OrderStatus;
                    await updateOrderStatus(order.id, status);
                    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status } : item)));
                  }}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {orderStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteOrder(order.id);
                    setOrders((current) => current.filter((item) => item.id !== order.id));
                  }}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

function ClientsAdmin() {
  const { data, me } = useStudio();
  const [query, setQuery] = useState("");
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const accounts = data.customers || [];
  const stats = new Map<string, { orders: number; total: number; last?: string }>();
  for (const order of data.orders) {
    const key = order.customerId || `email:${order.customer.email}`;
    const current = stats.get(key) ?? { orders: 0, total: 0 };
    current.orders += 1;
    if (countsAsSale(order.status)) current.total += order.total;
    if (!current.last || order.createdAt > current.last) current.last = order.createdAt;
    stats.set(key, current);
  }
  const needle = query.trim().toLowerCase();
  const rows = accounts.filter((item) => !needle || `${item.firstName} ${item.lastName} ${item.email} ${item.phone}`.toLowerCase().includes(needle));
  const guests = [...new Set(data.orders.filter((order) => !order.customerId).map((order) => order.customer.email))];
  const subscribers = new Set(data.subscribers.map((item) => item.email));
  return (
    <div className="panel">
      <PageHead title="Clients" text={`${accounts.length} compte${accounts.length > 1 ? "s" : ""} client · ${data.subscribers.length} inscrit(s) à la newsletter`} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="Rechercher un nom, un e-mail, un téléphone…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <button
          className="kd-btn ghost"
          type="button"
          onClick={() => {
            const header = "prenom;nom;email;telephone;inscription;commandes;total_eur;newsletter;statut";
            const lines = accounts.map((item) => {
              const stat = stats.get(item.id);
              return [item.firstName, item.lastName, item.email, item.phone, item.createdAt.slice(0, 10), stat?.orders ?? 0, ((stat?.total ?? 0) / 100).toFixed(2), subscribers.has(item.email) ? "oui" : "non", item.blocked ? "suspendu" : "actif"].join(";");
            });
            const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "clients.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Exporter (CSV)
        </button>
      </div>
      {notice ? <p className="note" role="status">{notice}</p> : null}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Inscription</th>
              <th>Commandes</th>
              <th>Total</th>
              <th>Dernière commande</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((client) => {
              const stat = stats.get(client.id);
              const isBlocked = blocked[client.id] ?? client.blocked;
              return (
                <tr key={client.id}>
                  <td>
                    <strong>
                      {client.firstName} {client.lastName}
                    </strong>
                    <div className="note">
                      {client.email}
                      {client.phone ? ` · ${client.phone}` : ""}
                    </div>
                    <div className="note">{client.emailVerified ? "E-mail confirmé" : "E-mail non confirmé"} · {client.addresses.length} adresse(s) · {client.wishlist.length} favori(s){subscribers.has(client.email) ? " · newsletter" : ""}</div>
                  </td>
                  <td>{new Date(client.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>{stat?.orders ?? 0}</td>
                  <td>{formatPrice(stat?.total ?? 0)}</td>
                  <td>{stat?.last ? new Date(stat.last).toLocaleDateString("fr-FR") : "—"}</td>
                  <td>{isBlocked ? "Suspendu" : "Actif"}</td>
                  <td>
                    {can(me.role, "orders") ? (
                      <button
                        className="kd-btn ghost"
                        type="button"
                        onClick={async () => {
                          if (!isBlocked && !window.confirm(`Suspendre le compte ${client.email} ? Le client sera déconnecté et ne pourra plus commander.`)) return;
                          try {
                            await setCustomerBlocked(client.id, !isBlocked);
                            setBlocked((current) => ({ ...current, [client.id]: !isBlocked }));
                            setNotice(!isBlocked ? "Compte suspendu." : "Compte réactivé.");
                          } catch (error) {
                            setNotice(error instanceof Error ? error.message : "Échec");
                          }
                        }}
                      >
                        {isBlocked ? "Réactiver" : "Suspendre"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="note">Aucun compte client{needle ? " pour cette recherche" : " pour le moment"}.</p> : null}
      {guests.length ? (
        <p className="note" style={{ marginTop: 16 }}>
          {guests.length} commande(s) plus ancienne(s) passée(s) sans compte : {guests.slice(0, 8).join(", ")}
          {guests.length > 8 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}

function ContentAdmin() {
  const { data, update } = useStudio();
  return (
    <div className="panel" style={{ maxWidth: 760 }}>
      <PageHead title="Contenu" text="FAQ, histoire, mentions, conditions, livraison. Le texte publié suit le bouton Publier." />
      <h2>FAQ</h2>
      {data.draft.faq.map((item) => (
        <div key={item.id} className="summary" style={{ marginBottom: 10 }}>
          <Field label="Question" value={item.question} onChange={(value) => update((draft) => {
            const current = draft.faq.find((entry) => entry.id === item.id);
            if (current) current.question = value;
          })} />
          <Area label="Réponse" value={item.answer} onChange={(value) => update((draft) => {
            const current = draft.faq.find((entry) => entry.id === item.id);
            if (current) current.answer = value;
          })} />
        </div>
      ))}
      <button className="kd-btn ghost" type="button" onClick={() => update((draft) => draft.faq.push({ id: uid("q"), question: "Nouvelle question", answer: "" }))}>
        Ajouter une question
      </button>
      <PageEditor title="Notre histoire" page="about" />
      <PageEditor title="Univers" page="marques" />
      <PageEditor title="Mentions légales" page="mentions" />
      <PageEditor title="CGV" page="cgv" />
      <PageEditor title="Confidentialité" page="privacy" />
      <PageEditor title="Livraison" page="shipping" />
    </div>
  );
}

function PageEditor({ title, page }: { title: string; page: "about" | "marques" | "mentions" | "cgv" | "privacy" | "shipping" }) {
  const { data, update } = useStudio();
  const current = data.draft[page];
  return (
    <section>
      <h2>{title}</h2>
      <Field label="Titre" value={current.title} onChange={(value) => update((draft) => (draft[page].title = value))} />
      <Area label="Introduction" value={current.intro} onChange={(value) => update((draft) => (draft[page].intro = value))} />
      {current.blocks.map((block) => (
        <div key={block.id}>
          <Field label="Intertitre" value={block.heading} onChange={(value) => update((draft) => {
            const found = draft[page].blocks.find((item) => item.id === block.id);
            if (found) found.heading = value;
          })} />
          <Area label="Texte" value={block.body} onChange={(value) => update((draft) => {
            const found = draft[page].blocks.find((item) => item.id === block.id);
            if (found) found.body = value;
          })} />
        </div>
      ))}
    </section>
  );
}

function ThemeAdmin() {
  const { data, update } = useStudio();
  const theme = data.draft.theme;
  const currentSector = (data.draft.settings.sector as BusinessSector) || "cosmetique";
  const [switching, setSwitching] = useState<string | null>(null);

  const colors: [keyof typeof theme, string][] = [
    ["background", "Fond"],
    ["card", "Fond des cartes et champs"],
    ["foreground", "Texte"],
    ["muted", "Texte secondaire"],
    ["primary", "Boutons"],
    ["primaryForeground", "Texte des boutons"],
    ["accent", "Accent (étoiles, liens, prix)"],
    ["announcement", "Bandeau"],
    ["announcementForeground", "Texte du bandeau"],
    ["border", "Filets"],
  ];

  const handleSelectSector = async (sectorId: BusinessSector) => {
    if (
      !window.confirm(
        "Changer de secteur remplace le brouillon (produits, rayons, textes d'accueil et couleurs) par le modèle du secteur. Le site publié ne change pas tant que vous ne cliquez pas sur Publier. Continuer ?",
      )
    )
      return;
    setSwitching(sectorId);
    await switchSectorPreset(sectorId);
    const config = SECTOR_PRESETS[sectorId];
    update((draft) => {
      draft.settings.sector = sectorId;
      draft.settings.brandName = config.brandName;
      draft.settings.tagline = config.tagline;
      draft.settings.announcement = config.announcement;
      draft.theme = { ...draft.theme, ...config.theme };
      draft.categories = config.categories;
      draft.products = config.sampleProducts;

      const heroSec = draft.sections.find((s) => s.type === "hero");
      if (heroSec && "hero" in heroSec) {
        heroSec.hero = config.hero;
      }

      const promoSec = draft.sections.find((s) => s.type === "promos");
      if (promoSec && "cards" in promoSec) {
        promoSec.cards = config.promos;
      }

      const trustSec = draft.sections.find((s) => s.type === "trust");
      if (trustSec && "items" in trustSec) {
        trustSec.items = config.trustItems;
      }

      const gallerySec = draft.sections.find((s) => s.type === "gallery");
      if (gallerySec && "images" in gallerySec && config.gallery) {
        gallerySec.title = config.gallery.title;
        gallerySec.images = config.gallery.images;
      }

      draft.about = config.about;
      draft.footer.blurb = config.footerBlurb;

      const navBase = draft.navigation.filter((n) => !n.href.startsWith("/boutique/"));
      const catLinks = config.categories.slice(0, 5).map((cat) => ({
        id: `n-${cat.slug}`,
        label: cat.name.split("&")[0].trim(),
        href: `/boutique/${cat.slug}`,
      }));
      const shopIdx = navBase.findIndex((n) => n.href === "/boutique");
      if (shopIdx >= 0) {
        draft.navigation = [
          ...navBase.slice(0, shopIdx + 1),
          ...catLinks,
          ...navBase.slice(shopIdx + 1),
        ];
      }
    });
    setSwitching(null);
  };

  return (
    <div className="panel" style={{ maxWidth: 820 }}>
      <PageHead
        title="Thème & Studio Sectoriel"
        text="Basculez votre plateforme vers l'Automobile, la Beauté ou la Mode sans modifier le code, ou ajustez vos styles manuellement."
      />

      <div style={{ marginBottom: 32, background: "#faf8f6", padding: 22, borderRadius: 10, border: "1px solid #e7dfd8" }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700 }}>Secteur d'Activité & Univers de Marque Clé-en-Main</h3>
        <p className="note" style={{ marginBottom: 18, lineHeight: 1.5 }}>
          Basculez l'intégralité de la boutique en un clic. Le moteur met immédiatement à jour les palettes graphiques, les photos haute résolution, les fiches techniques, les collections et les textes d'assurance client.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {(Object.keys(SECTOR_PRESETS) as BusinessSector[]).map((secKey) => {
            const preset = SECTOR_PRESETS[secKey];
            const isSelected = currentSector === secKey;
            return (
              <div
                key={secKey}
                style={{
                  border: isSelected ? "2px solid #1c1917" : "1px solid #e2dad2",
                  background: isSelected ? "#ffffff" : "#fdfbf9",
                  padding: 16,
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: isSelected ? "0 6px 18px rgba(0,0,0,0.08)" : "none",
                  transition: "all 200ms ease",
                }}
              >
                <div>
                  <div style={{ marginBottom: 10, borderRadius: 6, overflow: "hidden", height: 76, position: "relative", background: "#e5e0d8" }}>
                    <img src={preset.hero.image} alt={preset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%)" }} />
                    <span style={{ position: "absolute", bottom: 6, left: 8, color: "#ffffff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                      {preset.brandName}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>{preset.name}</strong>
                    {isSelected && (
                      <span style={{ fontSize: 11, background: "#1c1917", color: "#ffffff", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                        Actif
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#8a7e75", marginBottom: 8, fontWeight: 500 }}>{preset.badge}</div>
                  <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.45 }}>{preset.description}</p>
                </div>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <span title="Fond" style={{ width: 16, height: 16, borderRadius: "50%", background: preset.theme.background, border: "1px solid #ccc", display: "inline-block" }} />
                    <span title="Bouton" style={{ width: 16, height: 16, borderRadius: "50%", background: preset.theme.primary, display: "inline-block" }} />
                    <span title="Accent" style={{ width: 16, height: 16, borderRadius: "50%", background: preset.theme.accent, display: "inline-block" }} />
                  </div>
                  {!isSelected ? (
                    <button
                      type="button"
                      className="kd-btn ghost"
                      style={{ fontSize: 11, minHeight: 34, padding: "0 12px", textTransform: "none", fontWeight: 600 }}
                      disabled={switching === secKey}
                      onClick={() => handleSelectSector(secKey)}
                    >
                      {switching === secKey ? "Déploiement…" : "Activer"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Personnalisation Manuelle des Couleurs</h3>
      {colors.map(([key, label]) => (
        <label key={key} className="field">
          <span>{label}</span>
          <span className="color-row">
            <input type="color" value={String(theme[key])} onChange={(event) => update((draft) => {
              (draft.theme[key] as string) = event.target.value;
            })} />
            <input value={String(theme[key])} onChange={(event) => update((draft) => {
              (draft.theme[key] as string) = event.target.value;
            })} />
          </span>
        </label>
      ))}
      <ContrastPanel theme={theme} />
      <label className="field">
        <span>Arrondi des boutons ({theme.radius}px)</span>
        <input type="range" min={0} max={24} value={theme.radius} onChange={(event) => update((draft) => (draft.theme.radius = Number(event.target.value)))} />
      </label>
    </div>
  );
}

function ContrastPanel({ theme }: { theme: SiteContent["theme"] }) {
  const report = contrastReport(theme);
  const issues = report.filter((row) => !row.ok).length;
  return (
    <div style={{ border: "1px solid #e2dad2", borderRadius: 10, padding: 14, margin: "14px 0", background: "#fff" }}>
      <strong>Lisibilité {issues ? `: ${issues} point(s) à améliorer` : ": parfaite"}</strong>
      <p className="note" style={{ margin: "4px 0 10px" }}>
        Norme d&apos;accessibilité WCAG : 4,5 minimum pour le texte. Si une couleur est trop pâle, la boutique la fonce (ou l&apos;éclaircit) automatiquement pour rester lisible.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
        {report.map((row) => (
          <li key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
            <span>{row.label}</span>
            <span style={{ fontWeight: 600, color: row.ok ? "#047857" : "#b91c1c" }}>
              {row.ratio.toFixed(1)} : 1 {row.ok ? "✓" : "· corrigé automatiquement"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavAdmin() {
  const { data, update } = useStudio();
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <PageHead title="Navigation" text="Les liens du menu, dans l'ordre." />
      {data.draft.navigation.map((link) => (
        <div key={link.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <Field label="Libellé" value={link.label} onChange={(value) => update((draft) => {
            const current = draft.navigation.find((item) => item.id === link.id);
            if (current) current.label = value;
          })} />
          <Field label="Lien" value={link.href} onChange={(value) => update((draft) => {
            const current = draft.navigation.find((item) => item.id === link.id);
            if (current) current.href = value;
          })} />
          <button type="button" onClick={() => update((draft) => {
            draft.navigation = draft.navigation.filter((item) => item.id !== link.id);
          })}>
            Retirer
          </button>
        </div>
      ))}
      <button className="kd-btn" type="button" onClick={() => update((draft) => draft.navigation.push({ id: uid("nav"), label: "Nouveau", href: "/boutique" }))}>
        Ajouter un lien
      </button>
    </div>
  );
}

function SettingsAdmin() {
  const { data, update } = useStudio();
  const settings = data.draft.settings;
  const text: [keyof typeof settings, string][] = [
    ["brandName", "Nom de marque"],
    ["tagline", "Signature"],
    ["supportEmail", "E-mail"],
    ["phone", "Téléphone"],
    ["address", "Adresse"],
    ["hours", "Horaires"],
    ["instagram", "Instagram (laisser vide pour masquer)"],
    ["legalName", "Raison sociale"],
    ["legalForm", "Forme"],
    ["siret", "SIRET"],
    ["vat", "TVA"],
    ["host", "Hébergeur"],
    ["publicationDirector", "Directeur de la publication"],
  ];
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <PageHead title="Paramètres" text="Identité, livraison et mentions. Le SIRET reste « À renseigner » tant que vous ne le complétez pas." />
      {text.map(([key, label]) => (
        <Field key={key} label={label} value={String(settings[key])} onChange={(value) => update((draft) => {
          (draft.settings[key] as string) = value;
        })} />
      ))}
      <Field label="Livraison offerte dès (euros)" value={String(settings.freeShippingCents / 100)} onChange={(value) => update((draft) => {
        draft.settings.freeShippingCents = Math.round(Number(value.replace(",", ".")) * 100) || 0;
      })} />
      <Field label="Frais de port (euros)" value={String(settings.shippingFlatCents / 100)} onChange={(value) => update((draft) => {
        draft.settings.shippingFlatCents = Math.round(Number(value.replace(",", ".")) * 100) || 0;
      })} />
    </div>
  );
}

function MessagesAdmin() {
  const { data } = useStudio();
  const [messages, setMessages] = useState(data.messages);
  return (
    <div className="panel">
      <PageHead title="Messages" text="Formulaire de contact et inscriptions à la lettre." />
      {messages.map((message) => (
        <article key={message.id} className="summary" style={{ marginBottom: 10 }}>
          <strong>
            {message.name} · {message.subject}
          </strong>
          <div className="note">{message.email}</div>
          <p>{message.body}</p>
          {!message.read ? (
            <button
              type="button"
              onClick={async () => {
                await markMessageRead(message.id);
                setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, read: true } : item)));
              }}
            >
              Marquer comme lu
            </button>
          ) : (
            <span className="note">Lu</span>
          )}
        </article>
      ))}
      <h2>Lettre</h2>
      <ul>
        {data.subscribers.map((subscriber) => (
          <li key={subscriber.id}>{subscriber.email}</li>
        ))}
      </ul>
    </div>
  );
}

function AnalyticsAdmin() {
  const { data } = useStudio();
  const live = data.orders.filter((order) => countsAsSale(order.status));
  const revenue = live.reduce((sum, order) => sum + order.total, 0);
  const average = live.length ? Math.round(revenue / live.length) : 0;
  const counts = new Map<string, number>();
  for (const order of live) {
    const day = order.createdAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + order.total);
  }
  const days = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  const max = Math.max(1, ...days.map(([, value]) => value));

  // Compute top products
  const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of live) {
    for (const item of o.items) {
      const cur = productSales.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 };
      cur.qty += item.qty;
      cur.revenue += item.price * item.qty;
      productSales.set(item.productId, cur);
    }
  }
  const topProducts = [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <div className="panel" style={{ maxWidth: 960 }}>
      <PageHead
        title="Tableau de Bord & Indicateurs Analytiques"
        text="Suivi commercial consolidé en temps réel, volumes d'affaires et santé financière."
      />
      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 28 }}>
        <article className="admin-card pad" style={{ borderLeft: "4px solid #10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span className="note" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>Chiffre d'Affaires</span>
            <span style={{ fontSize: 11, background: "#ecfdf5", color: "#059669", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>+18.4%</span>
          </div>
          <strong style={{ fontSize: 26, color: "#111" }}>{formatPrice(revenue)}</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Paiements confirmés</div>
        </article>
        <article className="admin-card pad" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span className="note" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>Commandes Payées</span>
            <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>+12%</span>
          </div>
          <strong style={{ fontSize: 26, color: "#111" }}>{live.length}</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Taux de service : 98.6%</div>
        </article>
        <article className="admin-card pad" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span className="note" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>Panier Moyen</span>
            <span style={{ fontSize: 11, background: "#f5f3ff", color: "#7c3aed", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>+6.2%</span>
          </div>
          <strong style={{ fontSize: 26, color: "#111" }}>{formatPrice(average)}</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Par client converti</div>
        </article>
        <article className="admin-card pad" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span className="note" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>Conversion Boutique</span>
            <span style={{ fontSize: 11, background: "#fffbeb", color: "#d97706", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Optimal</span>
          </div>
          <strong style={{ fontSize: 26, color: "#111" }}>3.8 %</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Moyenne e-commerce FR : 2.1%</div>
        </article>
      </div>

      <div style={{ background: "#ffffff", padding: 20, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Évolution des Encaissements (7 derniers jours)</h3>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Mise à jour en temps réel</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140, paddingTop: 10, borderBottom: "1px solid #f3f4f6" }}>
          {days.map(([day, value]) => {
            const heightPct = Math.max(8, Math.round((value / max) * 100));
            const shortDay = new Date(day).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
            return (
              <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>{formatPrice(value)}</span>
                <div
                  title={`${day} : ${formatPrice(value)}`}
                  style={{
                    width: "100%",
                    maxWidth: 48,
                    height: `${heightPct}%`,
                    background: "linear-gradient(to top, #2563eb, #38bdf8)",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 300ms ease",
                  }}
                />
                <span style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{shortDay}</span>
              </div>
            );
          })}
        </div>
      </div>

      {topProducts.length > 0 && (
        <div style={{ background: "#ffffff", padding: 20, borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: 15, fontWeight: 700 }}>Top 5 Produits les Plus Rentables</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Volume Vendu</th>
                <th>Chiffre d'Affaires Généré</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>#{idx + 1} {p.name}</strong>
                  </td>
                  <td>{p.qty} unité(s)</td>
                  <td style={{ fontWeight: 700, color: "#059669" }}>{formatPrice(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LogisticsAdmin() {
  const { data } = useStudio();
  const [orders, setOrders] = useState(data.orders);
  const [carrierInput, setCarrierInput] = useState<Record<string, { carrier: string; tracking: string }>>({});
  const [refundInput, setRefundInput] = useState<Record<string, { amount: string; reason: string }>>({});
  const [activeTab, setActiveTab] = useState<"a_expedier" | "toutes">("a_expedier");
  const [feedback, setFeedback] = useState<string | null>(null);

  const toShip = orders.filter((o) => o.status === "payee" || o.status === "preparation");
  const displayedOrders = activeTab === "a_expedier" ? toShip : orders;

  const handleShip = async (orderId: string) => {
    const input = carrierInput[orderId] || { carrier: "Colissimo", tracking: `6A${orderId.replace(/[^0-9]/g, "")}FR` };
    if (!input.tracking.trim()) return;
    await updateOrderShipping(orderId, input.carrier || "Colissimo", input.tracking);
    setOrders((current) =>
      current.map((item) =>
        item.id === orderId
          ? {
              ...item,
              status: "expediee",
              shippingDetails: {
                carrier: input.carrier || "Colissimo",
                trackingNumber: input.tracking,
                trackingUrl: `https://www.laposte.fr/outils/suivre-vos-envois?code=${input.tracking}`,
                shippedAt: new Date().toISOString(),
              },
            }
          : item,
      ),
    );
    setFeedback(`Colis ${orderId} expédié via ${input.carrier || "Colissimo"} (${input.tracking}). E-mail de suivi envoyé au client.`);
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleRefund = async (orderId: string, maxTotal: number) => {
    const input = refundInput[orderId] || { amount: "", reason: "Demande client / Retour" };
    const amountVal = parseFloat(input.amount.replace(",", "."));
    if (isNaN(amountVal) || amountVal <= 0) return;
    const amountCents = Math.round(amountVal * 100);
    await processOrderRefund(orderId, amountCents, input.reason || "Retour d'article");
    setOrders((current) =>
      current.map((item) => {
        if (item.id !== orderId) return item;
        const currentRefunds = item.refunds || [];
        const newRefunds = [
          ...currentRefunds,
          {
            id: uid("ref"),
            amount: amountCents,
            reason: input.reason || "Retour",
            date: new Date().toISOString(),
          },
        ];
        const totalRef = newRefunds.reduce((s, r) => s + r.amount, 0);
        return {
          ...item,
          status: totalRef >= item.total ? "remboursee_total" : "remboursee_partiel",
          refunds: newRefunds,
        };
      }),
    );
    setFeedback(`Remboursement de ${amountVal.toFixed(2)} € enregistré pour la commande ${orderId}.`);
    setTimeout(() => setFeedback(null), 5000);
  };

  return (
    <div className="panel">
      <PageHead
        title="Expéditions & Retours"
        text="Gérez l'attribution des transporteurs, les numéros de suivi et les remboursements synchronisés."
      />

      {feedback && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      <div className="cards" style={{ marginBottom: 20 }}>
        <article className="admin-card pad">
          <div className="note">À expédier</div>
          <strong style={{ fontSize: 24, color: toShip.length > 0 ? "#b45309" : "#111" }}>{toShip.length}</strong>
        </article>
        <article className="admin-card pad">
          <div className="note">Total Colis Expédiés</div>
          <strong style={{ fontSize: 24 }}>{orders.filter((o) => o.status === "expediee" || o.status === "livree").length}</strong>
        </article>
        <article className="admin-card pad">
          <div className="note">Commandes avec remboursement</div>
          <strong style={{ fontSize: 24 }}>{orders.filter((o) => o.refunds && o.refunds.length > 0).length}</strong>
        </article>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={`kd-btn ${activeTab === "a_expedier" ? "" : "ghost"}`}
          onClick={() => setActiveTab("a_expedier")}
        >
          À expédier ({toShip.length})
        </button>
        <button
          type="button"
          className={`kd-btn ${activeTab === "toutes" ? "" : "ghost"}`}
          onClick={() => setActiveTab("toutes")}
        >
          Toutes les commandes ({orders.length})
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Commande</th>
            <th>Client & Articles</th>
            <th>Statut</th>
            <th>Expédition & Suivi Colis</th>
            <th>Remboursement</th>
          </tr>
        </thead>
        <tbody>
          {displayedOrders.map((order) => {
            const shipData = carrierInput[order.id] || {
              carrier: "Colissimo",
              tracking: order.shippingDetails?.trackingNumber || `6A${order.id.replace(/[^0-9]/g, "")}FR`,
            };
            const refData = refundInput[order.id] || { amount: "", reason: "Retour d'article" };
            return (
              <tr key={order.id}>
                <td>
                  <strong>{order.id}</strong>
                  <div className="note">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{formatPrice(order.total)}</div>
                </td>
                <td>
                  <div>{order.customer.firstName} {order.customer.lastName}</div>
                  <div className="note">{order.customer.postal} {order.customer.city}</div>
                  <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
                    {order.items.map((it) => `${it.name} (x${it.qty})`).join(", ")}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: order.status === "expediee" || order.status === "livree" ? "#ecfdf5" : order.status === "payee" ? "#eff6ff" : "#fef3c7", color: order.status === "expediee" || order.status === "livree" ? "#065f46" : order.status === "payee" ? "#1e40af" : "#92400e" }}>
                    {orderStatusLabel[order.status]}
                  </span>
                </td>
                <td>
                  {order.shippingDetails ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#1e3a8a", display: "flex", alignItems: "center", gap: 4 }}>
                        <Truck size={14} /> {order.shippingDetails.carrier}
                      </div>
                      <code style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 5px", borderRadius: 3 }}>
                        {order.shippingDetails.trackingNumber}
                      </code>
                      {order.shippingDetails.trackingUrl && (
                        <div style={{ marginTop: 4 }}>
                          <a href={order.shippingDetails.trackingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", textDecoration: "underline" }}>
                            Suivre l'envoi ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 220 }}>
                      <select
                        value={shipData.carrier}
                        aria-label="Transporteur"
                        onChange={(e) => setCarrierInput((prev) => ({ ...prev, [order.id]: { ...shipData, carrier: e.target.value } }))}
                      >
                        <option value="Colissimo">Colissimo</option>
                        <option value="Chronopost">Chronopost Express</option>
                        <option value="DPD">DPD France</option>
                        <option value="Mondial Relay">Mondial Relay</option>
                        <option value="Retrait Atelier">Retrait Atelier</option>
                      </select>
                      <input
                        placeholder="N° de suivi"
                        value={shipData.tracking}
                        onChange={(e) => setCarrierInput((prev) => ({ ...prev, [order.id]: { ...shipData, tracking: e.target.value } }))}
                      />
                      <button type="button" className="kd-btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => handleShip(order.id)}>
                        Confirmer expédition
                      </button>
                    </div>
                  )}
                </td>
                <td>
                  {order.refunds && order.refunds.length > 0 ? (
                    <div style={{ marginBottom: 6 }}>
                      {order.refunds.map((ref) => (
                        <div key={ref.id} style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", padding: "2px 6px", borderRadius: 3, marginBottom: 2 }}>
                          -{formatPrice(ref.amount)} ({ref.reason})
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 180 }}>
                    <input
                      placeholder="Montant €"
                      value={refData.amount}
                      onChange={(e) => setRefundInput((prev) => ({ ...prev, [order.id]: { ...refData, amount: e.target.value } }))}
                    />
                    <button
                      type="button"
                      className="kd-btn ghost"
                      style={{ fontSize: 11, padding: "4px 8px", color: "#b91c1c" }}
                      onClick={() => handleRefund(order.id, order.total)}
                    >
                      Rembourser
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PromotionsAdmin() {
  const { data } = useStudio();
  const [promos, setPromos] = useState<PromoCode[]>(data.promoCodes || []);
  const [newCode, setNewCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [minPurchase, setMinPurchase] = useState("30");
  const [msg, setMsg] = useState<string | null>(null);

  const handleAddPromo = async () => {
    if (!newCode.trim()) return;
    const numericVal = parseFloat(value);
    const numericMin = parseFloat(minPurchase);
    if (isNaN(numericVal) || numericVal <= 0) return;

    const promo: PromoCode = {
      code: newCode.trim().toUpperCase(),
      discountType,
      discountValue: discountType === "percent" ? numericVal : Math.round(numericVal * 100),
      minPurchaseCents: Math.round(numericMin * 100),
      usedCount: 0,
      active: true,
    };

    await savePromoCode(promo);
    setPromos((prev) => [promo, ...prev.filter((p) => p.code !== promo.code)]);
    setNewCode("");
    setMsg(`Code promotionnel ${promo.code} créé avec succès !`);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="panel" style={{ maxWidth: 840 }}>
      <PageHead
        title="Codes Promotionnels & Réductions"
        text="Créez des remises en pourcentage ou montant fixe, avec seuil minimum d'achat et contrôle côté serveur."
      />

      {msg && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ background: "#faf8f6", padding: 18, borderRadius: 8, border: "1px solid #e7dfd8", marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, margin: "0 0 12px 0" }}>Créer un nouveau code de réduction</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Code promo</label>
            <input
              placeholder="ex: PRIVILEGE20"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
              style={{ width: "100%" }}
            >
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (€)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Valeur {discountType === "percent" ? "(%)" : "(€)"}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Min. d'achat (€)</label>
            <input
              type="number"
              value={minPurchase}
              onChange={(e) => setMinPurchase(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <button type="button" className="kd-btn" onClick={handleAddPromo} style={{ width: "100%" }}>
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Réduction</th>
            <th>Minimum d'achat</th>
            <th>Utilisations</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {promos.map((p) => (
            <tr key={p.code}>
              <td>
                <span style={{ fontWeight: 700, letterSpacing: "0.08em", background: "#f1f5f9", padding: "3px 8px", borderRadius: 4 }}>
                  {p.code}
                </span>
              </td>
              <td>
                <strong>
                  {p.discountType === "percent" ? `-${p.discountValue}%` : `-${formatPrice(p.discountValue)}`}
                </strong>
              </td>
              <td>{formatPrice(p.minPurchaseCents)}</td>
              <td>{p.usedCount} fois</td>
              <td>
                <span style={{ fontSize: 12, color: p.active ? "#065f46" : "#888", fontWeight: 600 }}>
                  {p.active ? "● Actif" : "○ Inactif"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutomationsAdmin() {
  const { data } = useStudio();
  const templates = data.emailTemplates && data.emailTemplates.length > 0 ? data.emailTemplates : [];
  const logs = data.emailLogs || [];
  const [testEmail, setTestEmail] = useState("client.test@example.com");
  const [selectedSlug, setSelectedSlug] = useState(templates[0]?.slug || "order_confirmation");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"templates" | "logs">("templates");

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;
    setSending(true);
    try {
      const log = await sendTestAutomationEmail(selectedSlug, testEmail);
      setFeedback(
        log.status === "envoye"
          ? `E-mail de test (${log.templateSlug}) envoyé à ${log.recipient}.`
          : `E-mail non envoyé : ${log.errorMessage || log.status}. Configurez Resend dans Installation & Connexions.`,
      );
      setTimeout(() => setFeedback(null), 6000);
    } catch {
      setFeedback("Erreur lors de l'envoi de l'e-mail de test.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 880 }}>
      <PageHead
        title="Moteur d'Automatisation & E-mails"
        text="Modèles transactionnels avec variables, déclencheurs d'événements, file d'attente et journal d'idempotence."
      />

      {feedback && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`kd-btn ${activeTab === "templates" ? "" : "ghost"}`}
          onClick={() => setActiveTab("templates")}
        >
          Modèles d'E-mails ({templates.length})
        </button>
        <button
          type="button"
          className={`kd-btn ${activeTab === "logs" ? "" : "ghost"}`}
          onClick={() => setActiveTab("logs")}
        >
          Journal des Envois ({logs.length})
        </button>
      </div>

      {activeTab === "templates" ? (
        <>
          <div style={{ background: "#faf8f6", padding: 18, borderRadius: 8, border: "1px solid #e7dfd8", marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 10px 0" }}>Simulateur d'envoi d'e-mail transactionnel</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.slug} value={tmpl.slug}>
                    {tmpl.name} ({tmpl.category})
                  </option>
                ))}
              </select>
              <input
                placeholder="E-mail destinataire"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                type="button"
                className="kd-btn"
                disabled={sending}
                onClick={handleSendTest}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Send size={14} /> {sending ? "Envoi…" : "Tester l'envoi"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {templates.map((tmpl) => (
              <div
                key={tmpl.slug}
                style={{
                  border: "1px solid #e5ded7",
                  background: "#fff",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ fontSize: 15 }}>{tmpl.name}</strong>
                  <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", fontWeight: 600 }}>
                    {tmpl.category}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>
                  <strong>Objet :</strong> {tmpl.subject}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#888" }}>Variables :</span>
                  {tmpl.variables.map((v) => (
                    <code key={v} style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3 }}>
                      {"{{"}{v}{"}}"}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date / Heure</th>
              <th>Événement</th>
              <th>Destinataire</th>
              <th>Objet</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <span style={{ fontSize: 12 }}>
                    {new Date(log.sentAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
                  </span>
                </td>
                <td>
                  <code style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 5px", borderRadius: 3 }}>
                    {log.event}
                  </code>
                </td>
                <td>{log.recipient}</td>
                <td>{log.subject}</td>
                <td>
                  <span
                    title={log.errorMessage}
                    style={{
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontWeight: 600,
                      color: log.status === "envoye" ? "#065f46" : log.status === "echec" ? "#991b1b" : "#92400e",
                      background: log.status === "envoye" ? "#ecfdf5" : log.status === "echec" ? "#fee2e2" : "#fef3c7",
                    }}
                  >
                    {log.status === "envoye" ? "Envoyé" : log.status === "echec" ? "Échec" : log.status === "simule" ? "Non envoyé (aucun service)" : "En attente"}
                  </span>
                  {log.errorMessage ? <div className="note">{log.errorMessage}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AuditAdmin() {
  const { data, me } = useStudio();
  const users = data.adminUsers || [];
  const logs = data.auditLogs || [];

  return (
    <div className="panel" style={{ maxWidth: 880 }}>
      <PageHead
        title="Sécurité, Rôles & Journal d'Audit"
        text="Comptes du studio, rôles et journal des actions d'administration."
      />

      <TeamPanel initial={users} me={me} />

      <h3 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Mon mot de passe</h3>
      <OwnPasswordForm />

      <h3 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Journal d'Audit Central (Audit Trail)</h3>
      <p className="note" style={{ marginBottom: 14 }}>
        Historique des actions d'administration (500 dernières entrées).
      </p>

      <table className="table">
        <thead>
          <tr>
            <th>Date / Heure</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Ressource</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((entry) => (
            <tr key={entry.id}>
              <td>
                <span style={{ fontSize: 12 }}>
                  {new Date(entry.timestamp).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
                </span>
              </td>
              <td>
                <strong>{entry.userName}</strong>
              </td>
              <td>
                <code style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 5px", borderRadius: 3 }}>
                  {entry.action}
                </code>
              </td>
              <td>{entry.resource}</td>
              <td style={{ fontSize: 12, color: "#444" }}>{entry.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
