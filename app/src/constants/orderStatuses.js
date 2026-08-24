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
