// Writes the offline catalogue used by the demo APK (src/app/demo/demo-catalogue.json) from the same
// seed data as the real database. Run it again after editing server/db/seed-data.ts: npm run demo:data
import { writeFileSync } from 'node:fs';
import { price100 } from '../server/db/seed';
import { seedProducts } from '../server/db/seed-data';

const products = seedProducts.map((product, index) => {
  const id = index + 1;
  return {
    id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    audience: product.audience,
    description: product.description,
    scentNotes: product.scentNotes,
    imageUrl: `assets/products/${product.slug}.webp`,
    isBestSeller: product.bestSeller ?? false,
    isNewArrival: product.newArrival ?? false,
    // Variant ids follow the product: 2n-1 is the 50 ml bottle, 2n the 100 ml one
    variants: [
      { id: id * 2 - 1, sizeMl: 50, priceCents: product.price50 * 100 },
      { id: id * 2, sizeMl: 100, priceCents: price100(product.price50) * 100 },
    ],
  };
});

writeFileSync('src/app/demo/demo-catalogue.json', `${JSON.stringify(products, null, 2)}\n`);
console.log(`Wrote ${products.length} perfumes to src/app/demo/demo-catalogue.json`);
