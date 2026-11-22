export function normalizeNameSearch(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function namePrefixPattern(value: string) {
  const term = normalizeNameSearch(value);
  const literal = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "[[:space:]]+");
  return term.includes(" ")
    ? `^[[:space:]]*${literal}`
    : `(^[[:space:]]*${literal}|[[:space:]]+${literal}[^[:space:]]*[[:space:]]*$)`;
}
