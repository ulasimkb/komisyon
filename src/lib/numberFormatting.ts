const percentFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })

/** Türkçe yüzde gösterimi: işaret başta, ondalık ayırıcı virgül (%38,4). */
export function formatPercent(value: number): string {
  return `%${percentFormatter.format(value)}`
}

/** Payın bütün içindeki yüzdesi, bir ondalık basamağa yuvarlanmış. */
export function percentOf(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0
}
