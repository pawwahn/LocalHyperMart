import { ApiError, apiRequest, type PageData } from '@/shared/api/http';

export type CatalogItemDto = {
  listingId: string;
  masterItemId: string;
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
  note?: string | null;
  createdAt?: string;
  title?: string;
};

export type WalletTransactionListDto = {
  items: WalletTransactionDto[];
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
  shopName: string;
  unit: string;
  priceLabel: string;
  mrpLabel?: string | null;
  discountPercent?: number | null;
  vendorNote?: string | null;
  specialOfferActive?: boolean;
  price: number;
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
  return {
    listingId: dto.listingId,
    name: dto.name,
    shopName: dto.shopName,
    unit: dto.unit,
    price: Number(price),
    priceLabel: money(price),
    mrpLabel: hasDiscount ? money(mrp) : null,
    discountPercent,
    vendorNote: dto.vendorNote?.trim() || null,
    specialOfferActive: Boolean(dto.specialOfferActive),
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
    payableLabel: money(payable),
    minOrderValue,
    minOrderLabel: money(minOrderValue),
    minOrderMet: Boolean(dto.minOrderMet),
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

export async function fetchCatalog(townId: string, q?: string): Promise<CatalogItemView[]> {
  const query = q?.trim()
    ? `?townId=${townId}&q=${encodeURIComponent(q.trim())}`
    : `?townId=${townId}`;
  const data = await apiRequest<PageData<CatalogItemDto>>(`/api/v1/catalog/items${query}`);
  return (data.items ?? []).map(toCatalogItem);
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

export async function placeCodOrder(
  token: string,
  input: { townId: string; cartId: string; addressId: string },
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

export async function fetchWalletBalance(token: string): Promise<WalletBalanceDto> {
  return apiRequest<WalletBalanceDto>('/api/v1/payments/wallet/me', { token });
}

export async function fetchWalletTransactions(
  token: string,
  limit = 100,
): Promise<WalletTransactionDto[]> {
  const data = await apiRequest<WalletTransactionListDto>(
    `/api/v1/payments/wallet/me/transactions?limit=${limit}`,
    { token },
  );
  return data.items ?? [];
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
