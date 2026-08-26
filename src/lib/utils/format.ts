const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function formatDate(value: string | Date): string {
  return DATE_FORMATTER.format(
    typeof value === "string" ? new Date(value) : value,
  );
}
