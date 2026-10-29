import { connection, NextResponse, type NextRequest } from "next/server";
import { readSession, type Provider } from "@/lib/auth/session";
import { googleConfig, sessionPassword, spotifyConfig, youtubeApiKey } from "@/lib/env";
import { isBrandEnabled } from "@/lib/karaoke/providers";
import type { ProviderStatus, SessionStatus } from "@/lib/types";

/** 어떤 계정이 연결돼 있는지, 서버 설정은 됐는지 (토큰 자체는 내보내지 않는다) */
export async function GET(request: NextRequest) {
  // 빌드 환경에 SESSION_SECRET이 없으면 쿠키를 안 읽어서 정적 응답으로 굳어 버리므로, 항상 요청 시점에 실행되게 한다
  await connection();
  let sessionSecretOk = true;
  try {
    sessionPassword();
  } catch {
    sessionSecretOk = false;
  }

  const status = async (provider: Provider, configured: boolean): Promise<ProviderStatus> => {
    if (!sessionSecretOk) return { configured, connected: false };
    const session = await readSession(request, provider).catch(() => null);
    return { configured, connected: Boolean(session), ...(session?.displayName ? { displayName: session.displayName } : {}) };
  };

  const body: SessionStatus = {
    sessionSecretOk,
    spotify: await status("spotify", Boolean(spotifyConfig())),
    google: await status("google", Boolean(googleConfig())),
    brands: { tj: isBrandEnabled("tj"), ky: isBrandEnabled("ky") },
    youtubeApiKey: Boolean(youtubeApiKey()),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
