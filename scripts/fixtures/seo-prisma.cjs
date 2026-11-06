// Explicitly preloaded by the LOCAL SEO HTTP test only. Never imported by application code.
// No network/database connection; any attempted database write fails the test.
const date = new Date('2026-10-01T00:00:00Z');
const vendor = { id: 'seo-store', status: 'approved', shopName: 'Fixture seller', shopDescription: 'Public fixture store description.', storeSlug: 'fixture-store',
  city: 'Lahore', createdAt: date, updatedAt: date, shopLogo: '/icon.png', storeBanner: null, storePolicies: null, serviceCities: ['Lahore'], primaryCategory: 'Phones',
  _count: { followers: 0, products: 20 }, vendorShopOrders: [] };
const publication = { id: 'publication', vendorId: vendor.id, vendor, status: 'active', totalSold: 0, publishedProductId: 'seo-p-01' };
const products = Array.from({ length: 20 }, (_, i) => ({ id: `seo-p-${String(i + 1).padStart(2, '0')}`, name: `Fixture phone ${i + 1}`, description: 'Original fixture product description.',
  category: 'Phones', categoryRecordId: 'seo-category', price: 1200.5 + i, stock: i === 0 ? 0 : 4, originalPrice: null, discountPercent: 0, warrantyMonths: null, variants: [],
  listingImageUrls: ['/icon.png'], isActive: true, createdAt: date, updatedAt: date, productImages: [], vendorPublication: i === 0 ? publication : null,
  legacyNewArrivalId: i === 0 ? 1 : null, isFeatured: false, _count: {} }));
products.push({ ...products[0], id: 'inactive-product', isActive: false }, { ...products[0], id: 'unapproved-product', vendorPublication: { ...publication, vendor: { ...vendor, status: 'pending' } } });
const category = { id: 'seo-category', name: 'Phones', slug: 'phones', image: '/icon.png', isActive: true, createdAt: date, updatedAt: date, products, sortOrder: 0, showOnHome: true, legacyId: 1 };
const extraCategories = Array.from({ length: 6 }, (_, i) => {
  const id = `public-category-${i}`, name = `Fixture category ${i}`;
  const product = { ...products[1], id: `category-product-${i}`, name: `Category item ${i}`, category: name, categoryRecordId: id, stock: i === 0 ? 0 : 3 };
  products.push(product);
  return { ...category, id, name, slug: id, products: [product], sortOrder: i + 1, legacyId: i + 2 };
});
const hiddenProduct = { ...products[1], id: 'hidden-category-product', category: 'Hidden homepage category', categoryRecordId: 'hidden-category' };
products.push(hiddenProduct);
const categoryCases = [
  { ...category, id: 'empty-category', slug: 'empty-category', name: 'Empty category', products: [] },
  { ...category, id: 'inactive-category', slug: 'inactive-category', name: 'Inactive category', isActive: false },
  { ...category, id: 'inactive-product-category', slug: 'inactive-product-category', products: [products.find(p => p.id === 'inactive-product')] },
  { ...category, id: 'pending-category', slug: 'pending-category', products: [products.find(p => p.id === 'unapproved-product')] },
  { ...category, id: 'suspended-category', slug: 'suspended-category', products: [{ ...products[0], vendorPublication: { ...publication, vendor: { ...vendor, status: 'suspended' } } }] },
  { ...category, id: 'private-category', slug: 'private-category', products: [{ ...products[0], vendorPublication: { ...publication, status: 'draft' } }] },
  { ...category, id: 'hidden-category', slug: 'hidden-category', name: hiddenProduct.category, products: [hiddenProduct], showOnHome: false },
];
const service = { id: 'public-service', name: 'Fixture repair', description: 'Public service description.', type: 'Repairs', price: 2500, priceType: 'FIXED', cities: ['Lahore'], coverage: null,
  active: true, moderationStatus: 'APPROVED', vendor, vendorId: vendor.id, catalog: null, imageUrl: null, durationMinutes: 60, leadDays: 1, warranty: '', cancellationTerms: 'Fixture terms', updatedAt: date, createdAt: date };
