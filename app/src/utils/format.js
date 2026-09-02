export function formatKpiValue(format, value, currency = "RSD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (format) {
    case "currency": {
      // Per-unit costs (CPC, CPA) are often well under 1 currency unit —
      // rounding those to a whole number always shows "0". Only totals
      // (which are almost never single-digit) get the plain rounded form.
      const decimals = Math.abs(value) < 10 ? 2 : 0;
      return `${value.toLocaleString("sr-RS", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })} ${currency}`;
    }
    case "percent":
      return `${value.toFixed(1)}%`;
    case "decimal":
      return value.toFixed(2);
    case "days":
      return `${value.toFixed(1)} dana`;
    case "integer":
    default:
      return Math.round(value).toLocaleString("sr-RS");
  }
}
