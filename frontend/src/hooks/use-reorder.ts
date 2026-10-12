import { useRouter } from "expo-router";

import { showToast } from "@/src/components/ui";
import { useCart } from "@/src/context/cart";
import type { Order } from "@/app/(tabs)/orders";

export function useReorder() {
  const router = useRouter();
  const cart = useCart();
  return (order: Order) => {
    cart.replaceCart(
      order.items.map((i) => ({
        id: i.item_id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image: i.image,
        veg: i.veg,
        notes: i.notes,
      })),
      { id: order.restaurant.id, name: order.restaurant.name },
    );
    showToast(`${order.items.length} item${order.items.length > 1 ? "s" : ""} added to cart`, "success");
    router.push("/cart");
  };
}
