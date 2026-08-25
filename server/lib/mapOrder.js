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

function mapOrder(order, sourceSiteUrl) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    dateCreated: order.date_created,
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
      image: item.image?.src || "",
    })),
  };
}

module.exports = { mapOrder, mapAddress };
