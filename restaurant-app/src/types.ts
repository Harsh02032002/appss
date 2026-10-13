export type OrderItem = { item_id: string; name: string; price: number; qty: number; veg: boolean; image: string; notes?: string };

export type Rider = { id: string; name: string; phone: string; vehicle: string; status: "available" | "busy" };

export type Order = {
  id: string;
  restaurant: { id: string; name: string; image: string; address: string; lat?: number; lng?: number };
  items: OrderItem[];
  address: { label: string; line1: string; landmark?: string; city?: string; pincode?: string };
  amounts: { subtotal: number; delivery_fee: number; taxes: number; tip: number; discount?: number; total: number };
  coupon_code?: string;
  payment_method: "cod" | "razorpay";
  payment_status: string;
  status: string;
  customer?: { name: string; phone: string };
  rider?: (Omit<Rider, "status"> & { lat?: number; lng?: number }) | null;
  review?: { rating: number; comment: string; at: string } | null;
  cancel_reason?: string;
  timeline: { status: string; at: string }[];
  created_at: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  veg: boolean;
  category: string;
  image: string;
  bestseller?: boolean;
  available: boolean;
};

export type Partner = {
  id: string;
  name: string;
  email: string;
  restaurant: { id: string; name: string; image: string; address: string; rating: number; cuisines: string[]; is_open: boolean };
};

export type Dashboard = {
  today_orders: number;
  today_revenue: number;
  pending: number;
  active: number;
  delivered_total: number;
  avg_rating: number | null;
  review_count: number;
  restaurant: Partner["restaurant"];
};

export const STATUS_LABELS: Record<string, string> = {
  PAYMENT_PENDING: "Awaiting payment",
  PLACED: "New",
  CONFIRMED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function statusColor(status: string, colors: any): string {
  switch (status) {
    case "PLACED":
      return colors.brandPrimary;
    case "CONFIRMED":
      return colors.info;
    case "PREPARING":
    case "READY":
      return colors.warning;
    case "OUT_FOR_DELIVERY":
      return colors.brandSecondary;
    case "DELIVERED":
      return colors.success;
    case "CANCELLED":
      return colors.error;
    default:
      return colors.muted;
  }
}
