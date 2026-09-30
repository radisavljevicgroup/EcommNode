// Prints one order in the layout of WooCommerce's own "Nova narudžbina"
// e-mail (colored header, Proizvod/Količina/Cena table with the item's
// options — engraving text etc. — listed under it, totals, then billing
// and shipping addresses). Rendered into a hidden iframe and printed from
// there, so no popup window can get blocked and the app page itself stays
// untouched.

// The header color of the Woo e-mail template the stores use.
const BASE_COLOR = "#a88b46";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency || "RSD"}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function addressLines(address, extra = []) {
  if (!address) return [];
  return [
    [address.firstName, address.lastName].filter(Boolean).join(" "),
    address.company,
    address.address1,
    address.address2,
    [address.postcode, address.city].filter(Boolean).join(" "),
    // The stores all sell within Serbia — only a foreign country is worth
    // printing, same as Woo's own e-mail does for the store's base country.
    address.country && address.country !== "RS" ? address.country : "",
    ...extra,
  ].filter(Boolean);
}

function buildOrderHtml(order) {
  const currency = order.currency;
  const customer = [order.billing?.firstName, order.billing?.lastName].filter(Boolean).join(" ");
  const subtotal = order.items.reduce((sum, item) => sum + (Number(item.subtotal ?? item.total) || 0), 0);
  const discount = Number(order.discountTotal) || 0;
  const shipping = Number(order.shippingTotal) || 0;

  const itemRows = order.items
    .map((item) => {
      const meta = (item.meta || [])
        .map((m) => `<li><strong>${escapeHtml(m.label)}:</strong> ${escapeHtml(m.value)}</li>`)
        .join("");
      return `<tr>
        <td class="td">${escapeHtml(item.name)}${item.sku ? ` (#${escapeHtml(item.sku)})` : ""}
          ${meta ? `<ul class="meta">${meta}</ul>` : ""}</td>
        <td class="td">${escapeHtml(item.quantity)}</td>
        <td class="td">${formatMoney(item.subtotal ?? item.total, currency)}</td>
      </tr>`;
    })
    .join("");

  const totals = [
    ["Međuzbir:", formatMoney(subtotal, currency)],
    ...(discount > 0 ? [["Popust:", `-${formatMoney(discount, currency)}`]] : []),
    [
      "Dostava:",
      `${shipping > 0 ? formatMoney(shipping, currency) : "Besplatno"}${
        order.shippingMethod ? ` <small>preko ${escapeHtml(order.shippingMethod)}</small>` : ""
      }`,
    ],
    ...(order.paymentMethod ? [["Način plaćanja:", escapeHtml(order.paymentMethod)]] : []),
    ["Ukupno:", formatMoney(order.total, currency)],
  ]
    .map(
      ([label, value]) =>
        `<tr><th class="td" colspan="2">${label}</th><td class="td">${value}</td></tr>`
    )
    .join("");

  const billing = addressLines(order.billing, [order.billing?.phone, order.billing?.email]);
  const shippingAddress = addressLines(order.shipping);

  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<title>Narudžbina #${escapeHtml(order.number || order.id)}</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  /* Always a white sheet — never the viewer's dark mode. */
  :root { color-scheme: light; }
  html, body { background: #fff; }
  body { margin: 0; font-family: "Helvetica Neue", Helvetica, Roboto, Arial, sans-serif; color: #636363; font-size: 14px; line-height: 1.5; }
  .wrap { max-width: 600px; margin: 0 auto; }
  .header { background: ${BASE_COLOR}; color: #fff; padding: 36px 48px; font-size: 30px; font-weight: 300; line-height: 1.2;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .body { padding: 36px 48px 24px; }
  h2 { color: ${BASE_COLOR}; font-size: 18px; font-weight: bold; margin: 18px 0 18px; }
  h2 span { text-decoration: underline; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e5e5e5; margin-bottom: 30px; }
  .td { border: 1px solid #e5e5e5; padding: 12px; text-align: left; vertical-align: middle; color: #636363; }
  thead .td, tfoot th.td { font-weight: bold; }
  .meta { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
  .meta li { margin: 2px 0; }
  .note { margin: 0 0 30px; }
  .addresses { display: flex; gap: 20px; }
  .addresses > div { flex: 1; }
  address { font-style: normal; border: 1px solid #e5e5e5; padding: 12px; }
  h3 { color: ${BASE_COLOR}; font-size: 16px; margin: 0 0 12px; }
  tr, li, address { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">Nova narudžbina: #${escapeHtml(order.number || order.id)}</div>
  <div class="body">
    <p>Primili ste sledeću narudžbinu od ${escapeHtml(customer || "kupca")}:</p>
    <h2><span>[Narudžbina #${escapeHtml(order.number || order.id)}]</span> (${formatDate(order.dateCreated)})</h2>
    <table>
      <thead><tr><th class="td">Proizvod</th><th class="td">Količina</th><th class="td">Cena</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>${totals}</tfoot>
    </table>
    ${
      order.customerNote
        ? `<h3>Napomena kupca</h3><p class="note">${escapeHtml(order.customerNote)}</p>`
        : ""
    }
    <div class="addresses">
      <div><h3>Adresa za naplatu</h3><address>${billing.map(escapeHtml).join("<br>")}</address></div>
      ${
        shippingAddress.length
          ? `<div><h3>Adresa za isporuku</h3><address>${shippingAddress.map(escapeHtml).join("<br>")}</address></div>`
          : ""
      }
    </div>
  </div>
</div>
</body>
</html>`;
}

export function printOrder(order) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(buildOrderHtml(order));
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  iframe.contentWindow.onafterprint = cleanup;
  // Give the iframe a tick to lay out before the print dialog snapshots it.
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Browsers that don't fire afterprint still get the iframe removed.
    setTimeout(cleanup, 60000);
  }, 150);
}

export { buildOrderHtml };
