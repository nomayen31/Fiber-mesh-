import type { NextRequest } from "next/server";
import { jsonError, jsonOk, logError } from "@/lib/api";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { getProducts } from "@/lib/catalog";
import { divisions } from "@/content/districts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/admin/meta` — reference data for the Android manual-order form.
 *
 * The phone must never invent a price or hardcode the catalogue, so both lists
 * come from the server: the active products *with their current price*, and the
 * 64 districts the order schema accepts (an order whose district is not in that
 * list is rejected by `adminOrderSchema`).
 *
 * Admin-only: it is not needed by the public website, so it stays behind the
 * same session guard as the rest of `/api/admin/*`.
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) return jsonError("Unauthorized. অ্যাডমিন লগইন প্রয়োজন।", 401);

  try {
    const products = await getProducts();

    return jsonOk({
      districts: divisions.flatMap((division) =>
        division.districts.map((district) => ({
          value: district.value,
          label: district.label,
          division: division.name,
          delivery: district.delivery,
        })),
      ),
      products: products.map((product) => ({
        slug: product.slug,
        name: product.name,
        nameEn: product.nameEn,
        gsm: product.gsm,
        price: product.price,
        unit: product.unit,
      })),
    });
  } catch (error) {
    logError("[api/admin/meta] failed:", error);
    return jsonError("তথ্য আনা যায়নি।", 500);
  }
}
