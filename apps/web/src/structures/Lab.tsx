import { useMemo, useState } from "react";
import { CandlestickChart } from "lucide-react";
import { OrderBook, type PriceNodeView } from "../../../api/src/engine/orderBook";
import { binarySearchTrace } from "../algorithms/search";
import { bubbleSort, insertionSort, mergeSort, quickSort, selectionSort } from "../algorithms/sorts";
import { money, usdToPaise } from "../lib/api";

type Side = "BUY" | "SELL";
type Kind = "LIMIT" | "MARKET";
type Row = { traderId: string; side: Side; type: Kind; price: string; quantity: string };
type SortName = "Bubble" | "Selection" | "Insertion" | "Merge" | "Quick";

const SAMPLE: Row[] = [
  { traderId: "Ava", side: "SELL", type: "LIMIT", price: "100.00", quantity: "5" },
  { traderId: "Ben", side: "SELL", type: "LIMIT", price: "101.00", quantity: "4" },
  { traderId: "Cara", side: "BUY", type: "LIMIT", price: "99.00", quantity: "3" },
  { traderId: "Dev", side: "BUY", type: "LIMIT", price: "99.00", quantity: "2" },
  { traderId: "Eve", side: "BUY", type: "LIMIT", price: "100.00", quantity: "2" }
];

type View = ReturnType<OrderBook["structure"]>;

function replay(rows: Row[], count: number): { error: string; view: View | null } {
  const book = new OrderBook("BTC");
  const slice = rows.slice(0, count);
  for (const row of slice) {
    const quantity = Number(row.quantity);
    const pricePaise = row.type === "LIMIT" ? usdToPaise(row.price) ?? undefined : undefined;
    if (!row.traderId.trim() || !Number.isInteger(quantity) || quantity <= 0 || (row.type === "LIMIT" && pricePaise == null)) {
      return { error: `Row ${row.traderId || "blank"} needs a trader, a whole quantity, and a price like 100.00.`, view: null };
    }
    book.submit({ traderId: row.traderId.trim(), symbol: "BTC", side: row.side, type: row.type, quantity, pricePaise });
  }
  return { error: "", view: book.structure() };
}

function flatten(node: PriceNodeView | undefined, depth: number, acc: { node: PriceNodeView; x: number; y: number }[]) {
  if (!node) return;
  flatten(node.left, depth + 1, acc);
  acc.push({ node, x: acc.length, y: depth });
  flatten(node.right, depth + 1, acc);
}

