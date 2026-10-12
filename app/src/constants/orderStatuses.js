// Status filter options for the Porudžbine (Orders) page. Kept separate
// from the badge labels in Orders.jsx (there "on-hold" reads as "Na
// čekanju") — here it's labeled "Poslato" per the filter spec.
export const ORDER_STATUS_OPTIONS = [
  { id: "pending", label: "Na čekanju" },
  { id: "processing", label: "U obradi" },
  { id: "on-hold", label: "Poslato" },
  { id: "completed", label: "Gotovo" },
  { id: "cancelled", label: "Otkazano" },
  { id: "refunded", label: "Vraćeno" },
  { id: "failed", label: "Neuspešno" },
];

// Labels for displaying an order's actual WooCommerce status (badges, table
// cells). Use these — not ORDER_STATUS_OPTIONS — wherever a status is shown.
export const ORDER_STATUS_LABELS = {
  pending: "Na čekanju",
  processing: "U obradi",
  "on-hold": "Na čekanju",
  completed: "Završeno",
  cancelled: "Otkazano",
  refunded: "Refundirano",
  failed: "Neuspešno",
};
