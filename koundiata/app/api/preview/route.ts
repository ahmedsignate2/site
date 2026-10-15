import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const targetPath = url.searchParams.get("to") || "/";
  const response = NextResponse.redirect(new URL(targetPath, origin));
  if (url.searchParams.get("off") === "1") response.cookies.delete("kd-preview");
  else response.cookies.set("kd-preview", "1", { path: "/" });
  return response;
}
