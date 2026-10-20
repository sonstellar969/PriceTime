import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const rootEnvPath = path.resolve(process.cwd(), "../../.env.local");
const localEnvPath = path.resolve(process.cwd(), ".env.local");
const envFile = fs.existsSync(localEnvPath) ? localEnvPath : rootEnvPath;
const env = dotenv.parse(fs.readFileSync(envFile, "utf8"));
const AUTH_BASE = env.NEON_AUTH_BASE_URL;
const API_BASE = "http://localhost:3001";

async function runE2ETests() {
  console.log("=================================================");
  console.log("       PRICETIME END-TO-END FEATURE TEST         ");
  console.log("=================================================");

  // 1. Health check
  console.log("\n[1/9] Testing API Health Check...");
  const healthRes = await fetch(`${API_BASE}/health`);
  assert.equal(healthRes.status, 200, "Health check should return 200");
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "ok");
  assert.equal(healthData.database, "neondb");
  assert.deepEqual(healthData.symbols, ["BTC", "ETH", "DOGE", "XRP", "ADA", "TRX", "AVAX"]);
  console.log("  ✔ /health returned 200 OK with connected DB and 7 crypto symbols.");

  // 2. Auth: Register test user and acquire JWT
  console.log("\n[2/9] Registering isolated test trader & acquiring JWT...");
  const testEmail = `e2e-trader-${Date.now()}@pricetime.test`;
  const signUpRes = await fetch(`${AUTH_BASE}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: testEmail, password: "SecureTraderPassword123!", name: "E2E Automated Trader" }),
  });
  assert.equal(signUpRes.status, 200, `Sign-up failed with status ${signUpRes.status}`);
  const cookie = signUpRes.headers.get("set-cookie");
  assert.ok(cookie, "Sign-up must issue session cookie");

  const tokenRes = await fetch(`${AUTH_BASE}/token`, {
    headers: { Cookie: cookie, Origin: "http://localhost:5173" },
  });
  assert.equal(tokenRes.status, 200, `Token fetch failed with status ${tokenRes.status}`);
  const { token: jwt } = await tokenRes.json();
  assert.ok(jwt, "Must receive signed JWT");
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` };
  console.log("  ✔ Neon Auth user registered and EdDSA JWT issued.");

  // 3. Symbols
  console.log("\n[3/9] Testing /api/symbols...");
  const symbolsRes = await fetch(`${API_BASE}/api/symbols`, { headers: authHeaders });
  assert.equal(symbolsRes.status, 200);
  const symbolsData = await symbolsRes.json();
  assert.equal(symbolsData.length, 7);
  console.log("  ✔ /api/symbols returned metadata for BTC, ETH, DOGE, XRP, ADA, TRX, AVAX.");

  // 4. Account Bootstrap & Portfolio
  console.log("\n[4/9] Testing /api/account initial state...");
  const accountRes = await fetch(`${API_BASE}/api/account`, { headers: authHeaders });
  assert.equal(accountRes.status, 200);
  const account = await accountRes.json();
  assert.equal(account.user.email, testEmail);
  assert.equal(account.wallet.availableCashPaise, 50_000_000, "Initial demo cash should be $500,000.00 (50,000,000 cents)");
  assert.equal(account.wallet.reservedCashPaise, 0);
  assert.equal(account.positions.length, 7);
  for (const pos of account.positions) {
    assert.equal(pos.availableUnits, 0, `${pos.symbol} should start with 0 units`);
    assert.equal(pos.reservedUnits, 0);
    assert.equal(pos.units, 0);
  }
  assert.equal(account.realizedPaise, 0, "Initial realized P/L should be 0");
  console.log("  ✔ Account bootstrap verified: $500,000 cash, 0 units held in all 7 assets, 0 realized P&L.");

  // 5. Order Book Snapshots
  console.log("\n[5/9] Testing /api/books and /api/books/DOGE, /api/books/BTC, /api/books/ETH...");
  const booksRes = await fetch(`${API_BASE}/api/books`, { headers: authHeaders });
  assert.equal(booksRes.status, 200);
  const books = await booksRes.json();
  assert.equal(books.length, 7);

  const dogeRes = await fetch(`${API_BASE}/api/books/DOGE`, { headers: authHeaders });
  assert.equal(dogeRes.status, 200);
  const dogeBook = await dogeRes.json();
  assert.equal(dogeBook.symbol, "DOGE");
  assert.ok(dogeBook.bids.length > 0, "DOGE book must have maker bids");
  assert.ok(dogeBook.asks.length > 0, "DOGE book must have maker asks");

  // Verify BTC book
  const btcRes = await fetch(`${API_BASE}/api/books/BTC`, { headers: authHeaders });
  assert.equal(btcRes.status, 200);
  const btcBook = await btcRes.json();
  assert.equal(btcBook.symbol, "BTC");
  assert.ok(btcBook.bids.length > 0, "BTC book must have maker bids");
  assert.ok(btcBook.asks.length > 0, "BTC book must have maker asks");

  // Verify ETH book
  const ethRes = await fetch(`${API_BASE}/api/books/ETH`, { headers: authHeaders });
  assert.equal(ethRes.status, 200);
  const ethBook = await ethRes.json();
  assert.equal(ethBook.symbol, "ETH");
  assert.ok(ethBook.bids.length > 0, "ETH book must have maker bids");
  assert.ok(ethBook.asks.length > 0, "ETH book must have maker asks");
  console.log(`  ✔ DOGE, BTC & ETH books loaded successfully.`);

  // 6. Limit Order Placement & Reserve Logic
  console.log("\n[6/9] Placing Resting LIMIT BUY order (below market) & verifying cash reserve...");
  const restingPrice = 5; // $0.05 (below maker bid)
  const restingQty = 5;
  const expectedReserve = restingPrice * restingQty; // 25 cents

  const placeRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: restingQty, pricePaise: restingPrice }),
  });
  assert.ok([200, 201].includes(placeRes.status), `Place order failed: ${placeRes.status}`);
  const placeData = await placeRes.json();
  assert.equal(placeData.order.status, "OPEN");
  assert.equal(placeData.trades.length, 0, "Resting order should not trade immediately");
  const restingOrderId = placeData.order.id ?? placeData.order.orderId;

  // Verify wallet reserved funds
  const accAfterOrder = await (await fetch(`${API_BASE}/api/account`, { headers: authHeaders })).json();
  assert.equal(accAfterOrder.wallet.reservedCashPaise, expectedReserve, "Reserved cash should match order value");
  assert.equal(accAfterOrder.wallet.availableCashPaise, 50_000_000 - expectedReserve, "Available cash should be reduced by reserve");
  console.log(`  ✔ Order #${restingOrderId} placed: $${expectedReserve / 100} reserved from cash balance.`);

  // 7. Order Cancellation & Reserve Refund
  console.log("\n[7/9] Cancelling order & verifying reserve refund...");
  const cancelRes = await fetch(`${API_BASE}/api/orders/DOGE/${restingOrderId}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert.equal(cancelRes.status, 200);
  const cancelData = await cancelRes.json();
  assert.equal(cancelData.cancelled, true);

  const accAfterCancel = await (await fetch(`${API_BASE}/api/account`, { headers: authHeaders })).json();
  assert.equal(accAfterCancel.wallet.reservedCashPaise, 0, "Reserved cash should return to 0");
  assert.equal(accAfterCancel.wallet.availableCashPaise, 50_000_000, "Available cash should be fully refunded");
  console.log(`  ✔ Order #${restingOrderId} cancelled: $${expectedReserve / 100} refunded cleanly to available cash.`);

  // Verify ETH order placement and cancellation
  const ethOrderRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ symbol: "ETH", side: "BUY", type: "LIMIT", quantity: 1, pricePaise: 230000 }),
  });
  assert.ok([200, 201].includes(ethOrderRes.status));
  const ethOrderData = await ethOrderRes.json();
  assert.equal(ethOrderData.order.symbol, "ETH");
  const ethCancelRes = await fetch(`${API_BASE}/api/orders/ETH/${ethOrderData.order.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert.equal(ethCancelRes.status, 200);
  console.log("  ✔ ETH order placement and cancellation verified successfully.");

  // Verify BTC order placement and cancellation
  const btcOrderRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ symbol: "BTC", side: "BUY", type: "LIMIT", quantity: 1, pricePaise: 8000000 }),
  });
  assert.ok([200, 201].includes(btcOrderRes.status));
  const btcOrderData = await btcOrderRes.json();
  assert.equal(btcOrderData.order.symbol, "BTC");
  const btcCancelRes = await fetch(`${API_BASE}/api/orders/BTC/${btcOrderData.order.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert.equal(btcCancelRes.status, 200);
  console.log("  ✔ BTC order placement and cancellation verified successfully.");

  // 8. Trade Execution & FIFO P/L Calculation
  console.log("\n[8/9] Buying units then executing SELL trade against maker bid to verify FIFO Realized P/L...");
  // Buy 5 DOGE against maker ask first
  const freshDoge = await (await fetch(`${API_BASE}/api/books/DOGE`, { headers: authHeaders })).json();
  const buyPrice = freshDoge.bestAsk;
  const buyRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: 5, pricePaise: buyPrice }),
  });
  assert.ok([200, 201].includes(buyRes.status));
  const buyData = await buyRes.json();
  assert.equal(buyData.trades.length, 1);

  // Check current best bid on DOGE and sell 2 units
  const dogeBeforeSell = await (await fetch(`${API_BASE}/api/books/DOGE`, { headers: authHeaders })).json();
  const executeBidPrice = dogeBeforeSell.bestBid;
  const sellRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ symbol: "DOGE", side: "SELL", type: "LIMIT", quantity: 2, pricePaise: executeBidPrice }),
  });
  assert.ok([200, 201].includes(sellRes.status), `Sell order failed: ${sellRes.status}`);
  const sellData = await sellRes.json();
  assert.equal(sellData.trades.length, 1, "Should execute 1 trade against maker bid");
  const trade = sellData.trades[0];
  assert.equal(trade.quantity, 2);
  assert.equal(trade.pricePaise, executeBidPrice);

  // Check account post-trade
  const accAfterTrade = await (await fetch(`${API_BASE}/api/account`, { headers: authHeaders })).json();
  const dogePos = accAfterTrade.positions.find((p: any) => p.symbol === "DOGE");
  assert.equal(dogePos.units, 3, "Position should decrease from 5 to 3 units");
  // Trade proceeds = 2 * executeBidPrice
  const tradeProceeds = 2 * executeBidPrice;
  // Cost basis was 2 * buyPrice
  const costBasis = 2 * buyPrice;
  const expectedPnl = tradeProceeds - costBasis;
  assert.equal(accAfterTrade.realizedPaise, expectedPnl, `Realized P/L should be ${expectedPnl} cents`);
  console.log(`  ✔ Trade executed: 2 DOGE @ $${trade.pricePaise / 100}. Realized P/L = $${expectedPnl / 100} (cost basis $${costBasis / 100} vs proceeds $${tradeProceeds / 100}).`);

  // 9. Replay Benchmark Comparison
  console.log("\n[9/9] Testing /api/replay engine benchmark...");
  const replayCsv = `side,type,pricePaise,quantity
BUY,LIMIT,7,20
SELL,LIMIT,9,20
BUY,LIMIT,9,10
SELL,LIMIT,7,15
`;
  const replayRes = await fetch(`${API_BASE}/api/replay?symbol=DOGE`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "text/csv" },
    body: replayCsv,
  });
  const replayBodyText = await replayRes.text();
  assert.equal(replayRes.status, 200, `Replay failed (${replayRes.status}): ${replayBodyText}`);
  const replayData = JSON.parse(replayBodyText);
  assert.equal(replayData.orders, 4);
  assert.equal(replayData.tradeCount, 2);
  assert.equal(replayData.equivalentTrades, true, "BST/DLL and Array replay trade sequences must match exactly");
  assert.ok(typeof replayData.treeDll.durationMs === "number");
  assert.ok(typeof replayData.plainArray.durationMs === "number");
  console.log(`  ✔ Replay benchmark executed: 4 orders, 2 trades, equivalentTrades=true. BST Engine: ${replayData.treeDll.durationMs}ms vs Array Replay: ${replayData.plainArray.durationMs}ms.`);

  console.log("\n=================================================");
  console.log("    ALL 9 END-TO-END FEATURE TESTS PASSED!       ");
  console.log("=================================================\n");
}

runE2ETests().catch(err => {
  console.error("\n❌ E2E Test Failure:", err);
  process.exit(1);
});
