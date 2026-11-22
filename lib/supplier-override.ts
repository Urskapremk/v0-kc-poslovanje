// One booking can carry a supplier amount that replaces the price-list figure.
// Null means the card still uses the catalog. Zero is a real agreed amount.

export function readOverrideAr(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Digits only, so 300.000 and 300 000 both become 300000. Empty stays empty. */
export function parseSupplierAmountAr(raw: string): number | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return null
  return readOverrideAr(digits)
}

/** The amount on the card and on the pay button. An override replaces the catalog. */
export function supplierAmountAr(catalogAr: number, overrideAr: number | null | undefined): number {
  const override = readOverrideAr(overrideAr)
  if (override != null) return override
  const catalog = Math.round(Number(catalogAr) || 0)
  return catalog > 0 ? catalog : 0
}
