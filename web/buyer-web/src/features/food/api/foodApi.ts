import { apiRequest } from '@/shared/api/http';
import { addToCart } from '@/features/shop/api/shopApi';

export type FoodHotelPhoto = {
  mediaId: string;
  url: string;
};

export type FoodHotelCard = {
  vendorId: string;
  businessName: string;
  shopName: string;
  tagline?: string | null;
  cuisines?: string | null;
  pureVeg: boolean;
  opensAtLabel?: string | null;
  priceForOne?: number | null;
  offerLabel?: string | null;
  ratingScore: number;
  ratingCount: number;
  acceptingOrders: boolean;
  hotelPhotos?: FoodHotelPhoto[];
};

export type FoodMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  buyerNote: string;
  price: number;
  veg: boolean;
  active: boolean;
  listingId?: string | null;
  imageUrls?: string[];
};

export type FoodMenuCategory = {
  id: string;
  name: string;
  active: boolean;
  items: FoodMenuItem[];
};

export type BuyerFoodMenu = {
  vendorId: string;
  shopName: string;
  categories: FoodMenuCategory[];
};

export async function fetchFoodHotels(token: string, townId: string): Promise<FoodHotelCard[]> {
  return apiRequest<FoodHotelCard[]>(`/api/v1/vendors/food/towns/${townId}/hotels?bookableOnly=true`, { token });
}

export async function fetchFoodHotel(token: string, vendorId: string): Promise<FoodHotelCard> {
  return apiRequest<FoodHotelCard>(`/api/v1/vendors/food/hotels/${vendorId}`, { token });
}

export async function fetchFoodMenu(
  vendorId: string,
  townId: string,
  token?: string | null,
): Promise<BuyerFoodMenu> {
  const params = new URLSearchParams({ townId });
  return apiRequest<BuyerFoodMenu>(`/api/v1/catalog/food/vendors/${vendorId}/menu?${params}`, {
    token: token || null,
  });
}

export async function addFoodToCart(
  token: string,
  townId: string,
  listingId: string,
  quantity = 1,
): Promise<void> {
  await addToCart(token, townId, listingId, quantity);
}