import { bigint, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const appUsers = pgTable("mf_users", {
  id: text("id").primaryKey(), // Neon Auth subject
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("mf_users_email_idx").on(table.email)]);
export const wallets = pgTable("mf_wallets", {
  userId: text("user_id").primaryKey().references(() => appUsers.id),
  availableCashPaise: bigint("available_cash_paise", { mode: "number" }).notNull().default(0),
  reservedCashPaise: bigint("reserved_cash_paise", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const positions = pgTable("mf_positions", {
  userId: text("user_id").notNull().references(() => appUsers.id),
  symbol: text("symbol").notNull(),
  availableShares: integer("available_shares").notNull().default(0),
  reservedShares: integer("reserved_shares").notNull().default(0),
}, table => [primaryKey({ columns: [table.userId, table.symbol] })]);
export const portfolioLots = pgTable("mf_portfolio_lots", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  userId: text("user_id").notNull().references(() => appUsers.id),
  symbol: text("symbol").notNull(),
  quantity: integer("quantity").notNull(),
  unitCostPaise: bigint("unit_cost_paise", { mode: "number" }).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("mf_lots_user_symbol_fifo_idx").on(table.userId, table.symbol, table.openedAt, table.id)]);
export const orders = pgTable("mf_orders", {
  symbol: text("symbol").notNull(),
  orderId: integer("order_id").notNull(),
  userId: text("user_id").notNull().references(() => appUsers.id),
  side: text("side").notNull(),
  type: text("type").notNull(),
  limitPricePaise: bigint("limit_price_paise", { mode: "number" }),
  originalQuantity: integer("original_quantity").notNull(),
  remainingQuantity: integer("remaining_quantity").notNull(),
  status: text("status").notNull(),
  reservedCashPaise: bigint("reserved_cash_paise", { mode: "number" }).notNull().default(0),
  reservedShares: integer("reserved_shares").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
}, table => [primaryKey({ columns: [table.symbol, table.orderId] }), index("mf_orders_user_created_idx").on(table.userId, table.createdAt)]);
export const trades = pgTable("mf_trades", {
  symbol: text("symbol").notNull(),
  tradeId: integer("trade_id").notNull(),
  pricePaise: bigint("price_paise", { mode: "number" }).notNull(),
  quantity: integer("quantity").notNull(),
  buyOrderId: integer("buy_order_id").notNull(),
  sellOrderId: integer("sell_order_id").notNull(),
  buyerId: text("buyer_id").notNull().references(() => appUsers.id),
  sellerId: text("seller_id").notNull().references(() => appUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.symbol, table.tradeId] }), index("mf_trades_buyer_created_idx").on(table.buyerId, table.createdAt), index("mf_trades_seller_created_idx").on(table.sellerId, table.createdAt)]);
export const orderEvents = pgTable("mf_order_events", {
  sequence: bigint("sequence", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  symbol: text("symbol").notNull(),
  kind: text("kind").notNull(), // submit | cancel
  orderId: integer("order_id").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("mf_events_symbol_sequence_idx").on(table.symbol, table.sequence)]);
export const replayRuns = pgTable("mf_replay_runs", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  userId: text("user_id").notNull().references(() => appUsers.id),
  orderCount: integer("order_count").notNull(),
  bstDurationMs: integer("bst_duration_ms").notNull(),
  arrayDurationMs: integer("array_duration_ms").notNull(),
  tradeCount: integer("trade_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("mf_replay_user_created_idx").on(table.userId, table.createdAt)]);
export const realizedPnL = pgTable("mf_realized_pnl", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  userId: text("user_id").notNull().references(() => appUsers.id),
  symbol: text("symbol").notNull(),
  tradeId: integer("trade_id").notNull(),
  quantity: integer("quantity").notNull(),
  costBasisPaise: bigint("cost_basis_paise", { mode: "number" }).notNull(),
  proceedsPaise: bigint("proceeds_paise", { mode: "number" }).notNull(),
  realizedPaise: bigint("realized_paise", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
