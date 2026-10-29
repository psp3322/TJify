import "server-only";
import { sealData, unsealData } from "iron-session";
import type { NextRequest, NextResponse } from "next/server";
import { sessionPassword } from "@/lib/env";

export type Provider = "spotify" | "google";

/** 연동한 계정 하나의 토큰. 암호화한 httpOnly 쿠키에만 저장한다 */
export interface ProviderSession {
  accessToken: string;
  refreshToken?: string;
  /** 만료 시각 (epoch ms) */
  expiresAt: number;
  displayName?: string;
}

/** OAuth 왕복 동안만 쓰는 값 (CSRF 방지 state, PKCE verifier) */
export interface OAuthPending {
  state: string;
  verifier: string;
}

const SESSION_TTL = 60 * 60 * 24 * 30; // 30일 (refresh token 보관 기간)
const PENDING_TTL = 60 * 10; // 10분

const cookieName = (provider: Provider) => `tjify_${provider}`;
const pendingCookieName = (provider: Provider) => `tjify_oauth_${provider}`;

function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge };
}

function isSecure(request: NextRequest): boolean {
  return (process.env.APP_URL ?? request.nextUrl.origin).startsWith("https://");
}

async function unseal<T extends object>(value: string | undefined, ttl: number): Promise<T | null> {
  if (!value) return null;
  try {
    const data = await unsealData<T>(value, { password: sessionPassword(), ttl });
    return data && Object.keys(data).length > 0 ? data : null;
  } catch {
    return null;
  }
}

export async function readSession(request: NextRequest, provider: Provider): Promise<ProviderSession | null> {
  const data = await unseal<ProviderSession>(request.cookies.get(cookieName(provider))?.value, SESSION_TTL);
  return data?.accessToken ? data : null;
}

export async function writeSession(request: NextRequest, response: NextResponse, provider: Provider, session: ProviderSession) {
  const sealed = await sealData(session, { password: sessionPassword(), ttl: SESSION_TTL });
  response.cookies.set(cookieName(provider), sealed, cookieOptions(isSecure(request), SESSION_TTL - 60));
}

export function clearSession(request: NextRequest, response: NextResponse, provider: Provider) {
  response.cookies.set(cookieName(provider), "", cookieOptions(isSecure(request), 0));
}

export async function writePending(request: NextRequest, response: NextResponse, provider: Provider, pending: OAuthPending) {
  const sealed = await sealData(pending, { password: sessionPassword(), ttl: PENDING_TTL });
  response.cookies.set(pendingCookieName(provider), sealed, cookieOptions(isSecure(request), PENDING_TTL));
}

export async function readPending(request: NextRequest, provider: Provider): Promise<OAuthPending | null> {
  const data = await unseal<OAuthPending>(request.cookies.get(pendingCookieName(provider))?.value, PENDING_TTL);
  return data?.state && data.verifier ? data : null;
}

export function clearPending(request: NextRequest, response: NextResponse, provider: Provider) {
  response.cookies.set(pendingCookieName(provider), "", cookieOptions(isSecure(request), 0));
}
