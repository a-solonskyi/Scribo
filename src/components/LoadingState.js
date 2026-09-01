export function LoadingState({ label = "Loading" }) {
  return <div className="state-message">{label}...</div>;
}

export function ErrorState({ message }) {
  if (!message) return null;
  return <div className="error-message">{message}</div>;
}
