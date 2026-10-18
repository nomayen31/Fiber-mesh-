import type { NextRequest } from "next/server";
import { guardAdmin, jsonError, jsonOk, logError } from "@/lib/api";
import { getDashboardStats, type StatsRange } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/stats?range=7d|30d|90d */
export async function GET(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  const rangeParam = request.nextUrl.searchParams.get("range") ?? "7d";
  const range: StatsRange =
    rangeParam === "30d" || rangeParam === "90d" ? rangeParam : "7d";

  try {
    const stats = await getDashboardStats(range);
    return jsonOk(stats);
  } catch (error) {
    logError("[api/admin/stats] failed:", error);
    return jsonError(
      "ডেটাবেস থেকে তথ্য আনা যায়নি। DATABASE_URL ঠিক আছে কিনা দেখুন।",
      500,
    );
  }
}
