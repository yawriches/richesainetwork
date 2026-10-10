import { NextRequest, NextResponse } from "next/server";
import { POST as applicationAction } from "@/app/api/action/route";
import { enforceMutation, failure } from "@/server/http";
const pages: Record<string, string> = {
  login: "/login",
  register: "/register",
  forgot_password: "/forgot-password",
  reset_password: "/reset-password",
  onboarding: "/onboarding",
  contact: "/contact",
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function messagePage(
  message: string,
  path: string,
  success: boolean,
  status = 200,
) {
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${success ? "Next step" : "Please try again"} — Riches AI Network</title><style>body{background:#f5f7fb;color:#202127;font:16px/1.6 system-ui;margin:0;padding:30px}main{max-width:560px;margin:8vh auto;background:white;border:1px solid #e9ebf2;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(30,30,60,.045)}a{color:#5748d1;font-weight:700}h1{line-height:1.2}</style><main><p>RICHES AI NETWORK</p><h1>${success ? "Your next step" : "We couldn’t finish that request"}</h1><p>${escape(message)}</p><p><a href="${path}">${success ? "Continue" : "Return and try again"}</a></p><p>For your security, your password is never placed in a page URL.</p></main></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
function copySetCookies(source: Headers, target: Headers) {
  const getSetCookie = (source as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  for (const cookie of getSetCookie?.call(source) || []) target.append("Set-Cookie", cookie);
}
export async function POST(request: NextRequest) {
  try {
    enforceMutation(request);
    const body = await request.text();
    if (body.length > 65536) throw new Error("That form is too large.");
    const form = new URLSearchParams(body),
      kind = form.get("kind") || "";
    if (!(kind in pages)) throw new Error("This form is not available.");
    if (
      kind === "register" &&
      form.get("password") !== form.get("confirm_password")
    )
      return messagePage(
        "Those passwords do not match. Please try again with a fresh password.",
        "/register",
        false,
        400,
      );
    const payload: any = {};
    for (const name of [
      "name",
      "email",
      "password",
      "country_code",
      "experience_level",
      "message",
      "website",
    ])
      if (form.has(name)) payload[name] = form.get(name);
    if (kind === "onboarding") payload.interests = form.getAll("interests");
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const internal = new NextRequest(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: kind, payload }),
    });
    const response = await applicationAction(internal),
      result = await response.json();
    if (!result.ok)
      return messagePage(
        result.error || "Please check your details and try again.",
        pages[kind],
        false,
        response.status,
      );
    if (result.data?.redirect)
      {
        const redirect = new NextResponse(null, {
          status: 303,
          headers: {
            Location: result.data.redirect,
            "Cache-Control": "private, no-store",
          },
        });
        copySetCookies(response.headers, redirect.headers);
        return redirect;
      }
    return messagePage(
      result.message || "Your request was accepted.",
      kind === "register" ? "/login" : pages[kind],
      true,
    );
  } catch (error) {
    const response = failure(error),
      result = await response.json();
    return messagePage(result.error, "/register", false, response.status);
  }
}
