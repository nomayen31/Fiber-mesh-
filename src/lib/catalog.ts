import { seedProducts, type SeedProduct } from "@/content/products";
import { prisma } from "@/lib/prisma";
import { safeErrorText } from "@/lib/sanitize";
import type { ProductSummary } from "@/lib/types";

/** Product shape used by every UI component. */
export type ProductView = ProductSummary;

function fromSeed(product: SeedProduct): ProductView {
  return {
    id: product.slug,
    slug: product.slug,
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
    specs: product.specs,
  };
}

/**
 * Read the catalogue from PostgreSQL. If the database has not been seeded yet
 * (or is temporarily unreachable) the bundled catalogue is used instead, so the
 * public website keeps working.
 */
export async function getProducts(): Promise<ProductView[]> {
  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      include: { specs: { orderBy: { sortOrder: "asc" } } },
    });

    if (rows.length === 0) return seedProducts.map(fromSeed);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      nameEn: row.nameEn,
      tagline: row.tagline,
      description: row.description,
      gsm: row.gsm,
      price: row.price,
      unit: row.unit,
      badge: row.badge,
      imageUrl: row.imageUrl,
      // Older rows predate `images` — fall back to the single primary photo.
      images:
        row.images && row.images.length > 0
          ? row.images
          : row.imageUrl
            ? [row.imageUrl]
            : [],
      specs: row.specs.map((spec) => ({
        label: spec.label,
        value: spec.value,
      })),
    }));
  } catch (error) {
    console.error(
      "[catalog] database unavailable, using bundled catalogue:",
      safeErrorText(error),
    );
    return seedProducts.map(fromSeed);
  }
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductView | null> {
  const all = await getProducts();
  return all.find((product) => product.slug === slug) ?? null;
}

export type OrderLine = {
  productId: string | null;
  productName: string;
  unitPrice: number;
};

/**
 * Resolve a product (by slug, falling back to id) into the immutable values
 * that get stored on an order. Prices always come from the server — never from
 * the browser.
 */
export async function resolveOrderLine(
  slugOrId: string,
): Promise<OrderLine | null> {
  try {
    const row = await prisma.product.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        isActive: true,
      },
      select: { id: true, name: true, price: true },
    });
    if (row) {
      return { productId: row.id, productName: row.name, unitPrice: row.price };
    }
  } catch (error) {
    console.error(
      "[catalog] resolveOrderLine fell back to static data:",
      safeErrorText(error),
    );
  }

  const fallback = seedProducts.find((product) => product.slug === slugOrId);
  if (!fallback) return null;
  return {
    productId: null,
    productName: fallback.name,
    unitPrice: fallback.price,
  };
}
