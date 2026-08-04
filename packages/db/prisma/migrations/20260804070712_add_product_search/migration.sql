-- Full-text search for the catalog. A generated, stored tsvector column
-- (not representable in schema.prisma, hence the raw SQL) plus a GIN
-- index — name weighted above description so a name match ranks first.
ALTER TABLE "products"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector");
