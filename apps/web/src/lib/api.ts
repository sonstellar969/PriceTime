import { authClient } from "./auth";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
export type Book = { symbol: string; bids: Level[]; asks: Level[]; bestBid?: number; bestAsk?: number; spreadPaise?: number; lastPricePaise?: number; movingAveragePaise?: number; recentTrades: Trade[] };
export type Level = { pricePaise: number; quantity: number; orderCount: number };
export type Trade = { id: number; pricePaise: number; quantity: number; buyerId: string; sellerId: string; createdAt: number };
async function request(path: string, options: RequestInit = {}) {
  const { data, error } = await authClient.getSession();
  const token = data?.session?.token;
  if (error || !token) throw new Error("Your session expired. Sign in again.");
  const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${body.error ?? "Request failed"}`);
  return body;
}
export const getBook = async (symbol: string) => request(`/api/books/${symbol}`) as Promise<Book>;
export const getAccount = async () => request("/api/account") as Promise<Account>;
export const getTrades = async () => request("/api/trades") as Promise<TradeRow[]>;
export const getOrders = async () => request("/api/orders") as Promise<OrderRow[]>;
export const sendOrder = async (body: { symbol: string; side: "BUY" | "SELL"; type: "LIMIT" | "MARKET"; quantity: number; pricePaise?: number }) => request("/api/orders", { method: "POST", body: JSON.stringify(body) });
export const cancelOrder = async (symbol: string, id: number) => request(`/api/orders/${symbol}/${id}`, { method: "DELETE" });
export const runReplay = async (symbol: string, csv: string) => request(`/api/replay?symbol=${symbol}`, { method: "POST", headers: { "Content-Type": "text/csv" }, body: csv });
export type Account = { user: { id: string; email: string; name: string }; wallet: { availableCashPaise: number; reservedCashPaise: number }; positions: { symbol: string; availableUnits: number; reservedUnits: number; units: number; averageCostPaise: number; lastPricePaise: number; unrealizedPaise: number }[]; realizedPaise: number; orders: OrderRow[]; trades: TradeRow[] };
export type OrderRow = { symbol: string; order_id: number; side: "BUY" | "SELL"; type: "LIMIT" | "MARKET"; limit_price_paise: number | string | null; original_quantity: number; remaining_quantity: number; status: string; created_at: string };
export type TradeRow = { symbol: string; trade_id: number; price_paise: number | string; quantity: number; buyer_id: string; seller_id: string; created_at: string };
export const money = (paise?: number) => paise === undefined ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
