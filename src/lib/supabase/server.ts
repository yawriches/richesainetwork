import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://zjnpckryymbjmxhauoux.supabase.co";
// The public site address. Set APP_ORIGIN (e.g. https://richesainetwork.vercel.app
// or your custom domain). On Vercel, the project's production domain is used
// automatically when APP_ORIGIN is not set.
export const PREVIEW_ORIGIN =
  process.env.APP_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
export function configured() {
  return Boolean(process.env.SUPABASE_ANON_KEY);
}
export function publicClient() {
  if (!configured())
    throw new Error(
      "The database connection is being configured. Please try again shortly.",
    );
  return createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function serviceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("This secure operation is not configured yet.");
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function userClient() {
  if (!configured())
    throw new Error(
      "The database connection is being configured. Please try again shortly.",
    );
  const store = await cookies();
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, {
    cookieOptions: {
      name: "airiches_auth",
      sameSite: "none",
      secure: true,
      path: "/",
    },
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values) {
        try {
          for (const { name, value, options } of values)
            store.set(name, value, {
              ...options,
              sameSite: "none",
              secure: true,
              path: "/",
            });
        } catch {
          /* Read-only Server Component; route handlers refresh writable sessions. */
        }
      },
    },
  });
}
export async function identity() {
  const db = await userClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profile)
    throw new Error("Your profile is being prepared. Please sign in again.");
  if (profile.status === "SUSPENDED")
    throw new Error(
      "Your account is currently suspended. Please contact support.",
    );
  return { db, user, profile };
}
export async function administrator() {
  const session = await identity();
  if (session.profile.role !== "ADMIN") throw new Error("ADMIN_REQUIRED");
  return session;
}
