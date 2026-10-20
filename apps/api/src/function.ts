import { attachDatabasePool } from "@neon/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { OrderBook, type OrderInput, type Side, type Trade } from "./engine/orderBook.js";
import * as schema from "./db/schema.js";

const symbols = ["BTC", "ETH", "DOGE", "XRP", "ADA", "TRX", "AVAX"] as const;
type SymbolType = (typeof symbols)[number];

const anchors: Record<SymbolType, number> = {
  BTC: 7500000,
  ETH: 2500000,
  DOGE: 2000,
  XRP: 22000,
  ADA: 6000,
  TRX: 2800,
  AVAX: 250000
};

export function normalizeSymbol(value: unknown): SymbolType | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase().trim();
  if (upper === "ETHUSD" || upper === "ETH-USD" || upper === "ETH_USD") return "ETH";
  if (upper === "BTCUSD" || upper === "BTC-USD" || upper === "BTC_USD") return "BTC";
  if (symbols.includes(upper as SymbolType)) return upper as SymbolType;
  return undefined;
}

function isSymbol(value: string): value is SymbolType {
  return normalizeSymbol(value) !== undefined;
}

function companyName(symbol: string) {
  return ({
    BTC: "Bitcoin",
    ETH: "Ethereum (ETHUSD)",
    DOGE: "Dogecoin",
    XRP: "XRP",
    ADA: "Cardano",
    TRX: "TRON",
    AVAX: "Avalanche"
  } as Record<string, string>)[symbol] ?? symbol;
}
const makerId = "paper-market-maker";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 20_000 });
attachDatabasePool(pool);
const database = drizzle(pool, { schema });
void database; // Drizzle schema is the typed source of truth; pg transactions below use advisory locks.

