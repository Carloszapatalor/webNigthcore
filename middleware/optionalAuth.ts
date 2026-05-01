import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken, type JwtPayload } from "../lib/auth.ts";

export async function optionalAuth(c: Context, next: Next) {
  const token = getCookie(c, "session");
  if (token) {
    const payload = await verifyToken(token);
    if (payload && !payload.mcp) {
      c.set("user", payload);
    }
  }
  await next();
}
