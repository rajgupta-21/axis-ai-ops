export function formatRelativeCollected(iso: string | null): string {
  if (!iso) return "Never";
  const collected = new Date(iso).getTime();
  const diffMinutes = (Date.now() - collected) / 60000;
  if (diffMinutes < 10) return "Recent";
  return formatDateTime(iso);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
