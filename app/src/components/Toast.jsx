import { useEffect, useState } from "react";

// Every message in the app hides itself after this long (inline ones via
// the .auto-hide rules in index.css; the auth pages use their own auth-*
// messages and are left alone).
export const MESSAGE_VISIBLE_MS = 5000;

// trigger: the parent's toast object — a new object restarts the timer even
// when the text repeats (e.g. "Sačuvano." twice in a row).
export default function Toast({ type, message, trigger }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (!message) return undefined;
    const timer = window.setTimeout(() => setHidden(true), MESSAGE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [type, message, trigger]);

  if (!message || hidden) return null;
  return (
    <div className={"toast toast-" + type} role="status">
      {message}
    </div>
  );
}
