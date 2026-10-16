import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtre rapide : sans cookie de session, le studio renvoie vers la connexion.
 * La vérification réelle (signature, rôle, compte actif) est faite côté serveur
 * dans app/studio/layout.tsx et dans chaque action (lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("kd-session")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/studio/:path*", "/api/upload"],
};
