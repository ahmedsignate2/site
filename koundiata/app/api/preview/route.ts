import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const requested = url.searchParams.get("to") || "/";
  // Uniquement des chemins internes : pas de redirection vers un autre site.
  const targetPath = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const response = NextResponse.redirect(new URL(targetPath, origin));
  if (url.searchParams.get("off") === "1") {
    response.cookies.delete("kd-preview");
    return response;
  }
  const user = await currentUser();
  if (!user || !can(user.role, "content")) {
    return NextResponse.redirect(new URL(`/connexion?next=/studio`, origin));
  }
  response.cookies.set("kd-preview", "1", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}
