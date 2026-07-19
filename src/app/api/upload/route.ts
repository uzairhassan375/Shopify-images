import { NextResponse } from "next/server";
import { uploadImageToShopifyFiles } from "@/lib/shopify";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided. Use form field name \"file\"." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/") && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only image files are allowed." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 20MB or smaller." },
        { status: 400 }
      );
    }

    const result = await uploadImageToShopifyFiles(file);

    return NextResponse.json({
      id: result.id,
      url: result.url,
      width: result.width,
      height: result.height,
      filename: file.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected upload error";

    console.error("Shopify upload failed:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
