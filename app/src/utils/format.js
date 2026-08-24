export function formatKpiValue(format, value, currency = "RSD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (format) {
    case "currency":
      return `${Math.round(value).toLocaleString("sr-RS")} ${currency}`;
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
