/**
 * Seeds the product catalogue.
 *
 *   npm run db:seed
 *
 * Safe to run repeatedly: products are upserted by slug and their specs are
 * replaced, so editing `src/content/products.ts` and re-running keeps the
 * database in sync without touching existing orders.
 */
import { PrismaClient } from "@prisma/client";
import { seedProducts } from "../src/content/products";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${seedProducts.length} products...`);

  for (const product of seedProducts) {
    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        nameEn: product.nameEn,
        tagline: product.tagline,
        description: product.description,
        gsm: product.gsm,
        price: product.price,
        unit: product.unit,
        badge: product.badge ?? null,
        imageUrl: product.imageUrl ?? null,
        sortOrder: product.sortOrder,
        isActive: true,
      },
      create: {
        slug: product.slug,
        name: product.name,
        nameEn: product.nameEn,
        tagline: product.tagline,
        description: product.description,
        gsm: product.gsm,
        price: product.price,
        unit: product.unit,
        badge: product.badge ?? null,
        imageUrl: product.imageUrl ?? null,
        sortOrder: product.sortOrder,
      },
      select: { id: true, name: true },
    });

    // Specs are a child table: clear and recreate for a deterministic result.
    await prisma.specItem.deleteMany({ where: { productId: saved.id } });
    await prisma.specItem.createMany({
      data: product.specs.map((spec, index) => ({
        productId: saved.id,
        label: spec.label,
        value: spec.value,
        sortOrder: index,
      })),
    });

    console.log(`  ✔ ${saved.name} (${product.specs.length} specs)`);
  }

  const productCount = await prisma.product.count();
  const orderCount = await prisma.order.count();
  console.log(`Done. products=${productCount}, existing orders=${orderCount}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
