function mapAddress(address) {
  if (!address) return null;
  return {
    firstName: address.first_name || "",
    lastName: address.last_name || "",
    company: address.company || "",
    address1: address.address_1 || "",
    address2: address.address_2 || "",
    city: address.city || "",
    postcode: address.postcode || "",
    state: address.state || "",
    country: address.country || "",
  };
}

// Set by Serbian fiscal cash-register plugins (e.g. Fiscomm/VPFR) once a
// receipt is actually issued — not every store has such a plugin installed,
// in which case orders simply never carry this meta and count as unfiscalized.
// _referent_document_number (the actual PFR receipt number) is the reliable
// signal: checked against real order data across 4 stores, it was present on
// every single fiscalized order, while _fiscalized_amount was missing on a
// meaningful chunk of them (e.g. 16/30 on one store) despite the order
// genuinely having a receipt — so that field alone under-reports.
function isFiscalized(order) {
  const meta = order.meta_data || [];
  const refNumber = meta.find((m) => m.key === "_referent_document_number")?.value;
  return Boolean(refNumber && String(refNumber).trim());
}

// WooCommerce hands display_key/display_value back as rendered HTML
// (entities, sometimes a <p> or link) — plain text is all the order print
// needs.
function toPlainText(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Customer-entered item options (engraving text, position, script, font…)
// as WooCommerce shows them under the item in its own order e-mail —
// "_"-prefixed keys are internal plugin data, and object/array values are
// plugin payloads rather than something a person typed.
function mapItemMeta(item) {
  return (item.meta_data || [])
    .filter((m) => !String(m.key || "").startsWith("_"))
    .filter((m) => typeof (m.display_value ?? m.value) !== "object")
    .map((m) => ({
      label: toPlainText(m.display_key ?? m.key ?? ""),
      value: toPlainText(m.display_value ?? m.value ?? ""),
    }))
    .filter((m) => m.label && m.value);
}

function mapOrder(order, sourceSiteUrl) {
  return {
    id: order.id,
    platform: "woocommerce",
    number: order.number,
    status: order.status,
    dateCreated: order.date_created,
    // date_created is the store's local time with no offset; the GMT copy
    // (also offset-less, but always UTC) is what lets a real instant be
    // compared against server timestamps (e.g. order-distribution's
    // "only orders created after the tool was switched on").
    dateCreatedGmt: order.date_created_gmt || null,
    dateCompleted: order.date_completed || null,
    fiscalized: isFiscalized(order),
    total: order.total,
    // "ABC" is WooCommerce's reserved placeholder currency code — not a real
    // ISO 4217 currency. Sites that never explicitly set a currency in
    // WooCommerce > Settings > General can return it, so fall back to RSD.
    currency: order.currency === "ABC" ? "RSD" : order.currency,
    customerNote: order.customer_note || "",
    paymentMethod: order.payment_method_title || order.payment_method || "",
    shippingMethod: order.shipping_lines?.[0]?.method_title || "",
    shippingTotal: order.shipping_total || "0",
    discountTotal: order.discount_total || "0",
    sourceSiteUrl: sourceSiteUrl || null,
    billing: {
      ...mapAddress(order.billing),
      email: order.billing?.email || "",
      phone: order.billing?.phone || "",
    },
    shipping: mapAddress(order.shipping),
    items: (order.line_items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      sku: item.sku || "",
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      // WooCommerce keeps this as the pre-discount line total (regular
      // price × qty) even after the item itself was discounted — comparing
      // it against `total` is how a line item is detected as sold at a
      // reduced price (product-level sale or coupon), since this system
      // has no separate promotions/campaigns table to check against.
      subtotal: item.subtotal,
      image: item.image?.src || "",
      meta: mapItemMeta(item),
    })),
  };
}

module.exports = { mapOrder, mapAddress };
