"""
TradeGo Latency Benchmark
Runs a few quick scenarios against the deployed TradeGo API and produces charts.

Usage:
    cd ~/developer/TradeGo/benchmark
    python3 -m venv .venv
    source .venv/bin/activate
    pip install aiohttp matplotlib numpy
    python3 quick_benchmark.py

Charts saved to benchmark/results/
"""

import asyncio
import time
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path

# ── Configuration ──
# Use whichever domain works for you
TRADEGO_BASE = "https://trade-go.tech"
# TRADEGO_BASE = "https://tradego.ryantang.dev"  # fallback if on uni wifi

RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(exist_ok=True)

# Dark theme for charts (matches TradeGo's aesthetic)
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


async def timed_get(session, url):
    """Returns latency in ms."""
    start = time.perf_counter()
    try:
        async with session.get(url, timeout=30) as resp:
            await resp.read()
            return (time.perf_counter() - start) * 1000, resp.status
    except Exception as e:
        return (time.perf_counter() - start) * 1000, 0


async def timed_post(session, url, body, headers=None):
    """Returns (latency_ms, status, response_json)."""
    start = time.perf_counter()
    try:
        async with session.post(url, json=body, headers=headers, timeout=30) as resp:
            data = await resp.json()
            return (time.perf_counter() - start) * 1000, resp.status, data
    except Exception as e:
        return (time.perf_counter() - start) * 1000, 0, None


