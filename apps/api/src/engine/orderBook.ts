export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";

export interface OrderInput { traderId: string; symbol: string; side: Side; type: OrderType; quantity: number; pricePaise?: number }
export interface Order extends OrderInput { id: number; createdAt: number; remaining: number; status: OrderStatus; prev?: Order; next?: Order; level?: PriceLevel }
export interface Trade { id: number; symbol: string; pricePaise: number; quantity: number; buyOrderId: number; sellOrderId: number; buyerId: string; sellerId: string; createdAt: number; next?: Trade }
export interface LevelView { pricePaise: number; quantity: number; orderCount: number }

/** A price node in the order-book BST. Its orders form a FIFO doubly linked queue. */
export class PriceLevel {
  left?: PriceLevel; right?: PriceLevel; parent?: PriceLevel;
  head?: Order; tail?: Order; quantity = 0; orderCount = 0;
  constructor(public pricePaise: number) {}
  enqueue(order: Order) { order.level = this; order.prev = this.tail; order.next = undefined; if (this.tail) this.tail.next = order; else this.head = order; this.tail = order; this.quantity += order.remaining; this.orderCount++; }
  unlink(order: Order) { if (order.prev) order.prev.next = order.next; else this.head = order.next; if (order.next) order.next.prev = order.prev; else this.tail = order.prev; this.quantity -= order.remaining; this.orderCount--; order.prev = undefined; order.next = undefined; order.level = undefined; }
}

class PriceTree {
  root?: PriceLevel;
  find(price: number) { let node = this.root; while (node && node.pricePaise !== price) node = price < node.pricePaise ? node.left : node.right; return node; }
  insert(price: number) { if (!this.root) return (this.root = new PriceLevel(price)); let node = this.root; for (;;) { if (node.pricePaise === price) return node; const child = price < node.pricePaise ? "left" : "right"; if (!node[child]) { const inserted = new PriceLevel(price); inserted.parent = node; node[child] = inserted; return inserted; } node = node[child]; } }
  minimum(node = this.root): PriceLevel | undefined { while (node?.left) node = node.left; return node; }
  maximum(node = this.root): PriceLevel | undefined { while (node?.right) node = node.right; return node; }
  private transplant(oldNode: PriceLevel, newNode?: PriceLevel) { if (!oldNode.parent) this.root = newNode; else if (oldNode === oldNode.parent.left) oldNode.parent.left = newNode; else oldNode.parent.right = newNode; if (newNode) newNode.parent = oldNode.parent; }
  delete(node: PriceLevel) { if (!node.left) this.transplant(node, node.right); else if (!node.right) this.transplant(node, node.left); else { const successor = this.minimum(node.right)!; if (successor.parent !== node) { this.transplant(successor, successor.right); successor.right = node.right; successor.right!.parent = successor; } this.transplant(node, successor); successor.left = node.left; successor.left!.parent = successor; } }
  levelsAscending(limit = 5) { const result: PriceLevel[] = []; const visit = (node?: PriceLevel) => { if (!node || result.length >= limit) return; visit(node.left); if (result.length < limit) result.push(node); visit(node.right); }; visit(this.root); return result; }
  levelsDescending(limit = 5) { const result: PriceLevel[] = []; const visit = (node?: PriceLevel) => { if (!node || result.length >= limit) return; visit(node.right); if (result.length < limit) result.push(node); visit(node.left); }; visit(this.root); return result; }
}

