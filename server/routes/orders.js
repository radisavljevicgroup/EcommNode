const { Router } = require("express");
const { createWooClient } = require("../lib/woocommerce");
const { getConnections, removeConnection } = require("../lib/store");

const router = Router();

router.get("/orders", async (req, res) => {
  const connections = getConnections();
  if (connections.length === 0) {
    return res.status(401).json({ error: "Nisi povezan ni sa jednom WooCommerce prodavnicom." });
  }

  const { connectionId } = req.query;
  let connection;
  if (connectionId) {
    connection = connections.find((c) => c.id === connectionId);
    if (!connection) {
      return res.status(404).json({ error: "Integracija nije pronađena." });
    }
  } else if (connections.length === 1) {
    connection = connections[0];
  } else {
    return res.status(400).json({
      error: "Povezano je više prodavnica — navedi connectionId.",
    });
  }

  const client = createWooClient(connection);

  try {
    const response = await client.get("orders", { per_page: 20 });
    const orders = response.data.map(mapOrder);
    res.json({ orders });
  } catch (err) {
    if (err?.response?.status === 401) {
      removeConnection(connection.id);
      return res.status(401).json({ error: "Pristupni podaci više ne važe, poveži se ponovo." });
    }
    res.status(400).json({ error: "Ne mogu da učitam porudžbine sa WooCommerce-a." });
  }
});

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

function mapOrder(order) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    dateCreated: order.date_created,
    total: order.total,
    // "ABC" is WooCommerce's reserved placeholder currency code — not a real
    // ISO 4217 currency. Sites that never explicitly set a currency in
    // WooCommerce > Settings > General can return it, so fall back to RSD.
    currency: order.currency === "ABC" ? "RSD" : order.currency,
    customerNote: order.customer_note || "",
    paymentMethod: order.payment_method_title || order.payment_method || "",
    shippingMethod: order.shipping_lines?.[0]?.method_title || "",
    billing: {
      ...mapAddress(order.billing),
      email: order.billing?.email || "",
      phone: order.billing?.phone || "",
    },
    shipping: mapAddress(order.shipping),
    items: (order.line_items || []).map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku || "",
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      image: item.image?.src || "",
    })),
  };
}

module.exports = router;
