"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { PresignedUploadDto } from "shared";
import { useAuth } from "@/lib/auth-context";
import { API_URL, type Category } from "@/lib/api";

// One variant per product here — enough to prove create + upload work
// end to end. Multiple variants (sizes, colors) is a form enhancement,
// not a new endpoint: CreateProductDto already accepts a variants array.
export default function NewProductPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/catalog/categories`);
      return (await res.json()) as Category[];
    },
  });

  async function onSelectImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const presignRes = await authFetch("/media/presign", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) {
        throw new Error(
          (await presignRes.json()).message ?? "Media storage isn't configured (see R2_* env vars)",
        );
      }
      const { uploadUrl, publicUrl } = (await presignRes.json()) as PresignedUploadDto;

      // Straight to R2 — the file never passes through our api.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      setImageUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await authFetch("/catalog/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
          description: form.get("description"),
          categoryId: form.get("categoryId") || undefined,
          status: form.get("status"),
          images: imageUrl ? [imageUrl] : [],
          variants: [
            {
              sku: form.get("sku"),
              name: form.get("variantName"),
              price: Number(form.get("price")),
              inventoryQty: Number(form.get("inventoryQty")),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not create product");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  const inputClass = "rounded-md border border-black/15 px-3 py-2 dark:border-white/20";

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">New product</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input name="name" placeholder="Name" required className={inputClass} />
        <input name="slug" placeholder="Slug" required pattern="[a-z0-9-]+" className={inputClass} />
        <textarea name="description" placeholder="Description" required rows={3} className={inputClass} />

        <select name="categoryId" className={inputClass} defaultValue="">
          <option value="">No category</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select name="status" className={inputClass} defaultValue="DRAFT">
          <option value="DRAFT">Draft (hidden from the storefront)</option>
          <option value="ACTIVE">Active</option>
        </select>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-black/60 dark:text-white/60">Photo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onSelectImage} />
          {uploading && <p className="text-sm text-black/50 dark:text-white/50">Uploading…</p>}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-24 w-24 rounded-md object-cover" />
          )}
        </div>

        <fieldset className="flex flex-col gap-3 rounded-md border border-black/15 p-3 dark:border-white/20">
          <legend className="px-1 text-sm text-black/60 dark:text-white/60">Variant</legend>
          <input name="sku" placeholder="SKU" required className={inputClass} />
          <input name="variantName" placeholder="Variant name (e.g. Black)" required className={inputClass} />
          <input name="price" type="number" step="0.01" min="0" placeholder="Price" required className={inputClass} />
          <input name="inventoryQty" type="number" min="0" placeholder="Stock quantity" required className={inputClass} />
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending || uploading}
          className="self-start rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Creating…" : "Create product"}
        </button>
      </form>
    </div>
  );
}
