export type OrderItem = { item_id: string; name: string; price: number; qty: number; veg: boolean; image: string };

export type Order = {
  id: string;
  restaurant: { id: string; name: string; image: string; address: string; lat?: number; lng?: number };
  items: OrderItem[];
  address: { label: string; line1: string; landmark?: string; city?: string; pincode?: string; lat?: number; lng?: number };
  amounts: { subtotal: number; delivery_fee: number; taxes: number; tip: number; discount?: number; total: number };
  payment_method: "cod" | "razorpay";
  payment_status: string;
  status: string;
  customer?: { name: string; phone: string };
  rider?: { id: string; name: string; phone: string; vehicle: string; lat?: number; lng?: number } | null;
  timeline: { status: string; at: string }[];
  created_at: string;
  delivered_at?: string;
  earning?: number;
  distance_km?: number | null;
  payout_status?: string | null;
};

export type Rider = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  status: "available" | "busy";
  online: boolean;
  lat?: number | null;
  lng?: number | null;
};

export type Dashboard = {
  rider: Rider;
  today_deliveries: number;
  today_earnings: number;
  total_deliveries: number;
  total_earnings: number;
  pending_requests: number;
  active_order: Order | null;
};

export const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Accepted · being prepared",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  OUT_FOR_DELIVERY: "On the way to customer",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const inrFromPaise = (p: number) => `₹${Math.round(p / 100)}`;
