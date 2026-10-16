import { readStore } from "@/lib/store";
import type { Customer, Order } from "@/lib/types";

/** Commandes d'un compte client, sans les données internes. */
export async function ordersForCustomer(customer: Customer) {
  const data = await readStore();
  return data.orders.filter((order) => order.customerId === customer.id).map(stripInternal);
}

export async function orderForCustomer(customer: Customer, id: string) {
  const data = await readStore();
  const order = data.orders.find((item) => item.id === id && item.customerId === customer.id);
  return order ? stripInternal(order) : null;
}

function stripInternal(order: Order) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cancelToken, ...rest } = order;
  return rest;
}
