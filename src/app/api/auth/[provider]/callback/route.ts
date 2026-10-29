import { NextResponse, type NextRequest } from "next/server";
import { NotConfiguredError, type LoginErrorCode } from "@/lib/auth/errors";
import { exchangeCode } from "@/lib/auth/oauth-providers";
import { isProvider } from "@/lib/auth/provider-param";
import { clearPending, readPending, writeSession } from "@/lib/auth/session";
import { appOrigin } from "@/lib/env";
import { UpstreamError } from "@/lib/http";
import { fetchDisplayName } from "@/lib/sources/spotify";
import { fetchChannelName } from "@/lib/sources/youtube";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const origin = appOrigin(request.nextUrl.origin);
  if (!isProvider(provider)) return NextResponse.redirect(new URL("/", origin));

  const back = (params: { connected: string } | { error: LoginErrorCode }) => {
    const url = new URL("/", origin);
    if ("connected" in params) url.searchParams.set("connected", params.connected);
    else {
      url.searchParams.set("error", params.error);
      url.searchParams.set("provider", provider);
    }
    const res = NextResponse.redirect(url);
    clearPending(request, res, provider);
    return res;
  };

  const q = request.nextUrl.searchParams;
  const denied = q.get("error");
  if (denied) return back({ error: denied === "access_denied" ? "access_denied" : "failed" });

  const code = q.get("code");
  const state = q.get("state");
  const pending = await readPending(request, provider).catch(() => null);
  if (!code || !state || !pending || pending.state !== state) return back({ error: "state_mismatch" });

  try {
    const session = await exchangeCode(provider, code, pending.verifier, `${origin}/api/auth/${provider}/callback`);
    session.displayName =
      provider === "spotify" ? await fetchDisplayName(session.accessToken) : await fetchChannelName(session.accessToken);
    const res = back({ connected: provider });
    await writeSession(request, res, provider, session);
    return res;
  } catch (error) {
    console.error(`[auth:${provider}] callback`, error);
    if (error instanceof NotConfiguredError) return back({ error: "not_configured" });
    return back({ error: isNetworkError(error) ? "network" : "failed" });
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error) || error instanceof UpstreamError) return false;
  return error.name === "TimeoutError" || /fetch failed|econn|enotfound|socket/i.test(error.message);
}
