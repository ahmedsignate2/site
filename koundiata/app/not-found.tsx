import Link from "next/link";

export default function NotFound() {
  return (
    <div className="store" style={{ padding: "12vh 24px" }}>
      <p className="eyebrow">404</p>
      <h1 className="display" style={{ fontSize: "4rem" }}>
        Cette page n'existe pas.
      </h1>
      <Link className="kd-btn" href="/">
        Retour à l'accueil
      </Link>
    </div>
  );
}
