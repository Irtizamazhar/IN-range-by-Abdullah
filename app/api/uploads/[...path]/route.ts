import { NextResponse } from "next/server";
import { readPublicImage } from "@/lib/public-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: { path: string[] } }) {
  try {
    const image = await readPublicImage(context.params.path.join("/"));
    if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(image.bytes), { headers: {
      "Content-Type": image.mime, "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    return NextResponse.json({ error: "Image storage is unavailable" }, { status: 503 });
  }
}