/** Matching engine. Persist completed changes outside this class; keep matching in memory. */
export class OrderBook {
  private buyTree = new PriceTree(); private sellTree = new PriceTree();
  private nextOrderId = 1; private nextTradeId = 1;
  private orders: Order[] = []; // sorted by monotonically increasing ID: binary search supports cancellation.
  private tradeHead?: Trade; private tradeTail?: Trade;
  private recentPrices = new Array<number>(20); private recentIndex = 0; private recentCount = 0;
  constructor(public readonly symbol: string) {}
  peekNextOrderId() { return this.nextOrderId; }
  estimateMarketBuyCost(quantity: number) {
    let remaining = quantity, total = 0;
    for (const level of this.sellTree.levelsAscending(Number.MAX_SAFE_INTEGER)) {
      const filled = Math.min(remaining, level.quantity); total += filled * level.pricePaise; remaining -= filled; if (!remaining) break;
    }
    return { costPaise: total, fillableQuantity: quantity - remaining };
  }
  allOrders() { return this.orders; }
  submit(input: OrderInput) {
    if (input.symbol !== this.symbol || input.quantity <= 0 || (input.type === "LIMIT" && !input.pricePaise)) throw new Error("Invalid order");
    const order: Order = { ...input, id: this.nextOrderId++, createdAt: Date.now(), remaining: input.quantity, status: "OPEN" };
    this.orders.push(order); const trades: Trade[] = [];
    const changedOrders = new Set<Order>([order]);
    while (order.remaining > 0) {
      const opposite = order.side === "BUY" ? this.sellTree.minimum() : this.buyTree.maximum();
      if (!opposite || (order.type === "LIMIT" && !this.crosses(order, opposite.pricePaise))) break;
      const resting = opposite.head!; const quantity = Math.min(order.remaining, resting.remaining); const pricePaise = opposite.pricePaise;
      changedOrders.add(resting);
      order.remaining -= quantity; resting.remaining -= quantity; opposite.quantity -= quantity;
      const trade: Trade = { id: this.nextTradeId++, symbol: this.symbol, pricePaise, quantity, buyOrderId: order.side === "BUY" ? order.id : resting.id, sellOrderId: order.side === "SELL" ? order.id : resting.id, buyerId: order.side === "BUY" ? order.traderId : resting.traderId, sellerId: order.side === "SELL" ? order.traderId : resting.traderId, createdAt: Date.now() };
      this.appendTrade(trade); trades.push(trade);
      if (resting.remaining === 0) { opposite.unlink(resting); resting.status = "FILLED"; }
      else resting.status = "PARTIALLY_FILLED";
      if (opposite.orderCount === 0) (order.side === "BUY" ? this.sellTree : this.buyTree).delete(opposite);
    }
    if (order.remaining === 0) order.status = "FILLED";
    else if (order.type === "MARKET") order.status = trades.length ? "PARTIALLY_FILLED" : "REJECTED";
    else { order.status = trades.length ? "PARTIALLY_FILLED" : "OPEN"; (order.side === "BUY" ? this.buyTree : this.sellTree).insert(order.pricePaise!).enqueue(order); }
    return { order, trades, changedOrders: [...changedOrders] };
  }
  cancel(id: number) { const order = this.findOrder(id); if (!order || !order.level) return false; const level = order.level; level.unlink(order); order.status = "CANCELLED"; if (!level.orderCount) (order.side === "BUY" ? this.buyTree : this.sellTree).delete(level); return true; }
  private findOrder(id: number) { let low = 0, high = this.orders.length - 1; while (low <= high) { const middle = Math.floor((low + high) / 2); const candidate = this.orders[middle]; if (candidate.id === id) return candidate; if (candidate.id < id) low = middle + 1; else high = middle - 1; } return undefined; }
  private crosses(order: Order, restingPrice: number) { return order.side === "BUY" ? order.pricePaise! >= restingPrice : order.pricePaise! <= restingPrice; }
  private appendTrade(trade: Trade) { if (this.tradeTail) this.tradeTail.next = trade; else this.tradeHead = trade; this.tradeTail = trade; this.recentPrices[this.recentIndex] = trade.pricePaise; this.recentIndex = (this.recentIndex + 1) % this.recentPrices.length; this.recentCount = Math.min(this.recentCount + 1, this.recentPrices.length); }
  snapshot() { const bestBid = this.buyTree.maximum()?.pricePaise; const bestAsk = this.sellTree.minimum()?.pricePaise; return { symbol: this.symbol, bids: this.buyTree.levelsDescending().map(this.view), asks: this.sellTree.levelsAscending().map(this.view), bestBid, bestAsk, spreadPaise: bestBid && bestAsk ? bestAsk - bestBid : undefined, lastPricePaise: this.tradeTail?.pricePaise, movingAveragePaise: this.movingAverage(), recentTrades: this.trades().slice(-20).reverse() }; }
  movingAverage() { if (!this.recentCount) return undefined; let total = 0; for (let i = 0; i < this.recentCount; i++) total += this.recentPrices[(this.recentIndex - 1 - i + this.recentPrices.length) % this.recentPrices.length]; return Math.round(total / this.recentCount); }
  private view = (level: PriceLevel): LevelView => ({ pricePaise: level.pricePaise, quantity: level.quantity, orderCount: level.orderCount });
  trades() { const output: Trade[] = []; for (let trade = this.tradeHead; trade; trade = trade.next) output.push(trade); return output; }
}
