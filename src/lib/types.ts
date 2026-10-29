export type SourceKind = "spotify" | "youtube" | "paste";

/** 플레이리스트에서 가져온 곡 하나. 출처와 상관없이 같은 모양으로 맞춘다. */
export interface Track {
  /** 출처 안에서 유일한 id. 예: "spotify:4uLU6hMCjMI75M1A2tKUQC" */
  id: string;
  source: SourceKind;
  title: string;
  artists: string[];
  album?: string;
  imageUrl?: string;
  /** 원래 서비스에서 곡을 여는 링크 */
  url?: string;
  /** 유튜브 원본 영상 제목 (파싱 전) */
  rawTitle?: string;
  /** 유튜브: 음악 카테고리이거나 "- Topic" 채널이면 true */
  isMusic?: boolean;
}

export type Brand = "tj" | "ky";

export const BRANDS: readonly Brand[] = ["tj", "ky"] as const;

export const BRAND_LABEL: Record<Brand, string> = {
  tj: "TJ",
  ky: "금영",
};

/** 노래방 기기에 등록된 곡 하나 */
export interface KaraokeSong {
  brand: Brand;
  no: string;
  title: string;
  singer: string;
  lyricist?: string;
  composer?: string;
  /** TJ 검색 결과의 아이콘 표시. 예: "MR", "60이상 반주기 전용곡" */
  tags?: string[];
}

export type Confidence = "high" | "medium" | "low" | "none";

export interface BrandMatch {
  best: KaraokeSong | null;
  /** 0~1 사이 점수 */
  score: number;
  confidence: Confidence;
  /** 점수 순으로 정렬한 후보 (best 포함) */
  candidates: KaraokeSong[];
  /** 검색 자체가 실패했을 때의 사유 */
  error?: string;
}

export interface MatchRequestItem {
  key: string;
  title: string;
  artists: string[];
}

export interface MatchResult {
  key: string;
  tj?: BrandMatch;
  ky?: BrandMatch;
}

export interface TrackPage {
  tracks: Track[];
  /** 다음 페이지 커서. 없으면 마지막 페이지 */
  next: string | null;
  total?: number;
  /** 플레이리스트 제목 (링크로 가져올 때 첫 페이지에만) */
  title?: string;
}

export interface ProviderStatus {
  /** 서버에 클라이언트 ID 등 환경 변수가 있는지 */
  configured: boolean;
  connected: boolean;
  displayName?: string;
}

export interface SessionStatus {
  sessionSecretOk: boolean;
  spotify: ProviderStatus;
  google: ProviderStatus;
  brands: Record<Brand, boolean>;
  /** 서버에 YOUTUBE_API_KEY가 있어 공개 재생목록을 로그인 없이 읽을 수 있는지 */
  youtubeApiKey: boolean;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  imageUrl?: string;
  trackCount?: number;
  owner?: string;
}
