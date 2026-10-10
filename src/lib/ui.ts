export type ApiResult<T = any> = {
  data: T;
  configured?: boolean;
  error?: string;
  count?: number;
};
export type ActionResult<T = any> =
  { ok: true; data: T; message?: string } | { ok: false; error: string };
export const asArray = <T = any>(v: unknown): T[] =>
  Array.isArray(v) ? v : [];
export const text = (v: unknown, fallback = "") =>
  typeof v === "string" && v.trim() ? v : fallback;
export const money = (
  amount: unknown,
  currency?: string,
  minorUnits?: number,
) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || !currency || !/^[A-Z]{3}$/.test(currency))
    return "Price shown at checkout";
  try {
    const standard = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    });
    const digits =
      minorUnits ?? standard.resolvedOptions().maximumFractionDigits;
    if (
      digits === undefined ||
      !Number.isInteger(digits) ||
      digits < 0 ||
      digits > 6
    )
      return "Price shown at checkout";
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n / 10 ** digits);
  } catch {
    return "Price shown at checkout";
  }
};
export const humanize = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const formatDate = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime())
    ? "Date to be confirmed"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
};
export const localDateTimeValue = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 16);
};
export const safeResourceHref = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:"
      ? u.toString()
      : null;
  } catch {
    return null;
  }
};
export async function getData<T = any>(
  resource: string,
  filters: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const q = new URLSearchParams({ resource, ...filters });
  const res = await fetch(`/api/data?${q}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const json = await res
    .json()
    .catch(() => ({ data: [], error: "Could not read the server response." }));
  if (!res.ok && !json.error)
    json.error = "This information is temporarily unavailable.";
  return json;
}
export async function postAction<T = any>(
  action: string,
  payload: Record<string, any> = {},
): Promise<ActionResult<T>> {
  const res = await fetch("/api/action", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res
    .json()
    .catch(() => ({ ok: false, error: "Could not read the server response." }));
  if (!res.ok && json.ok !== false)
    return { ok: false, error: "That action could not be completed." };
  return json;
}
export function recordValue(record: any, key: string) {
  const value = record?.[key];
  if (value == null || value === "") return "—";
  if (typeof value === "object")
    return Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
  return String(value);
}
export const API_SETUP_NOTE =
  "Some live features are still being connected. Your account and activity are not stored in this browser.";
