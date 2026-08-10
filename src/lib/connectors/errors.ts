/** Map provider/API failures to short, non-technical user messages. */
export function toUserFacingError(
  error: unknown,
  provider?: string,
): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("jwt") ||
    lower.includes("could not be decoded") ||
    lower.includes("invalid api token") ||
    lower.includes("invalid token")
  ) {
    if (provider === "supabase") {
      return "Invalid Supabase token. Use a personal access token (sbp_…) from Account → Access Tokens.";
    }
    return "Invalid API token. Check the key and try again.";
  }

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication")
  ) {
    if (provider === "supabase") {
      return "Supabase rejected this token. Create a new personal access token and reconnect.";
    }
    return "Authentication failed. Check the API token and try again.";
  }

  if (lower.includes("403") || lower.includes("forbidden")) {
    return "Access denied. This token may lack the required permissions.";
  }

  if (lower.includes("404") || lower.includes("not found")) {
    return "Resource not found for this connection.";
  }

  if (lower.includes("429") || lower.includes("rate")) {
    return "Provider rate limit hit. Try again in a moment.";
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound")
  ) {
    return "Could not reach the provider. Check your network connection.";
  }

  if (provider === "supabase") {
    return "Could not load Supabase data. Try reconnecting the source.";
  }
  if (provider === "railway") {
    return "Could not load Railway data. Try reconnecting the source.";
  }
  if (provider === "netlify") {
    return "Could not load Netlify data. Try reconnecting the source.";
  }
  if (provider === "qonto") {
    return "Could not load Qonto data. Try reconnecting the source.";
  }

  return "Something went wrong. Try reconnecting the source.";
}

export function friendlyStatusLabel(
  status: "ok" | "warn" | "error" | "idle" | string,
): string {
  switch (status) {
    case "ok":
      return "Operational";
    case "warn":
      return "Degraded";
    case "error":
      return "Down";
    case "idle":
      return "Idle";
    default:
      return "Unknown";
  }
}
