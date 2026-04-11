import { promises as fs } from "fs";
import path from "path";

export type StoredProduct = {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  image: string;
  images?: string[];
  /** Long product details (Daraz-style block: text then images below on storefront) */
  description?: string;
  isNew: boolean;
  stock: number;
  inStock: boolean;
  isFeatured: boolean;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "products.json");

const DEFAULT_PRODUCTS: StoredProduct[] = [
  {
    id: 1,
    name: "Premium Kitchen Organizer",
    price: 1299,
    originalPrice: 1799,
    category: "Kitchen Accessories",
    image: "https://placehold.co/400x400?text=Kitchen+Organizer",
    isNew: true,
    stock: 20,
    inStock: true,
    isFeatured: false,
    createdAt: "2026-03-01",
  },
  {
    id: 2,
    name: "Elegant Wall Frame Set",
    price: 1599,
    originalPrice: 2100,
    category: "Home & Wall Decor",
    image: "https://placehold.co/400x400?text=Wall+Decor",
    isNew: true,
    stock: 15,
    inStock: true,
    isFeatured: true,
    createdAt: "2026-03-02",
  },
  {
    id: 3,
    name: "Baby Toy Storage Box",
    price: 999,
    originalPrice: 1299,
    category: "Babies & Toys",
    image: "https://placehold.co/400x400?text=Toy+Storage",
    isNew: true,
    stock: 18,
    inStock: true,
    isFeatured: false,
    createdAt: "2026-03-03",
  },
  {
    id: 4,
    name: "Makeup Brush Holder",
    price: 749,
    originalPrice: 999,
    category: "Health & Beauty",
    image: "https://placehold.co/400x400?text=Beauty+Holder",
    isNew: true,
    stock: 12,
    inStock: true,
    isFeatured: false,
    createdAt: "2026-03-04",
  },
  {
    id: 5,
    name: "Multi Hook Hanger",
    price: 599,
    originalPrice: 850,
    category: "Hangers & Hooks",
    image: "https://placehold.co/400x400?text=Hook+Hanger",
    isNew: true,
    stock: 25,
    inStock: true,
    isFeatured: false,
    createdAt: "2026-03-05",
  },
];

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify(DEFAULT_PRODUCTS, null, 2), "utf8");
  }
}

export async function readProducts(): Promise<StoredProduct[]> {
  await ensureStore();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  const parsed = JSON.parse(raw) as StoredProduct[];
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p) => p && Number.isFinite(Number(p.id)) && String(p.name).trim())
    .map((p) => {
      const stock = Number.isFinite(Number((p as { stock?: unknown }).stock))
        ? Number((p as { stock?: unknown }).stock)
        : p.inStock
          ? 1
          : 0;
      const images = Array.isArray((p as { images?: unknown }).images)
        ? ((p as { images?: unknown }).images as unknown[])
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        : [];
      const primaryImage = images[0] || String((p as { image?: unknown }).image || "").trim();
      const normalizedImages =
        images.length > 0 ? images : primaryImage ? [primaryImage] : [];
      return { ...p, images: normalizedImages, image: primaryImage, stock, inStock: stock > 0 };
    })
    .sort((a, b) => Number(b.id) - Number(a.id));
}

export async function writeProducts(products: StoredProduct[]) {
  await ensureStore();
  await fs.writeFile(FILE_PATH, JSON.stringify(products, null, 2), "utf8");
}

export function nextProductId(products: StoredProduct[]) {
  return products.length ? Math.max(...products.map((p) => Number(p.id))) + 1 : 1;
}
