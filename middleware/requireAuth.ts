import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken, type JwtPayload } from "../lib/auth.ts";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, "session");
  if (!token) return c.redirect("/auth/login");
  const payload = await verifyToken(token);
  if (!payload) return c.redirect("/auth/login");
  if (payload.mcp) return c.redirect("/auth/change-password");
  c.set("user", payload);
  await next();
}