type Principal = { id: string; email: string; name: string };
type Vars = { principal: Principal };
type ReplayPayload = OrderInput & { orderId: number };
const orderRequest = z.object({
  symbol: z.string().transform(s => {
    const norm = normalizeSymbol(s);
    return norm ?? s;
  }).pipe(z.enum(symbols)),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET"]),
  quantity: z.number().int().positive().max(1_000_000),
  pricePaise: z.number().int().positive().max(1_000_000_000).optional()
}).superRefine((value, ctx) => {
  if (value.type === "LIMIT" && !value.pricePaise) ctx.addIssue({ code: "custom", path: ["pricePaise"], message: "Limit orders need a price." });
});
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",").map(value => value.trim());
const app = new Hono<{ Variables: Vars }>();
const jwks = () => createRemoteJWKSet(new URL(requiredEnv("NEON_AUTH_JWKS_URL")));
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
const issuer = () => new URL(requiredEnv("NEON_AUTH_BASE_URL")).origin;
const requiredEnv = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is not configured`); return value; };
const lockKey = 1_667_597_169;

app.use("*", cors({ origin: origin => origin && allowedOrigins.includes(origin) ? origin : "", allowMethods: ["GET", "POST", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"], maxAge: 600 }));
app.get("/health", async c => {
  try { const result = await pool.query("select current_database() as database, now() as checked_at"); return c.json({ status: "ok", database: result.rows[0].database, checkedAt: result.rows[0].checked_at, symbols }); }
  catch { return c.json({ status: "error", service: "PriceTime API", database: "unavailable" }, 503); }
});
app.use("/api/*", async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return c.json({ error: "Sign in to continue." }, 401);
  try {
    cachedJwks ??= jwks();
    const { payload } = await jwtVerify(authorization.slice(7), cachedJwks, { issuer: issuer() });
    if (!payload.sub) return c.json({ error: "Invalid session." }, 401);
    c.set("principal", { id: payload.sub, email: typeof payload.email === "string" ? payload.email : "", name: typeof payload.name === "string" ? payload.name : "Paper trader" });
  } catch (error) { console.error("JWT verification failed:", error); return c.json({ error: "Your session expired. Sign in again." }, 401); }
  await next();
});
app.get("/api/symbols", c => c.json(symbols.map(symbol => ({
  symbol,
  name: companyName(symbol),
  display: symbol === "ETH" ? "ETH / ETHUSD" : symbol,
  alias: symbol === "ETH" ? "ETHUSD" : symbol === "BTC" ? "BTCUSD" : undefined,
  exchange: "BINANCE",
  currency: "INR",
  referencePricePaise: anchors[symbol]
}))));
app.get("/api/account", async c => {
  await bootstrap();
  const client = await pool.connect();
  try {
    const user = c.get("principal");
    await ensureAccount(client, user);
    const walletRes = await client.query(
      `select available_cash_paise, reserved_cash_paise 
       from mf_wallets 
       where user_id=$1 or user_id in (select id from mf_users where email=$2)
       limit 1`,
      [user.id, user.email || ""]
    );
    const wallet = walletRes.rows[0] ?? { available_cash_paise: 10_000_000, reserved_cash_paise: 0 };
    const positions = (await client.query(
      `select p.symbol, p.available_shares, p.reserved_shares,
              coalesce(sum(l.quantity),0)::int as owned_shares,
              coalesce(sum(l.quantity*l.unit_cost_paise),0)::bigint as cost_basis_paise 
       from mf_positions p 
       left join mf_portfolio_lots l on l.user_id=p.user_id and l.symbol=p.symbol 
       where p.user_id=$1 or p.user_id in (select id from mf_users where email=$2)
       group by p.symbol, p.available_shares, p.reserved_shares 
       order by p.symbol`,
      [user.id, user.email || ""]
    )).rows;
    const orders = (await client.query(
      `select symbol, order_id, side, type, limit_price_paise, original_quantity, remaining_quantity, status, created_at 
       from mf_orders 
       where user_id=$1 or user_id in (select id from mf_users where email=$2)
       order by created_at desc limit 100`,
      [user.id, user.email || ""]
    )).rows;
    const realized = (await client.query(
      `select coalesce(sum(realized_paise),0)::bigint as realized_paise 
       from mf_realized_pnl 
       where user_id=$1 or user_id in (select id from mf_users where email=$2)`,
      [user.id, user.email || ""]
    )).rows[0] ?? { realized_paise: 0 };
    const trades = (await client.query(
      `select symbol, trade_id, price_paise, quantity, buyer_id, seller_id, created_at 
       from mf_trades 
       where buyer_id=$1 or seller_id=$1 
          or buyer_id in (select id from mf_users where email=$2) 
          or seller_id in (select id from mf_users where email=$2)
       order by created_at desc limit 100`,
      [user.id, user.email || ""]
    )).rows;
    const last = await client.query("select distinct on (symbol) symbol,price_paise from mf_trades order by symbol,created_at desc,trade_id desc");
    const latest = new Map(last.rows.map(row => [row.symbol, Number(row.price_paise)]));
    const positionBySymbol = new Map(positions.map(p => [p.symbol, p]));
    const portfolio = symbols.map(sym => {
      const row = positionBySymbol.get(sym);
      const market = latest.get(sym) ?? anchors[sym];
      const units = Number(row?.owned_shares ?? 0);
      const basis = Number(row?.cost_basis_paise ?? 0);
      return {
        symbol: sym,
        availableUnits: row?.available_shares ?? 0,
        reservedUnits: row?.reserved_shares ?? 0,
        units,
        averageCostPaise: units ? Math.round(basis / units) : 0,
        lastPricePaise: market,
        unrealizedPaise: market * units - basis
      };
    });
    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      wallet: { availableCashPaise: Number(wallet.available_cash_paise), reservedCashPaise: Number(wallet.reserved_cash_paise) },
      positions: portfolio,
      realizedPaise: Number(realized.realized_paise),
      orders,
      trades
    });
  } finally { client.release(); }
});
app.get("/api/books", async c => { await bootstrap(); const snapshots = await Promise.all(symbols.map(symbol => readBook(symbol))); return c.json(snapshots); });
app.get("/api/books/:symbol", async c => {
  const norm = normalizeSymbol(c.req.param("symbol"));
  if (!norm) return c.json({ error: "Unknown symbol." }, 404);
  await bootstrap();
  return c.json(await readBook(norm));
});
app.get("/api/trades", async c => {
  const user = c.get("principal");
  const rawSymbol = c.req.query("symbol");
  const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : undefined;
  const values: unknown[] = [user.id, user.email || ""];
  const symbolClause = symbol ? " and symbol=$3" : "";
  if (symbolClause) values.push(symbol);
  const result = await pool.query(
    `select symbol,trade_id,price_paise,quantity,buyer_id,seller_id,created_at from mf_trades where (buyer_id=$1 or seller_id=$1 or buyer_id in (select id from mf_users where email=$2) or seller_id in (select id from mf_users where email=$2))${symbolClause} order by created_at desc limit 1000`,
    values
  );
  return c.json(result.rows);
});
app.get("/api/orders", async c => {
  const user = c.get("principal");
  const result = await pool.query("select symbol,order_id,side,type,limit_price_paise,original_quantity,remaining_quantity,status,created_at from mf_orders where user_id=$1 or user_id in (select id from mf_users where email=$2) order by created_at desc limit 200", [user.id, user.email || ""]);
  return c.json(result.rows);
});

app.post("/api/orders", async c => {
  const parsed = orderRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid order." }, 400);
  await bootstrap();
  const input: OrderInput = { ...parsed.data, traderId: c.get("principal").id };
  const client = await pool.connect();
  try {
    await client.query("begin"); await client.query("select pg_advisory_xact_lock($1)", [lockKey]);
    const user = c.get("principal"); await ensureAccount(client, user);
    const book = await loadBook(client, input.symbol);
    const sameUserCross = book.allOrders().some(resting => resting.level && resting.traderId === user.id && resting.side !== input.side && (input.type === "MARKET" || (input.side === "BUY" ? input.pricePaise! >= resting.level.pricePaise : input.pricePaise! <= resting.level.pricePaise)));
    if (sameUserCross) { await client.query("rollback"); return c.json({ error: "Your order would match against your own open order. Cancel or amend it first." }, 409); }
    let reserveCash = input.side === "BUY" && input.type === "LIMIT" ? input.pricePaise! * input.quantity : 0;
    if (input.side === "BUY" && input.type === "MARKET") reserveCash = book.estimateMarketBuyCost(input.quantity).costPaise;
    const wallet = (await client.query("select available_cash_paise from mf_wallets where user_id=$1 for update", [user.id])).rows[0];
    if (input.side === "BUY" && reserveCash > Number(wallet.available_cash_paise)) { await client.query("rollback"); return c.json({ error: "Not enough available demo cash for this order." }, 422); }
    let reserveShares = input.side === "SELL" ? input.quantity : 0;
    if (input.side === "SELL") {
      const position = (await client.query("select available_shares from mf_positions where user_id=$1 and symbol=$2 for update", [user.id, input.symbol])).rows[0];
      if (!position || position.available_shares < input.quantity) { await client.query("rollback"); return c.json({ error: "Not enough available demo units." }, 422); }
    }
    const orderId = book.peekNextOrderId();
    if (reserveCash) await client.query("update mf_wallets set available_cash_paise=available_cash_paise-$2,reserved_cash_paise=reserved_cash_paise+$2,updated_at=now() where user_id=$1", [user.id, reserveCash]);
    if (reserveShares) await client.query("update mf_positions set available_shares=available_shares-$3,reserved_shares=reserved_shares+$3 where user_id=$1 and symbol=$2", [user.id, input.symbol, reserveShares]);
    await client.query("insert into mf_orders(symbol,order_id,user_id,side,type,limit_price_paise,original_quantity,remaining_quantity,status,reserved_cash_paise,reserved_shares) values($1,$2,$3,$4,$5,$6,$7,$7,'OPEN',$8,$9)", [input.symbol, orderId, user.id, input.side, input.type, input.pricePaise ?? null, input.quantity, reserveCash, reserveShares]);
    await client.query("insert into mf_order_events(symbol,kind,order_id,payload) values($1,'submit',$2,$3::jsonb)", [input.symbol, orderId, JSON.stringify({ ...input, orderId })]);
    const result = book.submit(input);
    const orderRows = await client.query("select * from mf_orders where symbol=$1 and order_id=any($2::int[]) for update", [input.symbol, [...new Set(result.changedOrders.map(order => order.id))]]);
    const orderById = new Map<number, any>(orderRows.rows.map(row => [row.order_id, row]));
    for (const trade of result.trades) await settleTrade(client, trade, orderById);
    if (input.type === "MARKET" && result.order.remaining > 0) {
      await releaseRemainder(client, orderById.get(orderId));
      result.order.status = result.trades.length ? "PARTIALLY_FILLED" : "REJECTED";
      result.order.remaining = 0;
    }
    for (const changed of result.changedOrders) {
      const row = orderById.get(changed.id)!;
      await client.query("update mf_orders set remaining_quantity=$3,status=$4,reserved_cash_paise=$5,reserved_shares=$6 where symbol=$1 and order_id=$2", [input.symbol, changed.id, changed.remaining, changed.status, Number(row.reserved_cash_paise), row.reserved_shares]);
    }
    for (const trade of result.trades) await client.query("insert into mf_trades(symbol,trade_id,price_paise,quantity,buy_order_id,sell_order_id,buyer_id,seller_id) values($1,$2,$3,$4,$5,$6,$7,$8)", [trade.symbol, trade.id, trade.pricePaise, trade.quantity, trade.buyOrderId, trade.sellOrderId, trade.buyerId, trade.sellerId]);
    await client.query("commit");
    const snapshot = await readBook(input.symbol);
    return c.json({ order: { symbol: input.symbol, id: orderId, side: input.side, type: input.type, quantity: input.quantity, remaining: result.order.remaining, status: result.order.status, pricePaise: input.pricePaise }, trades: result.trades, snapshot }, 201);
  } catch (error) { await client.query("rollback").catch(() => undefined); console.error("order transaction failed", error); return c.json({ error: "Order could not be completed. No account changes were saved." }, 500); }
  finally { client.release(); }
});

app.delete("/api/orders/:symbol/:id", async c => {
  const rawSymbol = c.req.param("symbol"), orderId = Number(c.req.param("id"));
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol || !Number.isInteger(orderId)) return c.json({ error: "Invalid order." }, 400);
  await bootstrap();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [lockKey]);
    const user = c.get("principal");
    await ensureAccount(client, user);

    const row = (await client.query(
      `select * from mf_orders 
       where symbol=$1 and order_id=$2 
       and (user_id=$3 or user_id in (select id from mf_users where email=$4))
       for update`,
      [symbol, orderId, user.id, user.email || ""]
    )).rows[0];

    if (!row) {
      await client.query("rollback");
      return c.json({ error: "Open order not found." }, 404);
    }
    if (!["OPEN", "PARTIALLY_FILLED"].includes(row.status)) {
      await client.query("rollback");
      return c.json({ error: `Order is already ${row.status.toLowerCase()}.` }, 400);
    }

    const book = await loadBook(client, symbol);
    book.cancel(orderId);

    const cash = Number(row.reserved_cash_paise), shares = Number(row.reserved_shares);
    if (cash) await client.query("update mf_wallets set available_cash_paise=available_cash_paise+$2,reserved_cash_paise=reserved_cash_paise-$2,updated_at=now() where user_id=$1", [row.user_id, cash]);
    if (shares) await client.query("update mf_positions set available_shares=available_shares+$3,reserved_shares=reserved_shares-$3 where user_id=$1 and symbol=$2", [row.user_id, symbol, shares]);
    await client.query("update mf_orders set status='CANCELLED',remaining_quantity=0,reserved_cash_paise=0,reserved_shares=0,cancelled_at=now() where symbol=$1 and order_id=$2", [symbol, orderId]);
    await client.query("insert into mf_order_events(symbol,kind,order_id,payload) values($1,'cancel',$2,'{}'::jsonb)", [symbol, orderId]);
    await client.query("commit");
    return c.json({ cancelled: true, snapshot: await readBook(symbol) });
  } catch (error: any) {
    await client.query("rollback").catch(() => undefined);
    console.error("cancel failed", error);
    return c.json({ error: error?.message ?? "Order cancellation failed." }, 500);
  } finally {
    client.release();
  }
});

app.post("/api/replay", async c => {
  const rawSymbol = c.req.query("symbol") ?? "BTC";
  const symbolValue = normalizeSymbol(rawSymbol);
  if (!symbolValue) return c.json({ error: "Unknown symbol." }, 400);
  const csv = await c.req.text(); if (csv.length > 2_000_000) return c.json({ error: "CSV must be smaller than 2 MB." }, 413);
  const parsed = parseReplay(csv, symbolValue); if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const startedTree = performance.now(); const tree = new OrderBook(symbolValue); for (const order of parsed.orders) tree.submit(order); const treeMs = Math.max(0.01, performance.now() - startedTree);
  const treeTrades = tree.trades();
  const startedArray = performance.now(); const arrayTrades = arrayReplay(parsed.orders); const arrayMs = Math.max(0.01, performance.now() - startedArray);
  const userId = c.get("principal").id;
  await pool.query("insert into mf_replay_runs(user_id,order_count,bst_duration_ms,array_duration_ms,trade_count) values($1,$2,$3,$4,$5)", [userId, parsed.orders.length, Math.ceil(treeMs), Math.ceil(arrayMs), treeTrades.length]);
  const sequencesMatch = treeTrades.length === arrayTrades.length && treeTrades.every((t, i) => t.pricePaise === arrayTrades[i].pricePaise && t.quantity === arrayTrades[i].quantity);
  return c.json({
    symbol: symbolValue,
    orders: parsed.orders.length,
    tradeCount: treeTrades.length,
    treeDll: { durationMs: Number(treeMs.toFixed(2)), ordersPerSecond: Math.round(parsed.orders.length / (treeMs / 1000)) },
    plainArray: { durationMs: Number(arrayMs.toFixed(2)), ordersPerSecond: Math.round(parsed.orders.length / (arrayMs / 1000)) },
    equivalentTrades: sequencesMatch,
    equivalenceDetails: {
      tradeCountMatch: treeTrades.length === arrayTrades.length,
      sequenceMatch: sequencesMatch,
      totalExecutedVolume: treeTrades.reduce((acc, t) => acc + t.quantity, 0)
    }
  });
});

app.onError((error, c) => {
  console.error("API error", error);
  return c.json({ error: error?.message || "The API could not complete that request." }, 500);
});

let bootPromise: Promise<void> | undefined;
async function bootstrap() { bootPromise ??= initializeDemoBooks().catch(error => { bootPromise = undefined; throw error; }); return bootPromise; }
async function initializeDemoBooks() {
  const client = await pool.connect();
  try {
    await client.query("begin"); await client.query("select pg_advisory_xact_lock($1)", [lockKey]);
    const maker: Principal = { id: makerId, email: "market-maker@pricetime.invalid", name: "Demo liquidity provider" }; await ensureAccount(client, maker, true);
    for (const symbol of symbols) {
      const count = Number((await client.query("select count(*)::int as count from mf_order_events where symbol=$1", [symbol])).rows[0].count);
      if (count) continue;
      const book = new OrderBook(symbol);
      for (const [side, pricePaise] of [["BUY", anchors[symbol] - 100], ["SELL", anchors[symbol] + 100]] as const) {
        const orderId = book.peekNextOrderId(); const quantity = 50; const input: OrderInput = { traderId: makerId, symbol, side, type: "LIMIT", quantity, pricePaise };
        const reserveCash = side === "BUY" ? pricePaise * quantity : 0; const reserveShares = side === "SELL" ? quantity : 0;
        if (reserveCash) await client.query("update mf_wallets set available_cash_paise=available_cash_paise-$2,reserved_cash_paise=reserved_cash_paise+$2 where user_id=$1", [makerId, reserveCash]);
        if (reserveShares) await client.query("update mf_positions set available_shares=available_shares-$3,reserved_shares=reserved_shares+$3 where user_id=$1 and symbol=$2", [makerId, symbol, reserveShares]);
        await client.query("insert into mf_orders(symbol,order_id,user_id,side,type,limit_price_paise,original_quantity,remaining_quantity,status,reserved_cash_paise,reserved_shares) values($1,$2,$3,$4,'LIMIT',$5,$6,$6,'OPEN',$7,$8)", [symbol, orderId, makerId, side, pricePaise, quantity, reserveCash, reserveShares]);
        await client.query("insert into mf_order_events(symbol,kind,order_id,payload) values($1,'submit',$2,$3::jsonb)", [symbol, orderId, JSON.stringify({ ...input, orderId })]); book.submit(input);
      }
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
}
async function ensureAccount(client: PoolClient, user: Principal, maker = false) {
  const email = user.email || `${user.id}@auth.pricetime`;
  const name = user.name || "Paper trader";
  const existingById = await client.query("select id from mf_users where id=$1", [user.id]);
  if (existingById.rowCount) {
    if (user.email) {
      const emailTaken = await client.query("select id from mf_users where email=$1 and id != $2", [user.email, user.id]);
      if (!emailTaken.rowCount) {
        await client.query("update mf_users set email=$2, display_name=$3 where id=$1", [user.id, user.email, name]);
      } else {
        await client.query("update mf_users set display_name=$2 where id=$1", [user.id, name]);
      }
    }
  } else {
    const existingByEmail = user.email ? await client.query("select id from mf_users where email=$1", [user.email]) : { rowCount: 0, rows: [] };
    if (existingByEmail.rowCount) {
      const oldId = existingByEmail.rows[0].id;
      await client.query("update mf_users set id=$1, display_name=$2 where id=$3", [user.id, name, oldId]);
      await client.query("update mf_order_events set payload = jsonb_set(payload, '{traderId}', to_jsonb($1::text)) where payload->>'traderId' = $2", [user.id, oldId]);
    } else {
      await client.query("insert into mf_users(id,email,display_name) values($1,$2,$3) on conflict(id) do update set display_name=excluded.display_name", [user.id, email, name]);
    }
  }
  await client.query("insert into mf_wallets(user_id,available_cash_paise,reserved_cash_paise) values($1,$2,0) on conflict(user_id) do nothing", [user.id, maker ? 1_000_000_000_000 : 10_000_000]);
  for (const symbol of symbols) {
    const quantity = maker ? 1_000_000 : 10;
    const inserted = await client.query("insert into mf_positions(user_id,symbol,available_shares,reserved_shares) values($1,$2,$3,0) on conflict(user_id,symbol) do nothing returning symbol", [user.id, symbol, quantity]);
    if (inserted.rowCount) await client.query("insert into mf_portfolio_lots(user_id,symbol,quantity,unit_cost_paise) values($1,$2,$3,$4)", [user.id, symbol, quantity, anchors[symbol]]);
  }
}
async function loadBook(client: PoolClient, symbol: string) {
  const book = new OrderBook(symbol);
  const events = await client.query("select kind,order_id,payload from mf_order_events where symbol=$1 order by sequence", [symbol]);
  for (const event of events.rows) {
    if (event.kind === "submit") book.submit(event.payload as OrderInput);
    else if (event.kind === "cancel") book.cancel(event.order_id);
  }
  return book;
}
async function readBook(symbol: string) {
  const client = await pool.connect();
  try {
    const book = await loadBook(client, symbol); const snapshot = book.snapshot();
    const recent = await client.query("select symbol,trade_id as id,price_paise,quantity,buy_order_id,sell_order_id,buyer_id,seller_id,created_at from mf_trades where symbol=$1 order by trade_id desc limit 20", [symbol]);
    return { ...snapshot, recentTrades: recent.rows.map(row => ({ id: row.id, symbol: row.symbol, pricePaise: Number(row.price_paise), quantity: row.quantity, buyOrderId: row.buy_order_id, sellOrderId: row.sell_order_id, buyerId: row.buyer_id, sellerId: row.seller_id, createdAt: row.created_at })) };
  } finally { client.release(); }
}
async function settleTrade(client: PoolClient, trade: Trade, orderById: Map<number, any>) {
  const buy = orderById.get(trade.buyOrderId), sell = orderById.get(trade.sellOrderId); if (!buy || !sell) throw new Error("Trade references a missing order.");
  const cost = trade.pricePaise * trade.quantity;
  const cashReserved = buy.type === "LIMIT" ? Number(buy.limit_price_paise) * trade.quantity : cost;
  if (Number(buy.reserved_cash_paise) < cashReserved || Number(sell.reserved_shares) < trade.quantity) throw new Error("Order reservation is inconsistent.");
  buy.reserved_cash_paise = Number(buy.reserved_cash_paise) - cashReserved;
  sell.reserved_shares -= trade.quantity;
  await client.query("update mf_wallets set reserved_cash_paise=reserved_cash_paise-$2,available_cash_paise=available_cash_paise+$3-$4,updated_at=now() where user_id=$1", [trade.buyerId, cashReserved, cashReserved, cost]);
  await client.query("update mf_wallets set available_cash_paise=available_cash_paise+$2,updated_at=now() where user_id=$1", [trade.sellerId, cost]);
  await client.query("insert into mf_positions(user_id,symbol,available_shares,reserved_shares) values($1,$2,$3,0) on conflict(user_id,symbol) do update set available_shares=mf_positions.available_shares+excluded.available_shares", [trade.buyerId, trade.symbol, trade.quantity]);
  await client.query("update mf_positions set reserved_shares=reserved_shares-$3 where user_id=$1 and symbol=$2", [trade.sellerId, trade.symbol, trade.quantity]);
  await client.query("insert into mf_portfolio_lots(user_id,symbol,quantity,unit_cost_paise) values($1,$2,$3,$4)", [trade.buyerId, trade.symbol, trade.quantity, trade.pricePaise]);
  const lots = await client.query("select id,quantity,unit_cost_paise from mf_portfolio_lots where user_id=$1 and symbol=$2 order by opened_at,id for update", [trade.sellerId, trade.symbol]);
  let toSell = trade.quantity, basis = 0;
  for (const lot of lots.rows) { if (!toSell) break; const consumed = Math.min(toSell, lot.quantity); basis += consumed * Number(lot.unit_cost_paise); toSell -= consumed; if (consumed === lot.quantity) await client.query("delete from mf_portfolio_lots where id=$1", [lot.id]); else await client.query("update mf_portfolio_lots set quantity=quantity-$2 where id=$1", [lot.id, consumed]); }
  if (toSell) throw new Error("Seller's FIFO lots do not cover the fill.");
  await client.query("insert into mf_realized_pnl(user_id,symbol,trade_id,quantity,cost_basis_paise,proceeds_paise,realized_paise) values($1,$2,$3,$4,$5,$6,$7)", [trade.sellerId, trade.symbol, trade.id, trade.quantity, basis, cost, cost - basis]);
}
async function releaseRemainder(client: PoolClient, order: any) {
  if (!order) return;
  const cash = Number(order.reserved_cash_paise), shares = Number(order.reserved_shares);
  if (cash) await client.query("update mf_wallets set available_cash_paise=available_cash_paise+$2,reserved_cash_paise=reserved_cash_paise-$2,updated_at=now() where user_id=$1", [order.user_id, cash]);
  if (shares) await client.query("update mf_positions set available_shares=available_shares+$3,reserved_shares=reserved_shares-$3 where user_id=$1 and symbol=$2", [order.user_id, order.symbol, shares]);
  order.reserved_cash_paise = 0; order.reserved_shares = 0;
}
function parseReplay(csv: string, symbol: string): { ok: true; orders: OrderInput[] } | { ok: false; error: string } {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean); if (lines.length && /side/i.test(lines[0]) && /quantity/i.test(lines[0])) lines.shift();
  if (!lines.length) return { ok: false, error: "CSV has no orders." };
  if (lines.length > 10_000) return { ok: false, error: "Replay accepts at most 10,000 orders." };
  const orders: OrderInput[] = [];
  for (let i = 0; i < lines.length; i++) {
    const fields = lines[i].split(",").map(part => part.trim());
    const hasTraderAndTime = fields.length >= 6;
    const [sideValue, typeValue, priceValue, quantityValue] = hasTraderAndTime ? [fields[2], fields[3], fields[4], fields[5]] : fields;
    const side = sideValue?.toUpperCase(), type = typeValue?.toUpperCase(); const quantity = Number(quantityValue);
    const rawPrice = Number(priceValue); const pricePaise = priceValue?.includes(".") ? Math.round(rawPrice * 100) : rawPrice;
    if (!["BUY", "SELL"].includes(side) || !["LIMIT", "MARKET"].includes(type) || !Number.isInteger(quantity) || quantity <= 0 || (type === "LIMIT" && (!Number.isInteger(pricePaise) || pricePaise <= 0))) return { ok: false, error: `Invalid CSV row ${i + 1}. Use side,type,pricePaise,quantity; limit prices can be paise integers.` };
    orders.push({ traderId: `replay-${i}`, symbol, side: side as Side, type: type as "LIMIT" | "MARKET", quantity, pricePaise: type === "LIMIT" ? pricePaise : undefined });
  }
  return { ok: true, orders };
}
export interface ReplayTrade {
  pricePaise: number;
  quantity: number;
}

export function arrayReplay(inputs: OrderInput[]): ReplayTrade[] {
  const book: { side: Side; price: number; quantity: number; sequence: number }[] = [];
  const trades: ReplayTrade[] = [];
  for (let sequence = 0; sequence < inputs.length; sequence++) {
    const order = inputs[sequence]; let remaining = order.quantity;
    while (remaining > 0) {
      let best = -1;
      for (let i = 0; i < book.length; i++) {
        const item = book[i]; const crosses = item.side !== order.side && (order.type === "MARKET" || (order.side === "BUY" ? order.pricePaise! >= item.price : order.pricePaise! <= item.price));
        if (crosses && (best < 0 || (order.side === "BUY" ? item.price < book[best].price : item.price > book[best].price) || (item.price === book[best].price && item.sequence < book[best].sequence))) best = i;
      }
      if (best < 0) break;
      const fill = Math.min(remaining, book[best].quantity);
      const executionPrice = book[best].price;
      remaining -= fill;
      book[best].quantity -= fill;
      trades.push({ pricePaise: executionPrice, quantity: fill });
      if (!book[best].quantity) book.splice(best, 1);
    }
    if (remaining > 0 && order.type === "LIMIT") book.push({ side: order.side, price: order.pricePaise!, quantity: remaining, sequence });
  }
  return trades;
}

export default { fetch: (request: Request) => app.fetch(request) };
