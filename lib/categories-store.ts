import { promises as fs } from "fs";
import path from "path";

export type ShopCategory = {
  id: number;
  name: string;
  image: string;
  showOnHome?: boolean;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "categories.json");

const DEFAULT_CATEGORIES: ShopCategory[] = [
  {
    id: 1,
    name: "Kitchen Accessories",
    image: "/uploads/categories/kitchen.jpg",
    showOnHome: true,
  },
  {
    id: 2,
    name: "Wardrobe and Organizers",
    image: "/uploads/categories/wardrobe.jpg",
    showOnHome: true,
  },
  {
    id: 3,
    name: "Health & Beauty",
    image: "/uploads/categories/health-beauty.jpg",
    showOnHome: true,
  },
  {
    id: 4,
    name: "Home & Wall Decor",
    image: "/uploads/categories/home-wall-decor.jpg",
    showOnHome: true,
  },
  {
    id: 5,
    name: "Hangers & Hooks",
    image: "/uploads/categories/hangers-hooks.jpg",
    showOnHome: true,
  },
  {
    id: 6,
    name: "Mobile Holders",
    image: "/uploads/categories/mobile-holders.jpg",
    showOnHome: true,
  },
];

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify(DEFAULT_CATEGORIES, null, 2), "utf8");
  }
}

export async function readCategories(): Promise<ShopCategory[]> {
  await ensureStore();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  const parsed = JSON.parse(raw) as ShopCategory[];
  return Array.isArray(parsed)
    ? parsed
        .filter((x) => x && Number.isFinite(x.id) && x.name && x.image)
        .map((x) => ({ ...x, showOnHome: x.showOnHome === true }))
        .sort((a, b) => a.id - b.id)
    : [];
}

export async function writeCategories(categories: ShopCategory[]) {
  await ensureStore();
  await fs.writeFile(FILE_PATH, JSON.stringify(categories, null, 2), "utf8");
}

export function nextCategoryId(categories: ShopCategory[]) {
  return categories.length ? Math.max(...categories.map((c) => c.id)) + 1 : 1;
}
