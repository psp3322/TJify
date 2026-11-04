import { describe, expect, it } from "vitest";
import { googleAuthorizeUrl, readOAuthResponse, spotifyAuthorizeUrl } from "./auth";

describe("readOAuthResponse", () => {
  it("Spotify는 쿼리로, Google은 # 뒤로 돌아온 응답을 읽는다", () => {
    expect(readOAuthResponse("?code=abc&state=s1", "")).toEqual({ kind: "code", code: "abc", state: "s1" });
    expect(readOAuthResponse("", "#access_token=tok&token_type=Bearer&expires_in=3599&state=s2")).toEqual({
      kind: "token",
      accessToken: "tok",
      expiresIn: 3599,
      state: "s2",
    });
    expect(readOAuthResponse("?error=access_denied&state=s3", "")).toEqual({ kind: "error", error: "access_denied", state: "s3" });
    expect(readOAuthResponse("", "#error=access_denied&state=s4")).toEqual({ kind: "error", error: "access_denied", state: "s4" });
  });

  it("state가 없으면 OAuth 응답이 아니다 (사이트가 붙이는 알림 주소와 구분)", () => {
    expect(readOAuthResponse("?error=access_denied&provider=spotify", "")).toBeNull();
    expect(readOAuthResponse("?import=https%3A%2F%2Fyoutube.com", "")).toBeNull();
    expect(readOAuthResponse("", "")).toBeNull();
  });
});

describe("authorize URL", () => {
  it("Spotify는 PKCE 코드 방식, Google은 토큰 방식으로 사이트 첫 화면에 돌아오게 한다", () => {
    const spotify = new URL(spotifyAuthorizeUrl("cid", "https://psp3322.github.io/TJify/", "st", "ch"));
    expect(spotify.origin + spotify.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(Object.fromEntries(spotify.searchParams)).toMatchObject({
      response_type: "code",
      redirect_uri: "https://psp3322.github.io/TJify/",
      code_challenge_method: "S256",
      code_challenge: "ch",
      state: "st",
    });

    const google = new URL(googleAuthorizeUrl("gid", "https://psp3322.github.io/TJify/", "st"));
    expect(Object.fromEntries(google.searchParams)).toMatchObject({
      response_type: "token",
      redirect_uri: "https://psp3322.github.io/TJify/",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
    });
    expect(google.searchParams.has("client_secret")).toBe(false);
  });
});
