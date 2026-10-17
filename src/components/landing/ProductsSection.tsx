import { getProducts } from "@/lib/catalog";
import { site } from "@/content/site";
import { ProductCard } from "@/components/products/ProductCard";
import { Section, SectionHeading } from "@/components/ui/Section";

/**
 * Server component: reads the catalogue from PostgreSQL (falling back to the
 * bundled catalogue if the database is not reachable) and renders the grid.
 */
export async function ProductsSection() {
  const products = await getProducts();
  const copy = site.productsSection;

  return (
    <Section id="products" tone="muted">
      <div className="container-x">
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.slug}
              product={product}
              priority={index === 0}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          {copy.bulkNote} • পাইকারি রেট ও বড় প্রজেক্টের জন্য{" "}
          <a
            href={`tel:${site.contact.phone}`}
            className="font-semibold text-brand-700 hover:underline"
          >
            {site.contact.phoneDisplay}
          </a>{" "}
          নম্বরে কল করুন।
        </p>
      </div>
    </Section>
  );
}
