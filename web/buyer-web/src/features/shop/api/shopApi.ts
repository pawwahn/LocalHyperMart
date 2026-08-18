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