function PriceTree({ root, side, selected, onSelect }: { root?: PriceNodeView; side: Side; selected?: number; onSelect: (price: number) => void }) {
  const nodes = useMemo(() => {
    const acc: { node: PriceNodeView; x: number; y: number }[] = [];
    flatten(root, 0, acc);
    return acc;
  }, [root]);
  if (!nodes.length) return <p className="empty">No {side === "BUY" ? "bids" : "asks"}.</p>;
  const byPrice = new Map(nodes.map(item => [item.node.pricePaise, item]));
  const depth = Math.max(...nodes.map(item => item.y));
  const width = nodes.length * 92 + 16;
  const height = (depth + 1) * 86 + 8;
  const at = (item: { x: number; y: number }) => ({ x: 40 + item.x * 92, y: 24 + item.y * 86 });
  return <svg className="book-tree" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${side === "BUY" ? "Bid" : "Ask"} price tree`}>
    {nodes.map(item => {
      const here = at(item);
      return [item.node.left, item.node.right].map(child => {
        if (!child) return null;
        const other = byPrice.get(child.pricePaise);
        if (!other) return null;
        const there = at(other);
        return <line key={`${item.node.pricePaise}-${child.pricePaise}`} x1={here.x} y1={here.y} x2={there.x} y2={there.y} />;
      });
    })}
    {nodes.map(item => {
      const here = at(item);
      const on = selected === item.node.pricePaise;
      return <g key={item.node.pricePaise} onClick={() => onSelect(item.node.pricePaise)} className="tree-node">
        <circle cx={here.x} cy={here.y} r="16" className={on ? "on" : side === "BUY" ? "bid" : "ask"} />
        <text x={here.x} y={here.y + 4}>{item.node.orders.length}</text>
        <text x={here.x} y={here.y + 32}>{money(item.node.pricePaise)}</text>
      </g>;
    })}
  </svg>;
}

function findLevel(node: PriceNodeView | undefined, price?: number): PriceNodeView | undefined {
  if (!node || price == null) return undefined;
  if (node.pricePaise === price) return node;
  return findLevel(price < node.pricePaise ? node.left : node.right, price);
}

export function StructuresLab() {
  const [rows, setRows] = useState<Row[]>(SAMPLE);
  const [step, setStep] = useState(SAMPLE.length);
  const [picked, setPicked] = useState<number | undefined>(10000);
  const [orderId, setOrderId] = useState("3");
  const [sortName, setSortName] = useState<SortName>("Insertion");
  const built = useMemo(() => replay(rows, Math.min(step, rows.length)), [rows, step]);
  const view = built.view;
  const level = findLevel(view?.asks, picked) ?? findLevel(view?.bids, picked);
  const sortedOrders = useMemo(() => {
    const copy = [...(view?.orders ?? [])];
    const cmp = (a: typeof copy[number], b: typeof copy[number]) => (a.pricePaise ?? 0) - (b.pricePaise ?? 0);
    if (sortName === "Bubble") bubbleSort(copy, cmp);
    else if (sortName === "Selection") selectionSort(copy, cmp);
    else if (sortName === "Merge") mergeSort(copy, cmp);
    else if (sortName === "Quick") quickSort(copy, cmp);
    else insertionSort(copy, cmp);
    return copy;
  }, [view, sortName]);
  const lookup = useMemo(() => binarySearchTrace(view?.orders ?? [], Number(orderId), order => order.id), [view, orderId]);

  function update(index: number, patch: Partial<Row>) {
    setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  return <section className="content-panel structures-lab">
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>Workload</h2>
          <p>One book. Each row is submitted in order, then the same engine shows the structure it used.</p>
        </div>
        <span>apps/api/src/engine/orderBook.ts</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Trader</th><th>Side</th><th>Type</th><th>Price ($)</th><th>Qty</th><th/></tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}>
              <td><input aria-label={`Trader ${index + 1}`} value={row.traderId} onChange={event => update(index, { traderId: event.target.value })} /></td>
              <td><select aria-label={`Side ${index + 1}`} value={row.side} onChange={event => update(index, { side: event.target.value as Side })}><option>BUY</option><option>SELL</option></select></td>
              <td><select aria-label={`Type ${index + 1}`} value={row.type} onChange={event => update(index, { type: event.target.value as Kind })}><option>LIMIT</option><option>MARKET</option></select></td>
              <td><input aria-label={`Price ${index + 1}`} value={row.price} disabled={row.type === "MARKET"} onChange={event => update(index, { price: event.target.value })} /></td>
              <td><input aria-label={`Quantity ${index + 1}`} value={row.quantity} onChange={event => update(index, { quantity: event.target.value })} /></td>
              <td><button type="button" className="cancel-button" onClick={() => { setRows(current => current.filter((_, i) => i !== index)); setStep(current => Math.max(1, Math.min(current, rows.length - 1))); }}>Remove</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="lab-actions">
        <button type="button" className="secondary-action" onClick={() => setRows(current => [...current, { traderId: "New", side: "BUY", type: "LIMIT", price: "100.00", quantity: "1" }])}>Add order</button>
        <button type="button" className="secondary-action" onClick={() => { setRows(SAMPLE); setStep(SAMPLE.length); setPicked(10000); }}>Load sample</button>
        <label>Orders applied
          <input type="range" min={0} max={rows.length} value={Math.min(step, rows.length)} onChange={event => setStep(Number(event.target.value))} />
        </label>
        <span className="sort-result">{Math.min(step, rows.length)} of {rows.length}</span>
      </div>
      {built.error && <p className="auth-notice" role="alert">{built.error}</p>}
    </div>

    {view && <>
      <div className="metrics">
        <article className="metric"><p>Best bid</p><strong className="green">{money(view.bestBid)}</strong></article>
        <article className="metric"><p>Best ask</p><strong className="red">{money(view.bestAsk)}</strong></article>
        <article className="metric"><p>Spread</p><strong>{view.bestBid != null && view.bestAsk != null ? money(view.bestAsk - view.bestBid) : "—"}</strong></article>
        <article className="metric"><p>20-trade average</p><strong>{money(view.average)}</strong></article>
        <article className="metric"><p>Executions</p><strong>{view.trades.length}</strong></article>
      </div>

      <div className="topic-grid">
        <article className="panel topic-card"><p>orderBook.ts · price tree</p><h3>Binary search tree</h3><p>Bids and asks are separate trees, keyed by price. The best bid is the maximum. The best ask is the minimum. A price with no orders left is deleted.</p></article>
        <article className="panel topic-card"><p>PriceLevel · FIFO queue</p><h3>Doubly linked queue</h3><p>Orders at one price form a queue. Enqueue links after the tail. The head is the oldest order, so it is the next one filled. Cancel unlinks a node from the middle.</p></article>
        <article className="panel topic-card"><p>dataStructures.ts</p><h3>Circular list</h3><p>Each execution appends its price. The ring holds 20 prices. When it is full, the oldest price is overwritten. The average is the sum of the ring divided by its length.</p></article>
        <article className="panel topic-card"><p>dataStructures.ts</p><h3>Stack</h3><p>Every submit and cancel is pushed. The top of the stack is the latest action. Reading it does not pop it.</p></article>
        <article className="panel topic-card"><p>Trade.next</p><h3>Singly linked tape</h3><p>Each execution points at the next one. The head is the oldest trade. Walking next rebuilds the tape in time order.</p></article>
        <article className="panel topic-card"><p>algorithms.ts · search.ts</p><h3>Sort and binary search</h3><p>The order table is kept sorted by id, so cancellation can binary-search it. The report below sorts a copy by price with the algorithm you pick.</p></article>
      </div>

      <div className="lab-grid">
        <div className="panel">
          <div className="panel-heading"><h2>Price trees</h2><span>Click a price to see its queue</span></div>
          <div className="tree-pair">
            <div><p className="eyebrow">BIDS</p><PriceTree root={view.bids} side="BUY" selected={picked} onSelect={setPicked} /></div>
            <div><p className="eyebrow">ASKS</p><PriceTree root={view.asks} side="SELL" selected={picked} onSelect={setPicked} /></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Queue at {picked == null ? "this price" : money(picked)}</h2><span>head → tail</span></div>
          {level ? <ol className="chip-row">{level.orders.map((order, index) => <li key={order.id} className={index === 0 ? "chosen" : ""}>#{order.id} {order.traderId} · {order.remaining} left{index === 0 ? " · next" : ""}</li>)}</ol> : <p className="empty">That price is not resting. Filled orders leave the tree.</p>}
          <p className="market-note">On the sample, Cara and Dev both bid 99. Cara arrived first, so Cara is the head. Eve’s buy at 100 takes two units from Ava and leaves the rest of Ava’s sell at the head of 100.</p>
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Trade-price ring</h2><span>oldest → newest</span></div>
          {view.ring.length ? <ol className="chip-row">{view.ring.map((price, index) => <li key={`${price}-${index}`}>{money(price)}</li>)}</ol> : <p className="empty">No execution yet, so the ring is empty.</p>}
          <p className="market-note">tail.next points at the oldest price. The average uses every price still in the ring, at most 20.</p>
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Action stack</h2><span>top first</span></div>
          <ol className="stack-list">{view.actions.slice(0, 8).map((action, index) => <li key={`${action.orderId}-${action.timestamp}-${index}`} className={index === 0 ? "chosen" : ""}>{action.kind} #{action.orderId}{action.side ? ` ${action.side}` : ""}{action.pricePaise ? ` ${money(action.pricePaise)}` : ""}</li>)}</ol>
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Execution tape</h2><span>singly linked, head first</span></div>
          <div className="table-wrap"><table><thead><tr><th>Id</th><th>Price</th><th>Qty</th><th>Buyer → seller</th></tr></thead><tbody>
            {view.trades.length ? view.trades.map(trade => <tr key={trade.id}><td>{trade.id}</td><td>{money(trade.pricePaise)}</td><td>{trade.quantity}</td><td>{trade.buyerId} → {trade.sellerId}</td></tr>) : <tr><td className="empty-row" colSpan={4}>No executions yet.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Order table</h2><span>sorted by id</span></div>
          <form className="lab-search" onSubmit={event => event.preventDefault()}>
            <label>Order id
              <input value={orderId} onChange={event => setOrderId(event.target.value)} inputMode="numeric" />
            </label>
            <label>Sort copy by price
              <select value={sortName} onChange={event => setSortName(event.target.value as SortName)}>{(["Bubble", "Selection", "Insertion", "Merge", "Quick"] as SortName[]).map(name => <option key={name}>{name}</option>)}</select>
            </label>
          </form>
          <div className="chip-row probes">{lookup.steps.map((probe, index) => <span key={index}>mid #{probe.key} {probe.relation === "equal" ? "found" : probe.relation === "less" ? "too small" : "too big"}</span>)}</div>
          <p className="market-note">{lookup.index >= 0 ? `Binary search found order #${lookup.item?.id}, ${lookup.item?.traderId}, ${lookup.item?.status.toLowerCase().replace(/_/g, " ")}.` : `Order #${orderId || "—"} is not in this book.`}</p>
          <div className="table-wrap"><table><thead><tr><th>Id</th><th>Trader</th><th>Side</th><th>Price</th><th>Left</th><th>Status</th></tr></thead><tbody>
            {sortedOrders.map(order => <tr key={order.id}><td>{order.id}</td><td>{order.traderId}</td><td>{order.side}</td><td>{money(order.pricePaise)}</td><td>{order.remaining}</td><td>{order.status.toLowerCase().replace(/_/g, " ")}</td></tr>)}
          </tbody></table></div>
        </div>
      </div>
    </>}
  </section>;
}

export function PublicLab({ onSignIn }: { onSignIn: () => void }) {
  return <main className="public-lab">
    <header className="public-bar">
      <a className="brand" href="#structures"><CandlestickChart /><span>price<span>time</span></span></a>
      <p>Structures desk · the matching engine, without an account</p>
      <button type="button" className="secondary-action" onClick={onSignIn}>Sign in to trade</button>
    </header>
    <StructuresLab />
    <p className="site-footer">Demo funds only. This desk runs the order book in the browser. The trade desk stores orders for a signed-in account.</p>
  </main>;
}
