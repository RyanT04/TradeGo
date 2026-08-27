"""
TradeGo Latency Benchmark
Runs a few quick scenarios against the deployed TradeGo API and produces charts.

Scenarios:
    1. Smoke test          — /api/health
    2. Warm read           — 200x sequential GET /api/tickers
    3. Trade write         — 50x sequential POST /api/order
    4. Concurrent read     — 50 simultaneous GET /api/tickers
    5. Balance contention  — N simultaneous buys against a balance that only
                             covers some of them. Verifies SELECT ... FOR UPDATE
                             serialises the balance check: exactly the affordable
                             number should succeed and the balance must never
                             go negative.

Usage:
    cd ~/developer/TradeGo/benchmark
    python3 -m venv .venv
    source .venv/bin/activate
    pip install aiohttp matplotlib numpy
    python3 quick_benchmark.py

Charts and raw data saved to benchmark/results/
"""

import asyncio
import time
import json
import platform
import socket
from datetime import datetime, timezone

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path

# ── Configuration ──
TRADEGO_BASE = "https://trade-go.tech"
# TRADEGO_BASE = "https://tradego.ryantang.dev"  # fallback if on uni wifi

# Contention scenario: fire CONTENTION_TRADES buys at once against a balance
# that only covers CONTENTION_AFFORDABLE of them. Anything above that must be
# rejected with insufficient balance rather than overdrafting.
#
# PATCH /api/auth/balance only accepts a whitelist (1000 / 10000 / 100000), so
# the balance is fixed and the order size is derived from it rather than the
# other way round.
CONTENTION_TRADES = 20
CONTENTION_AFFORDABLE = 15
CONTENTION_FUNDING = 1000.0  # must be 1000, 10000 or 100000

# Endpoint that returns the current user (including balance). Adjust if yours
# differs — the contention check degrades gracefully if this 404s.
ME_ENDPOINT = "/api/auth/me"

RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(exist_ok=True)

plt.rcParams.update({
    "figure.facecolor": "#0a0a0f",
    "axes.facecolor": "#12121a",
    "axes.edgecolor": "#1a1a25",
    "axes.labelcolor": "#9ca3af",
    "text.color": "#e5e7eb",
    "xtick.color": "#9ca3af",
    "ytick.color": "#9ca3af",
    "grid.color": "#1a1a25",
    "grid.alpha": 0.5,
    "font.size": 11,
    "savefig.dpi": 200,
    "savefig.bbox": "tight",
    "savefig.facecolor": "#0a0a0f",
})


async def timed_get(session, url, headers=None):
    start = time.perf_counter()
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            body = await resp.read()
            return (time.perf_counter() - start) * 1000, resp.status, body
    except Exception as e:
        # Surface the error rather than swallowing it — a failed request and a
        # slow request are very different things.
        print(f"  ! GET {url} raised {type(e).__name__}: {e}")
        return (time.perf_counter() - start) * 1000, 0, None


async def timed_post(session, url, body, headers=None):
    start = time.perf_counter()
    try:
        async with session.post(url, json=body, headers=headers, timeout=30) as resp:
            try:
                data = await resp.json()
            except Exception:
                data = None
            return (time.perf_counter() - start) * 1000, resp.status, data
    except Exception as e:
        print(f"  ! POST {url} raised {type(e).__name__}: {e}")
        return (time.perf_counter() - start) * 1000, 0, None


async def timed_patch(session, url, body, headers=None):
    start = time.perf_counter()
    try:
        async with session.patch(url, json=body, headers=headers, timeout=30) as resp:
            try:
                data = await resp.json()
            except Exception:
                data = None
            return (time.perf_counter() - start) * 1000, resp.status, data
    except Exception as e:
        print(f"  ! PATCH {url} raised {type(e).__name__}: {e}")
        return (time.perf_counter() - start) * 1000, 0, None


def extract_price(resp):
    """Pull the fill price out of an order response, whatever its shape."""
    if not isinstance(resp, dict):
        return None
    for candidate in (resp.get("trade"), resp):
        if isinstance(candidate, dict) and "price" in candidate:
            try:
                return float(candidate["price"])
            except (TypeError, ValueError):
                pass
    return None


