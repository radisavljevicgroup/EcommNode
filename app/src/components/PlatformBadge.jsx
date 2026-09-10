import messengerIcon from "../assets/mes.webp";
import instagramIcon from "../assets/in.jpg";
import whatsappIcon from "../assets/wa.jpg";
import viberIcon from "../assets/viber.png";

// Shared between the "Poruke" inbox (sidebar/chat header) and the
// Integracije cards for these channels — same icon, same label, so a
// brand's platform is recognizable in both places.
export const PLATFORM_META = {
  facebook: { label: "Messenger", className: "platform-facebook", icon: messengerIcon },
  instagram: { label: "Instagram", className: "platform-instagram", icon: instagramIcon },
  whatsapp: { label: "WhatsApp", className: "platform-whatsapp", icon: whatsappIcon },
  viber: { label: "Viber", className: "platform-viber", icon: viberIcon },
};

export default function PlatformBadge({ platform, small }) {
  const meta = PLATFORM_META[platform] || { label: platform, className: "", icon: null };
  return (
    <span className={"platform-badge " + meta.className + (small ? " platform-badge-sm" : "")} title={meta.label}>
      {meta.icon ? <img src={meta.icon} alt={meta.label} /> : meta.label.slice(0, 2)}
    </span>
  );
}
