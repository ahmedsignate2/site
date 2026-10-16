import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const TYPES: Record<string, { ext: string; magic: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": {
    ext: "webp",
    magic: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
};

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !can(user.role, "content")) {
    return NextResponse.json({ error: "Connexion au studio requise." }, { status: 401 });
  }
  if (!rateLimit(`upload:${user.id}`, 60, 10 * 60_000).ok) {
    return NextResponse.json({ error: "Trop d'envois. Patientez quelques minutes." }, { status: 429 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }
  const kind = TYPES[file.type];
  if (!kind) {
    return NextResponse.json({ error: "Formats acceptés : JPEG, PNG ou WebP." }, { status: 400 });
  }
  if (file.size > 6_000_000) {
    return NextResponse.json({ error: "Image trop lourde (6 Mo maximum)." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!kind.magic(bytes)) {
    return NextResponse.json({ error: "Le fichier n'est pas une image valide." }, { status: 400 });
  }
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${kind.ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return NextResponse.json({ url: `/uploads/${name}` });
}
