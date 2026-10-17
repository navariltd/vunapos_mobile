type StockBalanceItem = {
  actual_qty?: number | null;
  conversion_factor?: number | null;
  stock_uom?: string | null;
  uom?: string | null;
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(
    value,
  );
}

/** The concise availability label uses the selected selling UOM when present. */
export function formatAvailableStock(item: StockBalanceItem) {
  if (item.actual_qty === undefined || item.actual_qty === null) return "";
  const stockQty = Number(item.actual_qty || 0);
  const stockUom = item.stock_uom || "units";
  const salesUom = item.uom;
  const conversionFactor = Number(item.conversion_factor || 1);
  if (!salesUom || salesUom === stockUom || conversionFactor <= 1)
    return `${formatQuantity(stockQty)} ${stockUom}`;
  return `${formatQuantity(stockQty / conversionFactor)} ${salesUom}`;
}

/** Full stock-UOM context shown on demand, matching the SPA's info tooltip. */
export function formatStockBalanceDetails(item: StockBalanceItem) {
  if (item.actual_qty === undefined || item.actual_qty === null) return "";
  const stockQty = Number(item.actual_qty || 0);
  const stockUom = item.stock_uom || "units";
  const salesUom = item.uom;
  const conversionFactor = Number(item.conversion_factor || 1);
  const stockLabel = `${formatQuantity(stockQty)} ${stockUom}`;
  if (!salesUom || salesUom === stockUom || conversionFactor <= 1)
    return `Stock balance: ${stockLabel}`;
  return `Stock balance: ${stockLabel} (${formatQuantity(stockQty / conversionFactor)} ${salesUom})`;
}