def extract_balance(resp):
    """Pull the balance out of a /me-style response, whatever its shape."""
    if not isinstance(resp, dict):
        return None
    for candidate in (resp.get("user"), resp):
        if isinstance(candidate, dict) and "balance" in candidate:
            try:
                return float(candidate["balance"])
            except (TypeError, ValueError):
                pass
    return None


async def register_account(session, label):
    """Create a fresh test account and return (email, token) or (email, None)."""
    email = f"bench-{label}-{int(time.time() * 1000)}@test.local"
    password = "BenchPass123!"

    _, status, data = await timed_post(session, f"{TRADEGO_BASE}/api/auth/register", {
        "email": email, "password": password,
    })

    if status in (200, 201) and data and data.get("token"):
        return email, data["token"]

    _, status, data = await timed_post(session, f"{TRADEGO_BASE}/api/auth/login", {
        "email": email, "password": password,
    })
    if status == 200 and data and data.get("token"):
        return email, data["token"]

    print(f"  Could not acquire token for {email} (last status={status})")
    return email, None


async def run_benchmark():
    import aiohttp

    run_meta = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "target": TRADEGO_BASE,
        "client_host": socket.gethostname(),
        "client_platform": platform.platform(),
    }

    async with aiohttp.ClientSession() as session:

        print("=" * 60)
        print("TradeGo Latency Benchmark")
        print(f"Target: {TRADEGO_BASE}")
        print(f"Started: {run_meta['started_at']}")
        print("=" * 60)

        # ── Smoke test ──
        print("\n[1/6] Smoke test...")
        ms, status, _ = await timed_get(session, f"{TRADEGO_BASE}/api/health")
        if status != 200:
            print(f"  FAILED: /api/health returned {status}. Is the server running?")
            print(f"  URL: {TRADEGO_BASE}")
            return
        print(f"  OK — {ms:.1f} ms")

        # ── Scenario 1: Warm read (GET /api/tickers) ──
        print("\n[2/6] Warm read — 200x GET /api/tickers...")
        warm_latencies = []
        for i in range(200):
            ms, status, _ = await timed_get(session, f"{TRADEGO_BASE}/api/tickers")
            if status == 200:
                warm_latencies.append(ms)
            if (i + 1) % 50 == 0:
                print(f"  {i + 1}/200")

        # ── Scenario 2: Sequential trades ──
        print("\n[3/6] Creating test account...")
        _, token = await register_account(session, "seq")

        trade_latencies_user = []
        trade_latencies_server = []
        fill_price = None

        if token:
            headers = {"Authorization": f"Bearer {token}"}
            print("  Token acquired")

            _, status_b, data_b = await timed_patch(
                session, f"{TRADEGO_BASE}/api/auth/balance",
                {"balance": 100000}, headers)
            print(f"  Balance set: status={status_b} resp={data_b}")

            print("\n[4/6] Trade write — 50x POST /api/order (alternating BUY/SELL)...")
            for i in range(50):
                side = "BUY" if i % 2 == 0 else "SELL"
                ms, status, resp = await timed_post(session, f"{TRADEGO_BASE}/api/order", {
                    "symbol": "BTCUSDT", "side": side, "quantity": 0.0001,
                }, headers)
                if status in (200, 201):
                    trade_latencies_user.append(ms)
                    if resp and isinstance(resp, dict) and "latency_us" in resp:
                        trade_latencies_server.append(resp["latency_us"])
                    if fill_price is None:
                        fill_price = extract_price(resp)
                else:
                    if i < 3:
                        print(f"  Trade {i} failed: status={status} resp={resp}")
                if (i + 1) % 10 == 0:
                    print(f"  {i + 1}/50 (captured: {len(trade_latencies_user)} user, "
                          f"{len(trade_latencies_server)} server)")
        else:
            print("\n[4/6] Skipped (no auth token)")

        # ── Scenario 3: Concurrent reads ──
        print("\n[5/6] Concurrent read — 50 simultaneous GET /api/tickers...")
        concurrent_latencies = []

        async def one_request():
            ms, status, _ = await timed_get(session, f"{TRADEGO_BASE}/api/tickers")
            if status == 200:
                concurrent_latencies.append(ms)

        await asyncio.gather(*[one_request() for _ in range(50)])

        # ── Scenario 4: Balance contention ──
        #
        # This is the scenario that actually exercises the row lock. Every
        # request targets the same users row, so without SELECT ... FOR UPDATE
        # around the balance check, several requests would read the same
        # balance, all pass the affordability check, and all debit — driving the
        # balance negative. With the lock they serialise, and exactly the
        # affordable number should fill.
        print(f"\n[6/6] Balance contention — {CONTENTION_TRADES} simultaneous buys, "
              f"funded for {CONTENTION_AFFORDABLE}...")

        contention = {
            "attempted": 0,
            "succeeded": 0,
            "rejected": 0,
            "errored": 0,
            "expected_success": CONTENTION_AFFORDABLE,
            "funded_balance": None,
            "final_balance": None,
            "latencies_ms": [],
        }

        _, c_token = await register_account(session, "contend")

        if not c_token:
            print("  Skipped (no auth token)")
        elif fill_price is None:
            print("  Skipped (no fill price captured from the sequential run)")
        else:
            c_headers = {"Authorization": f"Bearer {c_token}"}
            funded = CONTENTION_FUNDING
            contention["funded_balance"] = funded

            # The balance is fixed by the API's whitelist, so size each order to
            # fit instead: exactly CONTENTION_AFFORDABLE of them should fit in
            # the funded balance, with half a trade of headroom so float
            # rounding can't knock out the last affordable fill.
            qty = funded / (fill_price * (CONTENTION_AFFORDABLE + 0.5))
            cost_each = fill_price * qty
            contention["order_qty"] = qty
            contention["cost_each"] = cost_each

            _, status_b, data_b = await timed_patch(
                session, f"{TRADEGO_BASE}/api/auth/balance",
                {"balance": funded}, c_headers)
            if status_b != 200:
                print(f"  ! Funding failed: status={status_b} resp={data_b}")
            print(f"  Price {fill_price:.2f}, funded {funded:.2f}, "
                  f"qty/order {qty:.8f} (~{cost_each:.2f} each), status={status_b}")

            results = []

            async def one_buy():
                ms, status, resp = await timed_post(
                    session, f"{TRADEGO_BASE}/api/order", {
                        "symbol": "BTCUSDT", "side": "BUY", "quantity": qty,
                    }, c_headers)
                results.append((ms, status, resp))

            await asyncio.gather(*[one_buy() for _ in range(CONTENTION_TRADES)])

            for ms, status, resp in results:
                contention["attempted"] += 1
                contention["latencies_ms"].append(ms)
                if status in (200, 201):
                    contention["succeeded"] += 1
                elif status in (400, 402, 409, 422):
                    contention["rejected"] += 1
                else:
                    contention["errored"] += 1

            # Read the balance back. If the endpoint differs, this just reports
            # unknown rather than failing the run.
            _, me_status, me_body = await timed_get(
                session, f"{TRADEGO_BASE}{ME_ENDPOINT}", c_headers)
            if me_status == 200 and me_body:
                try:
                    contention["final_balance"] = extract_balance(json.loads(me_body))
                except Exception:
                    pass

            print(f"  Attempted {contention['attempted']}, "
                  f"succeeded {contention['succeeded']}, "
                  f"rejected {contention['rejected']}, "
                  f"errored {contention['errored']}")

            ok = contention["succeeded"] == CONTENTION_AFFORDABLE
            print(f"  Expected {CONTENTION_AFFORDABLE} fills — "
                  f"{'PASS' if ok else 'MISMATCH'}")

            fb = contention["final_balance"]
            if fb is None:
                print(f"  Final balance: unknown ({ME_ENDPOINT} returned {me_status})")
            else:
                print(f"  Final balance: {fb:.2f} — "
                      f"{'PASS (non-negative)' if fb >= 0 else 'FAIL (OVERDRAFT)'}")

        # ── Print summary ──
        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)

        def stats(name, data_list):
            if not data_list:
                print(f"  {name}: no data")
                return
            arr = np.array(data_list)
            print(f"  {name}:")
            print(f"    n={len(arr)}, min={arr.min():.1f}, p50={np.median(arr):.1f}, "
                  f"p95={np.percentile(arr, 95):.1f}, p99={np.percentile(arr, 99):.1f}, "
                  f"max={arr.max():.1f}, mean={arr.mean():.1f}")

        stats("Warm read (ms)", warm_latencies)
        stats("Trade user-observed (ms)", trade_latencies_user)
        stats("Trade server-internal (µs)", trade_latencies_server)
        stats("Concurrent 50x read (ms)", concurrent_latencies)
        stats("Contention buys (ms)", contention["latencies_ms"])

        # ── Chart 1: Latency distribution (warm read) ──
        if warm_latencies:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

            ax1.hist(warm_latencies, bins=30, color="#10b981", alpha=0.8,
                     edgecolor="#0a0a0f", linewidth=0.5)
            ax1.axvline(np.median(warm_latencies), color="#f59e0b", linestyle="--",
                        linewidth=1.5, label=f"p50: {np.median(warm_latencies):.1f} ms")
            ax1.axvline(np.percentile(warm_latencies, 95), color="#ef4444", linestyle="--",
                        linewidth=1.5, label=f"p95: {np.percentile(warm_latencies, 95):.1f} ms")
            ax1.set_xlabel("Latency (ms)")
            ax1.set_ylabel("Request count")
            ax1.set_title("GET /api/tickers — Latency Distribution (n=200)")
            ax1.legend(facecolor="#12121a", edgecolor="#1a1a25")

            sorted_warm = np.sort(warm_latencies)
            cdf = np.arange(1, len(sorted_warm) + 1) / len(sorted_warm)
            ax2.plot(sorted_warm, cdf, color="#10b981", linewidth=2)
            ax2.axhline(0.5, color="#f59e0b", linewidth=0.8, linestyle="--", alpha=0.5)
            ax2.axhline(0.95, color="#ef4444", linewidth=0.8, linestyle="--", alpha=0.5)
            ax2.set_xlabel("Latency (ms)")
            ax2.set_ylabel("Fraction of requests ≤ latency")
            ax2.set_title("GET /api/tickers — CDF")
            ax2.set_ylim(0, 1.02)

            fig.suptitle("TradeGo — Read Latency Profile", fontsize=14, color="white", y=1.02)
            fig.tight_layout()
            path1 = RESULTS_DIR / "read_latency.png"
            fig.savefig(path1)
            plt.close(fig)
            print(f"\n  Chart saved: {path1}")

        # ── Chart 2: Trade latency (user-observed vs server-internal) ──
        if trade_latencies_user and trade_latencies_server:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

            ax1.hist(trade_latencies_user, bins=20, color="#6366f1", alpha=0.8,
                     edgecolor="#0a0a0f", linewidth=0.5)
            ax1.axvline(np.median(trade_latencies_user), color="#f59e0b", linestyle="--",
                        linewidth=1.5, label=f"p50: {np.median(trade_latencies_user):.1f} ms")
            ax1.axvline(np.percentile(trade_latencies_user, 95), color="#ef4444", linestyle="--",
                        linewidth=1.5, label=f"p95: {np.percentile(trade_latencies_user, 95):.1f} ms")
            ax1.set_xlabel("Latency (ms)")
            ax1.set_ylabel("Trade count")
            ax1.set_title("Trade Execution — User-Observed (ms)")
            ax1.legend(facecolor="#12121a", edgecolor="#1a1a25")

            ax2.hist(trade_latencies_server, bins=20, color="#10b981", alpha=0.8,
                     edgecolor="#0a0a0f", linewidth=0.5)
            ax2.axvline(np.median(trade_latencies_server), color="#f59e0b", linestyle="--",
                        linewidth=1.5, label=f"p50: {np.median(trade_latencies_server):.0f} µs")
            ax2.axvline(np.percentile(trade_latencies_server, 95), color="#ef4444", linestyle="--",
                        linewidth=1.5, label=f"p95: {np.percentile(trade_latencies_server, 95):.0f} µs")
            ax2.set_xlabel("Latency (µs)")
            ax2.set_ylabel("Trade count")
            ax2.set_title("Trade Execution — Server-Internal (µs)")
            ax2.legend(facecolor="#12121a", edgecolor="#1a1a25")

            fig.suptitle("TradeGo — Trade Latency: Network vs Engine",
                         fontsize=14, color="white", y=1.02)
            fig.tight_layout()
            path2 = RESULTS_DIR / "trade_latency.png"
            fig.savefig(path2)
            plt.close(fig)
            print(f"  Chart saved: {path2}")
        else:
            print("\n  Trade latency chart skipped (no trade data captured)")

        # ── Chart 3: Contention outcome and latency under lock ──
        if contention["attempted"]:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

            labels = ["Filled", "Rejected", "Errored"]
            values = [contention["succeeded"], contention["rejected"], contention["errored"]]
            colors = ["#10b981", "#f59e0b", "#ef4444"]
            bars = ax1.bar(labels, values, color=colors, alpha=0.85,
                           edgecolor="#0a0a0f", linewidth=0.5)
            ax1.axhline(CONTENTION_AFFORDABLE, color="#6366f1", linestyle="--", linewidth=1.5,
                        label=f"Affordable: {CONTENTION_AFFORDABLE}")
            for bar, v in zip(bars, values):
                ax1.text(bar.get_x() + bar.get_width() / 2, v + 0.2, str(v),
                         ha="center", color="#e5e7eb")
            ax1.set_ylabel("Order count")
            ax1.set_title(f"{CONTENTION_TRADES} Simultaneous Buys — Outcome")
            ax1.legend(facecolor="#12121a", edgecolor="#1a1a25")

            if trade_latencies_user:
                ax2.hist(trade_latencies_user, bins=20, color="#6366f1", alpha=0.6,
                         edgecolor="#0a0a0f", linewidth=0.5, label="Sequential")
            ax2.hist(contention["latencies_ms"], bins=20, color="#f59e0b", alpha=0.6,
                     edgecolor="#0a0a0f", linewidth=0.5, label="Under contention")
            ax2.axvline(np.median(contention["latencies_ms"]), color="#ef4444", linestyle="--",
                        linewidth=1.5,
                        label=f"contended p50: {np.median(contention['latencies_ms']):.1f} ms")
            ax2.set_xlabel("Latency (ms)")
            ax2.set_ylabel("Order count")
            ax2.set_title("Trade Latency — Sequential vs Row-Lock Contention")
            ax2.legend(facecolor="#12121a", edgecolor="#1a1a25")

            fig.suptitle("TradeGo — Balance Contention Under Concurrent Buys",
                         fontsize=14, color="white", y=1.02)
            fig.tight_layout()
            path3 = RESULTS_DIR / "contention.png"
            fig.savefig(path3)
            plt.close(fig)
            print(f"  Chart saved: {path3}")

        # ── Save raw data ──
        run_meta["finished_at"] = datetime.now(timezone.utc).isoformat()
        raw = {
            "run": run_meta,
            "warm_read_ms": warm_latencies,
            "trade_user_ms": trade_latencies_user,
            "trade_server_us": trade_latencies_server,
            "concurrent_50_ms": concurrent_latencies,
            "contention": contention,
        }
        raw_path = RESULTS_DIR / "raw_data.json"
        with open(raw_path, "w") as f:
            json.dump(raw, f, indent=2)
        print(f"  Raw data saved: {raw_path}")

        print("\nDone!")


if __name__ == "__main__":
    asyncio.run(run_benchmark())