import { ApiError, apiRequest, type PageData } from '@/shared/api/http';

export type CatalogItemDto = {
  listingId: string;
  masterItemId: string;
  categoryId?: string | null;
  category?: string | null;
  name: string;
  unit: string;
  shopName: string;
  vendorId: string;
  mrp?: number | null;
  price: number;
  discountPrice?: number | null;
  specialDiscountPrice?: number | null;
  effectivePrice?: number | null;
  specialOfferActive?: boolean;
  vendorNote?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  avgRating?: number | null;
  ratingCount?: number | null;
  fromPreviousOrder?: boolean;
};

export type CartDto = {
  cartId: string | null;
  townId: string;
  itemsSubtotal: number;
  promoDiscount?: number;
  promoCode?: string | null;
  promoDescription?: string | null;
  payableSubtotal?: number;
  itemCount: number;
  items: Array<{
    itemId: string;
    listingId: string;
    name: string;
    shopName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  minOrderValue?: number;
  minOrderMet?: boolean;
};

export type AddressDto = {
  id: string;
  townId: string;
  label?: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  pincode?: string;
  /** Jackson may serialize boolean isDefault as "default" */
  isDefault?: boolean;
  default?: boolean;
};

export type OrderSummaryDto = {
  orderId: string;
  orderNumber: string;
  status: string;
  displayStatus?: string;
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus: string;
  placedAt?: string;
  itemCount: number;
};

export type OrderItemDetailDto = {
  orderItemId?: string;
  name: string;
  shopName: string;
  unitCode?: string;
  quantity: number;
  lineTotal: number;
  status?: string;
  cancelReason?: string;
  cancelledAt?: string;
  storeCreditAmount?: number;
  canCancel?: boolean;
  canFileClaim?: boolean;
  canRate?: boolean;
  myRating?: number | null;
};

export type OrderTimelineStepDto = {
  code: string;
  label: string;
  state: string;
  at?: string | null;
  note?: string | null;
};

export type OrderDetailDto = {
  orderId: string;
  orderNumber: string;
  status: string;
  displayStatus?: string;
  placedAt?: string;
  itemsSubtotal: number;
  deliveryFee: number;
  platformFee?: number;
  storeCreditApplied?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress?: Record<string, unknown> | null;
  items: OrderItemDetailDto[];
  invoicePdfUrl?: string | null;
  timeline?: OrderTimelineStepDto[];
  canCancelOrder?: boolean;
  canFileClaim?: boolean;
  scratchCard?: ScratchCardDto | null;
};

export type ScratchCardDto = {
  id: string;
  orderId: string;
  orderNumber?: string | null;
  status: 'ISSUED' | 'REVEALED';
  rewardMin: number;
  rewardMax: number;
  revealedAmount?: number | null;
};

export type ClaimType = 'WRONG_ITEM' | 'MISSING' | 'DAMAGED';
export type ClaimStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';
export type ClaimResolution = 'WALLET_CREDIT' | 'NONE';

export type ClaimDto = {
  claimId: string;
  orderId: string;
  orderNumber?: string | null;
  orderItemId?: string | null;
  itemName?: string | null;
  shopName?: string | null;
  quantity?: number | null;
  unitCode?: string | null;
  suggestedCreditAmount?: number | null;
  claimType: ClaimType;
  status: ClaimStatus;
  reason: string;
  resolution?: ClaimResolution | null;
  resolvedAmount?: number | null;
  resolutionNote?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
};

export type WalletBalanceDto = {
  userId: string;
  balance: number;
  status?: string;
};

export type WalletTransactionDto = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceType?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  note?: string | null;
  createdAt?: string;
  title?: string;
};

export type WalletTransactionListDto = {
  items: WalletTransactionDto[];
  hasMore?: boolean;
  offset?: number;
  limit?: number;
};

export type CreateOrderDto = {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
};

export type CatalogItemView = {
  listingId: string;
  name: string;
  categoryId?: string | null;
  category?: string | null;
  shopName: string;
  unit: string;
  priceLabel: string;
  mrpLabel?: string | null;
  discountPercent?: number | null;
  vendorNote?: string | null;
  specialOfferActive?: boolean;
  avgRating: number;
  ratingCount: number;
  price: number;
  imageUrl?: string | null;
  imageUrls: string[];
  fromPreviousOrder?: boolean;
};

