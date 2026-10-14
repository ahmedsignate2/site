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
  type LucideIcon,
} from "lucide-react";
import { createSection } from "@/lib/catalog";
import { formatPrice, slugify, uid } from "@/lib/format";
import { deleteOrder, discardDraft, markMessageRead, publishSite, saveDraft, updateOrderStatus } from "@/lib/actions";
import type { HeroContent, OrderStatus, Product, Section, SiteContent, StoreData } from "@/lib/types";
import { PreviewSite } from "@/components/store/view";
import { Button } from "@/components/ui/button";

type Api = {
  data: StoreData;
  status: string;
  update: (recipe: (draft: SiteContent) => void) => void;
  publish: () => Promise<void>;
  discard: () => Promise<void>;
  dirty: boolean;
};

const StudioContext = createContext<Api | null>(null);

function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("Studio");
  return value;
}

export function StudioShell({ initial, children }: { initial: StoreData; children: ReactNode }) {
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
        await saveDraft(data.draft);
        const published = await publishSite();
        setData((current) => ({ ...current, published }));
        setStatus("Publié");
      },
      discard: async () => {
        const draft = await discardDraft();
        dirtyRef.current = false;
        setData((current) => ({ ...current, draft }));
        setStatus("Brouillon abandonné");
      },
    };
  }, [data, status]);

  const pending = data.orders.filter((order) => order.status === "payee" || order.status === "preparation").length;
  const unread = data.messages.filter((message) => !message.read).length;

  const links: { href: string; label: string; icon: LucideIcon; badge?: number; group?: string }[] = [
    { href: "/studio", label: "Accueil", icon: Home },
    { href: "/studio/produits", label: "Produits", icon: Package },
    { href: "/studio/collections", label: "Collections", icon: FolderOpen },
    { href: "/studio/commandes", label: "Commandes", icon: ShoppingBag, badge: pending },
    { href: "/studio/clients", label: "Clients", icon: Users },
    { href: "/studio/contenu", label: "Contenu", icon: LayoutGrid },
    { href: "/studio/theme", label: "Thème", icon: ImageIcon, group: "Apparence" },
    { href: "/studio/navigation", label: "Navigation", icon: Menu },
    { href: "/studio/parametres", label: "Paramètres", icon: Settings },
    { href: "/studio/messages", label: "Messages", icon: Mail, badge: unread },
    { href: "/studio/analyses", label: "Analyses", icon: BarChart3 },
  ];

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
          {api.dirty ? (
            <Button variant="outline" onClick={() => api.discard()}>
              Abandonner
            </Button>
          ) : null}
          <a className="kd-btn ghost" href="/api/preview?to=/">
            Aperçu
          </a>
          <button className="kd-btn" type="button" onClick={() => api.publish()}>
            Publier
          </button>
        </header>
        <div className="studio-body">
          <nav className={`side${navOpen ? " open" : ""}`} aria-label="Studio">
            {links.map((link) => (
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

export function StudioView() {
  const path = usePathname();
  if (path.startsWith("/studio/produits")) return <ProductsAdmin />;
  if (path.startsWith("/studio/collections")) return <CollectionsAdmin />;
  if (path.startsWith("/studio/commandes")) return <OrdersAdmin />;
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
    <div className="cookie" style={{ position: "fixed", inset: "8vh 8vw auto", maxWidth: 720, display: "block", zIndex: 40, overflow: "auto", maxHeight: "80vh" }} role="dialog" aria-modal="true" aria-label="Produit">
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

const statuses: OrderStatus[] = ["payee", "preparation", "expediee", "livree", "annulee"];
const statusLabel: Record<OrderStatus, string> = {
  payee: "Payée",
  preparation: "Préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
};

function OrdersAdmin() {
  const { data } = useStudio();
  const [orders, setOrders] = useState(data.orders);
  return (
    <div className="panel">
      <PageHead title="Commandes" text="Les exemples sont marqués. Les commandes passées sur le site arrivent ici tout de suite, sans publication." />
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
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                {order.id}
                {order.demo ? <div className="note">Exemple</div> : null}
              </td>
              <td>
                {order.customer.firstName} {order.customer.lastName}
                <div className="note">{order.customer.city}</div>
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
                      {statusLabel[status]}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientsAdmin() {
  const { data } = useStudio();
  const clients = new Map<string, { name: string; email: string; orders: number; total: number }>();
  for (const order of data.orders) {
    const current = clients.get(order.customer.email) ?? {
      name: `${order.customer.firstName} ${order.customer.lastName}`,
      email: order.customer.email,
      orders: 0,
      total: 0,
    };
    current.orders += 1;
    if (order.status !== "annulee") current.total += order.total;
    clients.set(order.customer.email, current);
  }
  return (
    <div className="panel">
      <PageHead title="Clients" text="Regroupés à partir des commandes." />
      <table className="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>E-mail</th>
            <th>Commandes</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {[...clients.values()].map((client) => (
            <tr key={client.email}>
              <td>{client.name}</td>
              <td>{client.email}</td>
              <td>{client.orders}</td>
              <td>{formatPrice(client.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const colors: [keyof typeof theme, string][] = [
    ["background", "Fond"],
    ["foreground", "Texte"],
    ["primary", "Boutons"],
    ["primaryForeground", "Texte des boutons"],
    ["accent", "Étoiles"],
    ["announcement", "Bandeau"],
    ["announcementForeground", "Texte du bandeau"],
    ["border", "Filets"],
  ];
  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <PageHead title="Thème" text="Les couleurs s'appliquent à la boutique après publication. L'aperçu du studio les montre tout de suite." />
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
      <label className="field">
        <span>Arrondi des boutons ({theme.radius}px)</span>
        <input type="range" min={0} max={24} value={theme.radius} onChange={(event) => update((draft) => (draft.theme.radius = Number(event.target.value)))} />
      </label>
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
  const live = data.orders.filter((order) => order.status !== "annulee");
  const revenue = live.reduce((sum, order) => sum + order.total, 0);
  const average = live.length ? Math.round(revenue / live.length) : 0;
  const counts = new Map<string, number>();
  for (const order of live) {
    const day = order.createdAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + order.total);
  }
  const days = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  const max = Math.max(1, ...days.map(([, value]) => value));
  return (
    <div className="panel">
      <PageHead title="Analyses" text="Calculées sur les commandes enregistrées, exemples compris." />
      <div className="cards">
        <article className="admin-card pad">
          <div className="note">Chiffre</div>
          <strong style={{ fontSize: 28 }}>{formatPrice(revenue)}</strong>
        </article>
        <article className="admin-card pad">
          <div className="note">Commandes</div>
          <strong style={{ fontSize: 28 }}>{live.length}</strong>
        </article>
        <article className="admin-card pad">
          <div className="note">Panier moyen</div>
          <strong style={{ fontSize: 28 }}>{formatPrice(average)}</strong>
        </article>
      </div>
      <h2>Encaissements par jour</h2>
      <div className="bars" aria-hidden>
        {days.map(([day, value]) => (
          <i key={day} title={`${day} ${formatPrice(value)}`} style={{ height: `${(value / max) * 100}%` }} />
        ))}
      </div>
      <ul>
        {days.map(([day, value]) => (
          <li key={day}>
            {day} · {formatPrice(value)}
          </li>
        ))}
      </ul>
    </div>
  );
}
