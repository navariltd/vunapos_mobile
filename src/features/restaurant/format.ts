/** Money as the POS shows it: "KES 1,200.00". */
export function formatMoney(amount: number | null | undefined, currency: string, precision = 2) {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
      style: "currency",
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(precision)}`;
  }
}

/** Item images may be site-relative (/files/…); resolve them against the company site. */
export function itemImageUrl(image: string | null | undefined, companyUrl: string) {
  if (!image?.trim()) return null;
  if (/^https?:\/\//i.test(image)) return image;
  try {
    return new URL(image, `${companyUrl.replace(/\/+$/, "")}/`).toString();
  } catch {
    return null;
  }
}

/** A menu item is offered below its list price (a pricing rule or promotion applies). */
export function hasOffer(item: { rate?: number; price_list_rate?: number }) {
  return item.rate !== undefined && item.price_list_rate !== undefined && item.rate < item.price_list_rate;
}
