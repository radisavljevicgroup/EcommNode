export default function Toast({ type, message }) {
  if (!message) return null;
  return (
    <div className={"toast toast-" + type} role="status">
      {message}
    </div>
  );
}