async def run_benchmark():
    import aiohttp
    async with aiohttp.ClientSession() as session:

        print("=" * 60)
        print("TradeGo Latency Benchmark")
        print("=" * 60)

        # ── Smoke test ──
        print("\n[1/5] Smoke test...")
        ms, status = await timed_get(session, f"{TRADEGO_BASE}/api/health")
        if status != 200:
            print(f"  FAILED: /api/health returned {status}. Is the server running?")
            print(f"  URL: {TRADEGO_BASE}")
            return
        print(f"  OK — {ms:.1f} ms")

        # ── Scenario 1: Warm read (GET /api/tickers) ──
        print("\n[2/5] Warm read — 200x GET /api/tickers...")
        warm_latencies = []
        for i in range(200):
            ms, status = await timed_get(session, f"{TRADEGO_BASE}/api/tickers")
            if status == 200:
                warm_latencies.append(ms)
            if (i + 1) % 50 == 0:
                print(f"  {i + 1}/200")

        # ── Scenario 2: Create test account + trade ──
        print("\n[3/5] Creating test account...")
        test_email = f"bench-{int(time.time())}@test.local"
        test_pass = "BenchPass123!"

        _, status, data = await timed_post(session, f"{TRADEGO_BASE}/api/auth/register", {
            "email": test_email, "password": test_pass,
        })
        if status not in (200, 201) or not data or not data.get("token"):
            print(f"  Register failed: {status} {data}")
            # Try login instead
            _, status, data = await timed_post(session, f"{TRADEGO_BASE}/api/auth/login", {
                "email": test_email, "password": test_pass,
            })
            if status != 200:
                print(f"  Login also failed. Skipping trade benchmark.")
                data = None

        trade_latencies_user = []  # user-observed (HTTP round-trip)
        trade_latencies_server = []  # server-internal (from response)

        if data and data.get("token"):
            token = data["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Set starting balance
            await timed_post(session, f"{TRADEGO_BASE}/api/auth/balance",
                           {"balance": 100000}, headers)

            print("\n[4/5] Trade write — 50x POST /api/order (alternating BUY/SELL)...")
            for i in range(50):
                side = "BUY" if i % 2 == 0 else "SELL"
                ms, status, resp = await timed_post(session, f"{TRADEGO_BASE}/api/order", {
                    "symbol": "BTCUSDT", "side": side, "quantity": 0.0001,
                }, headers)
                if status == 200:
                    trade_latencies_user.append(ms)
                    if resp and "latency_us" in resp:
                        trade_latencies_server.append(resp["latency_us"])
                if (i + 1) % 10 == 0:
                    print(f"  {i + 1}/50")
        else:
            print("\n[4/5] Skipped (no auth token)")

        # ── Scenario 3: Concurrent reads ──
        print("\n[5/5] Concurrent read — 50 simultaneous GET /api/tickers...")
        concurrent_latencies = []

        async def one_request():
            ms, status = await timed_get(session, f"{TRADEGO_BASE}/api/tickers")
            if status == 200:
                concurrent_latencies.append(ms)

        await asyncio.gather(*[one_request() for _ in range(50)])

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

        # ── Chart 1: Latency distribution (warm read vs concurrent) ──
        if warm_latencies:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

            # Histogram
            ax1.hist(warm_latencies, bins=30, color="#10b981", alpha=0.8, edgecolor="#0a0a0f", linewidth=0.5)
            ax1.axvline(np.median(warm_latencies), color="#f59e0b", linestyle="--", linewidth=1.5, label=f"p50: {np.median(warm_latencies):.1f} ms")
            ax1.axvline(np.percentile(warm_latencies, 95), color="#ef4444", linestyle="--", linewidth=1.5, label=f"p95: {np.percentile(warm_latencies, 95):.1f} ms")
            ax1.set_xlabel("Latency (ms)")
            ax1.set_ylabel("Request count")
            ax1.set_title("GET /api/tickers — Latency Distribution (n=200)")
            ax1.legend(facecolor="#12121a", edgecolor="#1a1a25")

            # CDF
            sorted_warm = np.sort(warm_latencies)
            cdf = np.arange(1, len(sorted_warm) + 1) / len(sorted_warm)
            ax1b = ax2
            ax1b.plot(sorted_warm, cdf, color="#10b981", linewidth=2)
            ax1b.axhline(0.5, color="#f59e0b", linewidth=0.8, linestyle="--", alpha=0.5)
            ax1b.axhline(0.95, color="#ef4444", linewidth=0.8, linestyle="--", alpha=0.5)
            ax1b.set_xlabel("Latency (ms)")
            ax1b.set_ylabel("Fraction of requests ≤ latency")
            ax1b.set_title("GET /api/tickers — CDF")
            ax1b.set_ylim(0, 1.02)

            fig.suptitle("TradeGo — Read Latency Profile", fontsize=14, color="white", y=1.02)
            fig.tight_layout()
            path1 = RESULTS_DIR / "read_latency.png"
            fig.savefig(path1)
            plt.close(fig)
            print(f"\n  Chart saved: {path1}")

        # ── Chart 2: Trade latency (user-observed vs server-internal) ──
        if trade_latencies_user and trade_latencies_server:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

            # User-observed (ms)
            ax1.hist(trade_latencies_user, bins=20, color="#6366f1", alpha=0.8, edgecolor="#0a0a0f", linewidth=0.5)
            ax1.axvline(np.median(trade_latencies_user), color="#f59e0b", linestyle="--", linewidth=1.5,
                       label=f"p50: {np.median(trade_latencies_user):.1f} ms")
            ax1.axvline(np.percentile(trade_latencies_user, 95), color="#ef4444", linestyle="--", linewidth=1.5,
                       label=f"p95: {np.percentile(trade_latencies_user, 95):.1f} ms")
            ax1.set_xlabel("Latency (ms)")
            ax1.set_ylabel("Trade count")
            ax1.set_title("Trade Execution — User-Observed (ms)")
            ax1.legend(facecolor="#12121a", edgecolor="#1a1a25")

            # Server-internal (µs)
            ax2.hist(trade_latencies_server, bins=20, color="#10b981", alpha=0.8, edgecolor="#0a0a0f", linewidth=0.5)
            ax2.axvline(np.median(trade_latencies_server), color="#f59e0b", linestyle="--", linewidth=1.5,
                       label=f"p50: {np.median(trade_latencies_server):.0f} µs")
            ax2.axvline(np.percentile(trade_latencies_server, 95), color="#ef4444", linestyle="--", linewidth=1.5,
                       label=f"p95: {np.percentile(trade_latencies_server, 95):.0f} µs")
            ax2.set_xlabel("Latency (µs)")
            ax2.set_ylabel("Trade count")
            ax2.set_title("Trade Execution — Server-Internal (µs)")
            ax2.legend(facecolor="#12121a", edgecolor="#1a1a25")

            fig.suptitle("TradeGo — Trade Latency: Network vs Engine", fontsize=14, color="white", y=1.02)
            fig.tight_layout()
            path2 = RESULTS_DIR / "trade_latency.png"
            fig.savefig(path2)
            plt.close(fig)
            print(f"  Chart saved: {path2}")

        # ── Save raw data ──
        raw = {
            "warm_read_ms": warm_latencies,
            "trade_user_ms": trade_latencies_user,
            "trade_server_us": trade_latencies_server,
            "concurrent_50_ms": concurrent_latencies,
        }
        raw_path = RESULTS_DIR / "raw_data.json"
        with open(raw_path, "w") as f:
            json.dump(raw, f, indent=2)
        print(f"  Raw data saved: {raw_path}")

        print("\nDone!")


if __name__ == "__main__":
    asyncio.run(run_benchmark())