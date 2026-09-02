// Shared between the "Poruke" inbox (sidebar/chat header) and the
// Integracije cards for these channels — same colors, same abbreviations,
// so a brand's platform is recognizable in both places.
export const PLATFORM_META = {
  facebook: { label: "Messenger", className: "platform-facebook", initial: "f" },
  instagram: { label: "Instagram", className: "platform-instagram", initial: "ig" },
  whatsapp: { label: "WhatsApp", className: "platform-whatsapp", initial: "wa" },
  viber: { label: "Viber", className: "platform-viber", initial: "vb" },
};

export default function PlatformBadge({ platform, small }) {
  const meta = PLATFORM_META[platform] || { label: platform, className: "", initial: "?" };
  return (
    <span className={"platform-badge " + meta.className + (small ? " platform-badge-sm" : "")} title={meta.label}>
      {meta.initial}
    </span>
  );
}
