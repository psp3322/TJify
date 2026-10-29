import { NextResponse, type NextRequest } from "next/server";
import { NotConfiguredError } from "@/lib/auth/errors";
import { authorizeUrl } from "@/lib/auth/oauth-providers";
import { codeChallenge, randomToken } from "@/lib/auth/pkce";
import { isProvider } from "@/lib/auth/provider-param";
import { writePending } from "@/lib/auth/session";
import { appOrigin } from "@/lib/env";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/auth/[provider]/login">) {
  const { provider } = await ctx.params;
  const origin = appOrigin(request.nextUrl.origin);
  if (!isProvider(provider)) return NextResponse.redirect(new URL("/", origin));

  try {
    const state = randomToken(16);
    const verifier = randomToken(48);
    const url = authorizeUrl(provider, {
      redirectUri: `${origin}/api/auth/${provider}/callback`,
      state,
      challenge: await codeChallenge(verifier),
    });
    const res = NextResponse.redirect(url);
    await writePending(request, res, provider, { state, verifier });
    return res;
  } catch (error) {
    if (!(error instanceof NotConfiguredError)) console.error(`[auth:${provider}] login`, error);
    const back = new URL("/", origin);
    back.searchParams.set("error", error instanceof NotConfiguredError ? "not_configured" : "failed");
    back.searchParams.set("provider", provider);
    return NextResponse.redirect(back);
  }
}