export type CartLineView = {
  itemId: string;
  listingId: string;
  name: string;
  shopName: string;
  quantity: number;
  lineLabel: string;
};

export type CartView = {
  cartId: string | null;
  itemCount: number;
  subtotalLabel: string;
  promoCode: string | null;
  promoDescription: string | null;
  promoDiscount: number;
  promoDiscountLabel: string;
  /** Items − promo (before delivery fee / store credit). */
  payableSubtotal: number;
  payableLabel: string;
  minOrderValue: number;
  minOrderLabel: string;
  minOrderMet: boolean;
  items: CartLineView[];
};

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

export function toCatalogItem(dto: CatalogItemDto): CatalogItemView {
  const mrp = Number(dto.mrp ?? dto.price);
  const price = Number(dto.effectivePrice ?? dto.discountPrice ?? dto.price);
  const hasDiscount = mrp > 0 && price < mrp;
  const discountPercent = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : null;
  const imageUrls = (dto.imageUrls ?? [])
    .map((u) => u?.trim())
    .filter((u): u is string => Boolean(u));
  const imageUrl = dto.imageUrl?.trim() || imageUrls[0] || null;
  const urls = imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [];
  return {
    listingId: dto.listingId,
    name: dto.name,
    categoryId: dto.categoryId ?? null,
    category: dto.category ?? null,
    shopName: dto.shopName,
    unit: dto.unit,
    price: Number(price),
    priceLabel: money(price),
    mrpLabel: hasDiscount ? money(mrp) : null,
    discountPercent,
    vendorNote: dto.vendorNote?.trim() || null,
    specialOfferActive: Boolean(dto.specialOfferActive),
    avgRating: Number(dto.avgRating ?? 0),
    ratingCount: Number(dto.ratingCount ?? 0),
    imageUrl,
    imageUrls: urls,
    fromPreviousOrder: Boolean(dto.fromPreviousOrder),
  };
}

export function toCartView(dto: CartDto): CartView {
  const minOrderValue = Number(dto.minOrderValue ?? 0);
  const promoDiscount = Number(dto.promoDiscount ?? 0);
  const payable = Number(dto.payableSubtotal ?? Math.max(0, Number(dto.itemsSubtotal ?? 0) - promoDiscount));
  return {
    cartId: dto.cartId,
    itemCount: dto.itemCount ?? 0,
    subtotalLabel: money(dto.itemsSubtotal),
    promoCode: dto.promoCode ?? null,
    promoDescription: dto.promoDescription ?? null,
    promoDiscount,
    promoDiscountLabel: money(promoDiscount),
    payableSubtotal: payable,
    payableLabel: money(payable),
    minOrderValue,
    minOrderLabel: money(minOrderValue),
    minOrderMet: true,
    items: (dto.items ?? []).map((i) => ({
      itemId: i.itemId,
      listingId: i.listingId,
      name: i.name,
      shopName: i.shopName,
      quantity: i.quantity,
      lineLabel: money(i.lineTotal),
    })),
  };
}

