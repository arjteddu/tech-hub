import Link from "next/link";
import { getProducts } from "@/lib/api";
import { ProductImage } from "@/components/product-image";

// Server-rendered per request rather than statically built: this page's
// data comes from the API, which the frontend build has no guarantee of
// being able to reach (separate deploys, separate services). Static
// generation would make every frontend build fail whenever the API
// happens to be unreachable at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { items } = await getProducts();

  if (items.length === 0) {
    return (
      <p className="text-black/60 dark:text-white/60">
        No products yet — create one via the API (or Prisma Studio) to see it here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
      {items.map((product) => {
        const price = product.variants[0]?.price;
        return (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group flex flex-col gap-2"
          >
            <ProductImage
              src={product.images[0]}
              alt={product.name}
              className="aspect-square rounded-lg"
            />
            <span className="text-sm font-medium group-hover:underline">{product.name}</span>
            {price && <span className="text-sm text-black/60 dark:text-white/60">₹{price}</span>}
          </Link>
        );
      })}
    </div>
  );
}
