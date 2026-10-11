export interface SizeOption {
  _id?: string;
  size: string;
  sizeCode?: string;
  stock: number;
  mrp?: number;
  price?: number;
}

export interface ProductVariant {
  _id?: string;
  color?: string;
  colorName?: string;
  colorHex?: string;
  images: (string | { public_id: string; url: string })[];
  sizes: SizeOption[];
  price?: {
    mrp: number;
    price: number;
    discount?: number;
  };
}

export interface Brand {
  _id: string;
  name: string;
  description?: string;
  logo?: {
    public_id: string;
    url: string;
  } | null;
  createdByType?: 'Merchant' | 'Admin';
  createdById?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface Product {
  _id: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string | { _id: string; name: string };
  subCategory?: string;
  brand?: string | Brand;
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  variants: ProductVariant[];
  isActive: boolean;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  _id: string;
  productId?: string;
  variantId?: string;
  name: string;
  image?: string;
  price: number;
  size?: string;
  sizeCode?: string;
  quantity: number;
  isReturned?: boolean;
  returnReason?: string;
  status?: 'available' | 'out_of_stock' | 'cancelled';
  outOfStockReason?: string;
}

export interface Order {
  _id: string;
  orderIdString?: string;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  orderStatus?:
    | 'placed'
    | 'accepted'
    | 'packed'
    | 'in_transit'
    | 'try_phase'
    | 'selection_made'
    | 'return_in_progress'
    | 'completed'
    | 'cancelled'
    | 'rejected';
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  deliveryRiderDetails?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  otp?: string | null;
  acceptedAt?: number | null;
  cancellationRequest?: string;
  reason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  hasUnavailableItems?: boolean;
  unavailableItemsCount?: number;
}

export interface PackingPhoto {
  _id: string;
  url: string;
  itemId: string;
  uploadedAt: string;
}

export interface CourierOrderItem {
  productId: string;
  variantId: string;
  name: string;
  quantity: number;
  price: number;
  size: string;
  sizeCode?: string;
  image?: string;
}

export interface CourierOrder {
  _id: string;
  userId: string;
  items: CourierOrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  deliveryLocation: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  orderStatus: 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  returnRequest?: {
    status: 'none' | 'pending' | 'picked' | 'shipped' | 'received' | 'rejected';
    reason?: string;
  };
}

export interface OfferFormData {
  title: string;
  description?: string;
  badgeText?: string;
  type: 'VENDOR_DISCOUNT' | 'VENDOR_MIN_ORDER' | 'VENDOR_CLEARANCE';
  discountType: 'flat' | 'percentage';
  discountValue: number;
  maxDiscount?: number;
  conditions?: {
    minCartValue?: number;
    minOrderValue?: number;
    categoryIds?: string[];
    genders?: string[];
  };
  startDate: string;
  endDate: string;
  couponCode?: string;
  requiresCoupon?: boolean;
  isPublic?: boolean;
  maxUsageTotal?: number;
  maxUsagePerUser?: number;
  freeDelivery?: boolean;
  priority?: number;
  benefitType?: 'PRODUCT' | 'CART' | 'DELIVERY';
  stackable?: boolean;
  isExclusive?: boolean;
  applicableTo?: 'try_and_buy' | 'courier' | 'both';
}

export interface Offer extends OfferFormData {
  _id: string;
  scope?: string;
  merchantId?: string;
  isActive: boolean;
  currentUsage?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ZipCoverOrder {
  _id: string;
  merchantId: string;
  quantities: {
    small: number;
    medium: number;
    large: number;
  };
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignedStockItem {
  _id: string;
  productId: {
    _id: string;
    title: string;
    images?: string[];
  };
  variantId: string;
  colorName?: string;
  size: string;
  sizeCode?: string;
  quantity: number;
  warehouseId?: {
    _id: string;
    name: string;
  };
}