export type CatalogPage = {
  items: CatalogItemView[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function fetchCatalogPage(opts: {
  townId: string;
  q?: string;
  categoryId?: string;
  page?: number;
  size?: number;
  sort?: string;
  dir?: string;
}): Promise<CatalogPage> {
  const params = new URLSearchParams({
    townId: opts.townId,
    page: String(opts.page ?? 0),
    size: String(opts.size ?? 24),
    sort: opts.sort ?? 'name',
    dir: opts.dir ?? 'asc',
  });
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.categoryId) params.set('categoryId', opts.categoryId);
  const data = await apiRequest<PageData<CatalogItemDto>>(`/api/v1/catalog/items?${params}`, {
    timeoutMs: 8_000,
  });
  return {
    items: (data.items ?? []).map(toCatalogItem),
    page: data.page ?? 0,
    size: data.size ?? opts.size ?? 24,
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
  };
}

export type CategoryView = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export async function fetchCategories(townId?: string): Promise<CategoryView[]> {
  const q = townId ? `?townId=${encodeURIComponent(townId)}` : '';
  const data = await apiRequest<{ items: CategoryView[] }>(`/api/v1/catalog/categories${q}`);
  return data.items ?? [];
}

export async function fetchCart(token: string, townId: string): Promise<CartView> {
  const data = await apiRequest<CartDto>(`/api/v1/cart?townId=${townId}`, { token });
  return toCartView(data);
}

export async function fetchCartSuggestions(
  token: string,
  townId: string,
  limit = 10,
): Promise<CatalogItemView[]> {
  const data = await apiRequest<{ items: CatalogItemDto[] }>(
    `/api/v1/cart/suggestions?townId=${encodeURIComponent(townId)}&limit=${limit}`,
    { token, timeoutMs: 8_000 },
  );
  return (data.items ?? []).map(toCatalogItem);
}

export const PLACEHOLDER_DEAL_PREFIX = 'placeholder:deal:';

export function isPlaceholderListingId(listingId: string): boolean {
  return listingId.startsWith(PLACEHOLDER_DEAL_PREFIX);
}

export type DealLane = {
  id: string;
  label: string;
  atPrice?: number;
};

type DealSample = {
  name: string;
  unit: string;
  price: number;
  mrp?: number;
  rating?: number;
  reviews?: number;
  maxPrice?: number;
};

function toDealItem(sample: DealSample, index: number): CatalogItemView {
  const hasDiscount = sample.mrp != null && sample.mrp > sample.price;
  return {
    listingId: `${PLACEHOLDER_DEAL_PREFIX}${index + 1}`,
    name: sample.name,
    shopName: 'Local shop',
    unit: sample.unit,
    price: sample.price,
    priceLabel: money(sample.price),
    mrpLabel: hasDiscount ? money(sample.mrp) : null,
    discountPercent: hasDiscount
      ? Math.round(((sample.mrp! - sample.price) / sample.mrp!) * 100)
      : null,
    avgRating: sample.rating ?? 0,
    ratingCount: sample.reviews ?? 0,
    imageUrls: [],
  };
}

const PLACEHOLDER_DEAL_SAMPLES: DealSample[] = [
  { name: 'Basmati Rice 1kg', unit: '1 kg', price: 140, mrp: 165, rating: 4.6, reviews: 210, maxPrice: 149 },
  { name: 'Farm Eggs 6pc', unit: '1 pack', price: 48, mrp: 60, rating: 4.5, reviews: 88, maxPrice: 49 },
  { name: 'Toned Milk 500ml', unit: '1 pack', price: 28, mrp: 32, rating: 4.4, reviews: 340, maxPrice: 29 },
  { name: 'Toor Dal 1kg', unit: '1 kg', price: 148, mrp: 175, rating: 4.3, reviews: 64, maxPrice: 149 },
  { name: 'Sunflower Oil 1L', unit: '1 pc', price: 132, mrp: 155, rating: 4.5, reviews: 120, maxPrice: 149 },
  { name: 'Wheat Atta 5kg', unit: '1 pack', price: 245, mrp: 280, rating: 4.7, reviews: 410, maxPrice: 249 },
  { name: 'Little Hearts Biscuits', unit: '1 pack (75 g)', price: 19, mrp: 30, rating: 4.7, reviews: 920, maxPrice: 19 },
  { name: 'Soya Chunks 200g', unit: '1 pack', price: 29, mrp: 42, rating: 4.4, reviews: 150, maxPrice: 29 },
  { name: 'Maggi Masala 70g', unit: '1 pack', price: 14, mrp: 16, rating: 4.6, reviews: 1800, maxPrice: 19 },
  { name: 'Tata Salt 1kg', unit: '1 pack', price: 28, mrp: 32, rating: 4.8, reviews: 640, maxPrice: 29 },
  { name: 'Parle-G Gold 250g', unit: '1 pack', price: 29, mrp: 35, rating: 4.5, reviews: 510, maxPrice: 29 },
  { name: 'Kissan Jam 200g', unit: '1 pc', price: 49, mrp: 65, rating: 4.2, reviews: 77, maxPrice: 49 },
];

/** Town deals feed is not wired yet. Swap this for the real API when it exists. */
export function placeholderBestDealsInTown(): CatalogItemView[] {
  return PLACEHOLDER_DEAL_SAMPLES.slice(0, 6).map(toDealItem);
}

export function placeholderDealLanes(prices: number[] = [19, 29, 49, 99]): DealLane[] {
  const caps = prices.filter((n) => Number.isFinite(n) && n >= 1).slice(0, 4);
  return [
    { id: 'all', label: 'Best of all deals' },
    ...caps.map((atPrice) => ({
      id: String(atPrice),
      label: 'Deals at',
      atPrice,
    })),
  ];
}

export function placeholderDealsForLane(laneId: string): CatalogItemView[] {
  const items = PLACEHOLDER_DEAL_SAMPLES.map(toDealItem);
  if (laneId === 'all') return items;
  const cap = Number(laneId);
  if (!Number.isFinite(cap)) return items;
  return PLACEHOLDER_DEAL_SAMPLES.map((sample, i) => ({ sample, item: toDealItem(sample, i) }))
    .filter(({ sample }) => (sample.maxPrice ?? sample.price) <= cap)
    .map(({ item }) => item);
}

export async function addToCart(
  token: string,
  townId: string,
  listingId: string,
  quantity = 1,
): Promise<CartView> {
  const data = await apiRequest<CartDto>('/api/v1/cart/items', {
    method: 'POST',
    token,
    body: { townId, listingId, quantity },
  });
  return toCartView(data);
}

export async function updateCartItem(
  token: string,
  itemId: string,
  quantity: number,
): Promise<CartView> {
  const data = await apiRequest<CartDto>(`/api/v1/cart/items/${itemId}`, {
    method: 'PATCH',
    token,
    body: { quantity },
  });
  return toCartView(data);
}

export async function applyPromo(token: string, townId: string, code: string): Promise<CartView> {
  const data = await apiRequest<CartDto>(`/api/v1/cart/promo?townId=${townId}`, {
    method: 'POST',
    token,
    body: { code },
  });
  return toCartView(data);
}

export async function removePromo(token: string, townId: string): Promise<CartView> {
  const data = await apiRequest<CartDto>(`/api/v1/cart/promo?townId=${townId}`, {
    method: 'DELETE',
    token,
  });
  return toCartView(data);
}

export async function removeCartItem(token: string, itemId: string): Promise<CartView> {
  const data = await apiRequest<CartDto>(`/api/v1/cart/items/${itemId}`, {
    method: 'DELETE',
    token,
  });
  return toCartView(data);
}

/** Move buyer cart to a new town (clears other-town carts when confirmClear=true). */
export async function changeCartTown(
  token: string,
  newTownId: string,
  confirmClear = true,
): Promise<CartView> {
  const data = await apiRequest<CartDto>('/api/v1/cart/change-town', {
    method: 'POST',
    token,
    body: { newTownId, confirmClear },
  });
  return toCartView(data);
}

export function isCartTownConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /another town|change-town|confirmClear/i.test(msg);
}

