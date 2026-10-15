import type { Order, OrderItem, StoreData } from "@/lib/types";

export function takeStock(data: StoreData, items: OrderItem[]) {
  for (const line of items) {
    for (const version of [data.published, data.draft]) {
      const product = version.products.find((item) => item.id === line.productId);
      if (!product || product.stock < line.qty) {
        throw new Error(`${line.name} n'est plus disponible dans cette quantité.`);
      }
    }
  }
  for (const line of items) {
    for (const version of [data.published, data.draft]) {
      const product = version.products.find((item) => item.id === line.productId);
      if (product) product.stock -= line.qty;
    }
  }
}

export function restoreStock(data: StoreData, order: Order) {
  if (!order.stockHeld) return;
  for (const line of order.items) {
    for (const version of [data.published, data.draft]) {
      const product = version.products.find((item) => item.id === line.productId);
      if (product) product.stock += line.qty;
    }
  }
  order.stockHeld = false;
}
