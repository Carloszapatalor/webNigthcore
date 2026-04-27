import { sign, verify } from "hono/jwt";

const getSecret = () => {
  const s = Deno.env.get("JWT_SECRET");
  if (!s) throw new Error("JWT_SECRET not configured");
  return s;
};

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  exp: number;
  mcp?: boolean; // must_change_password (abreviado para mantener el JWT pequeño)
}

export async function signToken(data: Omit<JwtPayload, "exp">): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return sign({ ...data, exp }, getSecret(), "HS256");
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    return (await verify(token, getSecret(), "HS256")) as JwtPayload;
  } catch {
    return null;
  }
}