const want = { id: 'public-want', title: 'Public camera request', description: 'Public request details.', category: 'Phones', city: 'Lahore', requestType: 'PRODUCT', budgetMin: null, budgetMax: null,
  budgetFlexible: true, quantity: 1, condition: 'Any', photo: null, photos: [], needBy: null, createdAt: date, updatedAt: date, expiresAt: new Date('2099-01-01'), status: 'OPEN',
  customerId: 'fixture-customer', customer: { isActive: true, name: 'Fixture Customer', image: null }, interests: [], _count: { interests: 0, offers: 0 } };
const tables = {
  product: products, category: [category, ...extraCategories, ...categoryCases], vendor: [vendor, { ...vendor, id: 'pending-store', storeSlug: 'pending-store', status: 'pending' }], vendorProduct: [publication],
  serviceOffering: [service, { ...service, id: 'pending-service', moderationStatus: 'PENDING_APPROVAL' }],
  want: [want, { ...want, id: 'private-want', title: 'PRIVATE REQUEST MUST NOT LEAK', status: 'PENDING_MODERATION' }, { ...want, id: 'expired-want', expiresAt: date }],
  settings: [{ id: 'fixture-settings', shopName: 'JORO.PK', whatsappNumber: '', codCharges: 150, codAvailableCities: [], bankMeezanTitle: '', bankMeezanNumber: '', bankHblTitle: '', bankHblNumber: '', bankEasypaisa: '', bankJazzcash: '' }],
};
let failReads = false, blockedWrites = 0, emptyHomeCategories = false;
function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (Array.isArray(condition) ? condition : [condition]).every(part => matches(row, part));
    if (key === 'OR') return condition.some(part => matches(row, part));
    if (key === 'NOT') return !matches(row, condition);
    const value = row?.[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('is' in condition) return condition.is === null ? value == null : value != null && matches(value, condition.is);
      if ('some' in condition) return Array.isArray(value) && value.some(item => matches(item, condition.some));
      if ('in' in condition && !condition.in.includes(value)) return false;
      if ('not' in condition && (typeof condition.not === 'object' && condition.not !== null ? matches({ x: value }, { x: condition.not }) : value === condition.not)) return false;
      if ('contains' in condition && !String(value).toLowerCase().includes(condition.contains.toLowerCase())) return false;
      if ('gt' in condition && !(value > condition.gt)) return false;
      if ('gte' in condition && !(value >= condition.gte)) return false;
      if ('lt' in condition && !(value < condition.lt)) return false;
      if ('lte' in condition && !(value <= condition.lte)) return false;
      const operators = ['is','some','in','not','contains','gt','gte','lt','lte'];
      const nested = Object.keys(condition).filter(k => !operators.includes(k));
      return !nested.length || value != null && matches(value, Object.fromEntries(nested.map(k => [k, condition[k]])));
    }
    return value === condition;
  });
}
function read(model, args = {}) {
  if (failReads) throw new Error('Offline fixture read failure');
  if (emptyHomeCategories && model === 'category' && args.where?.showOnHome === true) return [];
  let rows = (tables[model] || []).filter(row => matches(row, args.where));
  if (args.orderBy) rows = [...rows].sort((a, b) => {
    for (const order of Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) {
      const [key, direction] = Object.entries(order)[0];
      if (typeof direction !== 'string') continue;
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    } return 0;
  });
  return rows.slice(args.skip || 0, args.take === undefined ? undefined : (args.skip || 0) + args.take);
}
globalThis.prisma = new Proxy({}, { get(_target, model) {
  if (model === '$disconnect') return async () => undefined;
  if (model === '$transaction') return async () => { blockedWrites++; throw new Error('Transaction forbidden in SEO fixture'); };
  return new Proxy({}, { get(_model, operation) {
    if (['findMany','findFirst','findUnique','count','aggregate','groupBy'].includes(operation)) return async args => {
      if (operation === 'groupBy') return [];
      const rows = read(model, args);
      if (operation === 'count') return rows.length;
      if (operation === 'aggregate') return { _min: { price: 1200.5 }, _max: { price: 1219.5 } };
      return operation === 'findMany' ? rows : rows[0] || null;
    };
    return async () => { blockedWrites++; throw new Error('Database write forbidden in SEO fixture'); };
  } });
} });
process.on('message', message => {
  if (message?.type === 'seo-fixture') {
    if (typeof message.failReads === 'boolean') failReads = message.failReads;
    if (typeof message.emptyHomeCategories === 'boolean') emptyHomeCategories = message.emptyHomeCategories;
    process.send?.({ type: 'seo-fixture', blockedWrites });
  }
});
