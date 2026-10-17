/**
 * Connectivity smoke test for the configured PostgreSQL database.
 *
 *   npm run db:check
 *
 * Uses only the pooled DATABASE_URL (the same one the app uses) and reports
 * the tables it finds, without printing any credentials.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(
    "select version() as version, current_database() as db, current_user as whoami, now() as ts",
  );
  const row = rows[0];

  console.log("✔ Connected to PostgreSQL");
  console.log("  database :", row.db);
  console.log("  user     :", row.whoami);
  console.log("  server   :", String(row.version).slice(0, 55));

  const tables = await prisma.$queryRawUnsafe(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log(
    "  tables   :",
    tables.length === 0 ? "(none — run npm run db:migrate)" : tables.map((t) => t.table_name).join(", "),
  );

  if (tables.some((t) => t.table_name === "Product")) {
    const [products, orders, inquiries] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.inquiry.count(),
    ]);
    console.log(
      `  data     : products=${products}, orders=${orders}, inquiries=${inquiries}`,
    );
  }
} catch (error) {
  console.error("✖ Database check failed");
  console.error("  code:", error.code ?? "(none)");
  console.error("  msg :", String(error.message).split("\n").slice(0, 5).join(" | "));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
