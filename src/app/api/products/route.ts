import { getProducts } from "@/lib/catalog";
import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/products — public product catalogue (used by client components). */
export async function GET() {
  const products = await getProducts();
  return jsonOk({ products });
}
