import { BagIcon } from "../icons";

export default function Logo() {
  return (
    <a className="logo" href="#/home" title="Shopstack">
      <span className="logo-mark">
        <BagIcon />
      </span>
      <span className="logo-word">Shopstack</span>
    </a>
  );
}
