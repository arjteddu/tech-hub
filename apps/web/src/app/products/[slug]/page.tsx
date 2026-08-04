import { notFound } from "next/navigation";
import { getProduct } from "@/lib/api";
import { AddToCartButton } from "@/components/add-to-cart-button";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const variant = product.variants[0];

  return (
    <div className="grid gap-10 sm:grid-cols-2">
      <div className="aspect-square rounded-lg bg-black/5 dark:bg-white/10" />
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {variant && <p className="text-xl">₹{variant.price}</p>}
        <p className="text-black/70 dark:text-white/70">{product.description}</p>
        {variant && variant.inventoryQty > 0 ? (
          <AddToCartButton variantId={variant.id} />
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">Out of stock</p>
        )}
      </div>
    </div>
  );
}
