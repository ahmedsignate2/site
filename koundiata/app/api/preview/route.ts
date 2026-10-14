import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL(url.searchParams.get("to") || "/", url.origin));
  if (url.searchParams.get("off") === "1") response.cookies.delete("kd-preview");
  else response.cookies.set("kd-preview", "1", { path: "/" });
  return response;
}
