export function formatNum(n: number, decimals = 2) {
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}