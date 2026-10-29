import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/api";
import { revoke } from "@/lib/auth/oauth-providers";
import { isProvider } from "@/lib/auth/provider-param";
import { clearSession, readSession } from "@/lib/auth/session";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/auth/[provider]/logout">) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return jsonError(404, "bad_request", "알 수 없는 서비스입니다.");
  if (!isSameOrigin(request)) return jsonError(403, "bad_request", "허용되지 않은 요청입니다.");

  const session = await readSession(request, provider).catch(() => null);
  if (session) await revoke(provider, session);
  const res = NextResponse.json({ ok: true });
  clearSession(request, res, provider);
  return res;
}