export function friendlyCartError(err: unknown, fallback: string): string {
  if (isCartTownConflict(err)) {
    return 'Your cart had items from another town. We cleared it so you can shop here — try again.';
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function listAddresses(token: string): Promise<AddressDto[]> {
  return apiRequest<AddressDto[]>('/api/v1/addresses', { token });
}

export async function createAddress(
  token: string,
  body: {
    townId: string;
    label?: string;
    recipientName: string;
    recipientPhone: string;
    line1: string;
    line2?: string;
    landmark?: string;
    pincode?: string;
    isDefault?: boolean;
  },
): Promise<AddressDto> {
  return apiRequest<AddressDto>('/api/v1/addresses', { method: 'POST', token, body });
}

export async function updateAddress(
  token: string,
  addressId: string,
  body: {
    townId: string;
    label?: string;
    recipientName: string;
    recipientPhone: string;
    line1: string;
    line2?: string;
    landmark?: string;
    pincode?: string;
    isDefault?: boolean;
  },
): Promise<AddressDto> {
  return apiRequest<AddressDto>(`/api/v1/addresses/${addressId}`, { method: 'PUT', token, body });
}

export async function deleteAddress(token: string, addressId: string): Promise<void> {
  await apiRequest<unknown>(`/api/v1/addresses/${addressId}`, { method: 'DELETE', token });
}

export async function placeCodOrder(
  token: string,
  input: { townId: string; cartId: string; addressId: string; useStoreCredit?: boolean },
): Promise<CreateOrderDto> {
  return apiRequest<CreateOrderDto>('/api/v1/orders', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': `web-${Date.now()}` },
    body: {
      townId: input.townId,
      cartId: input.cartId,
      addressId: input.addressId,
      paymentMethod: 'COD',
      useStoreCredit: Boolean(input.useStoreCredit),
    },
  });
}

export async function listMyOrders(token: string, townId: string): Promise<OrderSummaryDto[]> {
  const data = await apiRequest<PageData<OrderSummaryDto>>(
    `/api/v1/orders?townId=${townId}&page=0&size=100`,
    { token },
  );
  return data.items ?? [];
}

export async function fetchOrderDetail(token: string, orderId: string): Promise<OrderDetailDto> {
  return apiRequest<OrderDetailDto>(`/api/v1/orders/${orderId}`, { token });
}

export async function listPendingScratchCards(token: string): Promise<ScratchCardDto[]> {
  const data = await apiRequest<ScratchCardDto[] | { items?: ScratchCardDto[] }>(
    '/api/v1/orders/scratch-cards',
    { token },
  );
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function revealScratchCard(token: string, orderId: string): Promise<ScratchCardDto> {
  return apiRequest<ScratchCardDto>(`/api/v1/orders/${orderId}/scratch-card/reveal`, {
    method: 'POST',
    token,
    body: {},
  });
}

export async function cancelOrder(
  token: string,
  orderId: string,
  reason: string,
): Promise<OrderDetailDto> {
  return apiRequest<OrderDetailDto>(`/api/v1/orders/${orderId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function cancelOrderItem(
  token: string,
  orderId: string,
  itemId: string,
  reason: string,
): Promise<OrderDetailDto> {
  return apiRequest<OrderDetailDto>(`/api/v1/orders/${orderId}/items/${itemId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function fetchOrderClaims(token: string, orderId: string): Promise<ClaimDto[]> {
  return apiRequest<ClaimDto[]>(`/api/v1/orders/${orderId}/claims`, { token });
}

export async function createOrderClaim(
  token: string,
  orderId: string,
  body: { claimType: ClaimType; orderItemId: string; reason: string },
): Promise<ClaimDto> {
  return apiRequest<ClaimDto>(`/api/v1/orders/${orderId}/claims`, {
    method: 'POST',
    token,
    body,
  });
}

export async function rateOrderItem(
  token: string,
  orderId: string,
  orderItemId: string,
  stars: number,
): Promise<{ stars: number; orderItemId: string }> {
  return apiRequest<{ stars: number; orderItemId: string }>(`/api/v1/orders/${orderId}/ratings`, {
    method: 'POST',
    token,
    body: { orderItemId, stars },
  });
}

export async function fetchWalletBalance(token: string): Promise<WalletBalanceDto> {
  return apiRequest<WalletBalanceDto>('/api/v1/payments/wallet/me', { token });
}

export async function fetchWalletTransactions(
  token: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<WalletTransactionListDto> {
  const limit = opts.limit ?? 40;
  const offset = opts.offset ?? 0;
  return apiRequest<WalletTransactionListDto>(
    `/api/v1/payments/wallet/me/transactions?limit=${limit}&offset=${offset}`,
    { token },
  );
}

/** Downloads invoice PDF with auth; returns filename for local save. */
export async function downloadOrderInvoice(
  token: string,
  orderId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/v1/orders/${orderId}/invoice`, {
    headers: {
      Accept: 'application/pdf',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    let message = 'Could not download invoice';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      /* binary or empty */
    }
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `invoice-${orderId}.pdf`;
  const blob = await response.blob();
  return { blob, filename };
}
