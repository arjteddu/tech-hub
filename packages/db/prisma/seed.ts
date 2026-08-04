import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const accessories = await prisma.category.upsert({
    where: { slug: "accessories" },
    create: { name: "Accessories", slug: "accessories" },
    update: {},
  });

  await prisma.product.upsert({
    where: { slug: "canvas-tote-bag" },
    create: {
      name: "Canvas Tote Bag",
      slug: "canvas-tote-bag",
      description: "A sturdy everyday tote, made from 12oz cotton canvas.",
      status: "ACTIVE",
      categoryId: accessories.id,
      images: [],
      variants: {
        create: [
          { sku: "TOTE-BLK", name: "Black", price: "799.00", inventoryQty: 25 },
          { sku: "TOTE-TAN", name: "Tan", price: "799.00", inventoryQty: 15 },
        ],
      },
    },
    update: {},
  });

  await prisma.product.upsert({
    where: { slug: "insulated-water-bottle" },
    create: {
      name: "Insulated Water Bottle",
      slug: "insulated-water-bottle",
      description: "Keeps drinks cold for 24 hours, hot for 12.",
      status: "ACTIVE",
      categoryId: accessories.id,
      images: [],
      variants: {
        create: [{ sku: "BOTTLE-750", name: "750ml", price: "1199.00", inventoryQty: 40 }],
      },
    },
    update: {},
  });

  console.log("Seeded categories and products.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
