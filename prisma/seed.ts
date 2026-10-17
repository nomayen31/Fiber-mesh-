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

  const slugs = seedProducts.map((product) => product.slug);

  // Products that are no longer in the catalogue are removed so the storefront
  // and the admin dropdown only ever show what is really for sale. Existing
  // orders keep their own `productName` snapshot, so history stays intact.
  const retired = await prisma.product.deleteMany({
    where: { slug: { notIn: slugs } },
  });
  if (retired.count > 0) {
    console.log(`  – removed ${retired.count} product(s) no longer in the catalogue`);
  }

  for (const product of seedProducts) {
    const data = {
      name: product.name,
      nameEn: product.nameEn,
      tagline: product.tagline,
      description: product.description,
      gsm: product.gsm ?? null,
      price: product.price,
      unit: product.unit,
      badge: product.badge ?? null,
      imageUrl: product.images[0] ?? null,
      images: product.images,
      sortOrder: product.sortOrder,
    };

    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...data, isActive: true },
      create: { slug: product.slug, ...data },
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

    console.log(
      `  ✔ ${saved.name} — ${formatBdt(product.price)}, ${product.images.length} photo(s), ${product.specs.length} specs`,
    );
  }

  const productCount = await prisma.product.count();
  const orderCount = await prisma.order.count();
  console.log(`Done. products=${productCount}, existing orders=${orderCount}`);
}

function formatBdt(value: number) {
  return `৳${value.toLocaleString("bn-BD")}`;
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
