import axios from "axios";

// Plain-language text for the gateway's typed error codes (contract: docs/architecture/m1-ai-gateway.md).
const CODE_TEXT: Record<string, string> = {
  auth_failed: "The provider turned down this key. Check that you copied all of it, or make a new one.",
  not_found: "The provider couldn't find that model or endpoint. Check the endpoint URL or pick another model.",
  rate_limited: "The provider says too many requests right now. Wait a minute and try again.",
  unreachable: "Nexora couldn't reach the provider. Check the endpoint URL and that the server is running.",
  bad_request: "The provider didn't accept the request. Check the endpoint URL and model.",
  provider_error: "The provider had a problem on its side. Try again in a moment.",
};

export function describeErrorCode(code?: string | null): string {
  return (code && CODE_TEXT[code]) || "The connection test failed.";
}

/** Hide a key the user just typed if a server message ever echoes it back. */
export function redact(text: string, secret: string): string {
  return secret.length >= 4 ? text.split(secret).join("•••") : text;
}

/**
 * Short, safe text for a failed request. Reads only status and `detail`, never the axios
 * error object itself, because its `config` holds the request body and headers.
 */
export function describeRequestError(err: unknown): string {
  if (!axios.isAxiosError(err)) return "Something went wrong. Try again.";
  if (!err.response) return "Can't reach the Nexora server. Is it running?";
  const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "error_code" in detail) {
    const d = detail as { error_code?: string; message?: string };
    return describeErrorCode(d.error_code);
  }
  if (Array.isArray(detail)) return "Some fields are missing or not valid.";
  return `The server answered ${err.response.status}.`;
}
