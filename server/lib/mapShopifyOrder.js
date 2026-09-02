function mapAddress(address) {
  if (!address) return null;
  return {
    firstName: address.first_name || "",
    lastName: address.last_name || "",
    company: address.company || "",
    address1: address.address1 || "",
    address2: address.address2 || "",
    city: address.city || "",
    postcode: address.zip || "",
    state: address.province || "",
    country: address.country || "",
  };
}

// Shopify has no single "status" field — it's derived from financial_status
// + fulfillment_status + cancelled_at. Mapped onto the same status
// vocabulary WooCommerce orders use (see server/lib/mapOrder.js) so every
// downstream consumer (Orders.jsx filters, analytics.js REALIZED_STATUSES/
// RETURNED_STATUSES) works unmodified for both platforms.
function resolveStatus(order) {
  if (order.cancelled_at) return "cancelled";
  const financial = order.financial_status;
  const fulfillment = order.fulfillment_status;
  if (financial === "refunded") return "refunded";
  if (financial === "voided") return "failed";
  if (financial === "paid" && fulfillment === "fulfilled") return "completed";
  if (financial === "paid") return "processing";
  if (financial === "partially_paid" || financial === "partially_refunded") return "on-hold";
  return "pending";
}

function mapShopifyOrder(order, sourceSiteUrl) {
  const lineItems = order.line_items || [];
  return {
    id: order.id,
    platform: "shopify",
    number: order.name || String(order.order_number || order.id),
    status: resolveStatus(order),
    dateCreated: order.created_at,
    dateCompleted: order.closed_at || null,
    // Fiscalization is a Serbian WooCommerce-plugin concept with no Shopify
    // equivalent — always true so Shopify orders never surface in the
    // "Nefiskalizovane porudžbine" report.
    fiscalized: true,
    total: order.total_price,
    currency: order.currency,
    customerNote: order.note || "",
    paymentMethod: (order.payment_gateway_names || [])[0] || "",
    shippingMethod: order.shipping_lines?.[0]?.title || "",
    shippingTotal: order.total_shipping_price_set?.shop_money?.amount || "0",
    sourceSiteUrl: sourceSiteUrl || null,
    billing: {
      ...mapAddress(order.billing_address),
      email: order.email || order.contact_email || "",
      phone: order.phone || order.customer?.phone || order.billing_address?.phone || "",
    },
    shipping: mapAddress(order.shipping_address),
    items: lineItems.map((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      const subtotal = price * quantity;
      const discount = (item.discount_allocations || []).reduce(
        (sum, d) => sum + (Number(d.amount) || 0),
        0
      );
      return {
        id: item.id,
        productId: item.product_id,
        name: item.title || item.name,
        sku: item.sku || "",
        quantity: item.quantity,
        price: item.price,
        total: (subtotal - discount).toFixed(2),
        subtotal: subtotal.toFixed(2),
        image: "",
      };
    }),
  };
}

module.exports = { mapShopifyOrder };
