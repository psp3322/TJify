/** 난이도가 높거나 낮은 이유로 고를 수 있는 꼬리표 (화면 표시가 들쭉날쭉하지 않게 목록을 고정한다) */
export const DIFFICULTY_TAGS = [
  "고음",
  "저음",
  "넓은 음역",
  "랩",
  "빠른 박자",
  "박자 까다로움",
  "긴 호흡",
  "긴 곡",
  "감정 표현",
  "영어 가사",
  "일본어 가사",
  "쉬운 멜로디",
  "반복 많음",
] as const;

export type DifficultyTag = (typeof DIFFICULTY_TAGS)[number];

/** Claude가 추정한 곡 정보 */
export interface SongInsight {
  /** 노래방에서 일반인이 부르기 기준 1(아주 쉬움) ~ 5(아주 어려움). 모르는 곡이면 null */
  difficulty: number | null;
  tags: DifficultyTag[];
  /** 한국에서 아는 정도 1(아는 사람만) ~ 5(모두 따라 부르는 곡). 모르는 곡이면 null */
  popularity: number | null;
  /** 부를 때 도움이 되는 한 줄 */
  tip?: string;
}

export interface InsightRequestItem {
  key: string;
  title: string;
  artists: string[];
}

export interface InsightResult {
  key: string;
  insight: SongInsight | null;
}

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: "아주 쉬움",
  2: "쉬움",
  3: "보통",
  4: "어려움",
  5: "아주 어려움",
};

/** 다른 사람들이 따라 부를 수 있는 정도 */
export type SingAlong = "everyone" | "many" | "some" | "fans";

export const SING_ALONG_LABEL: Record<SingAlong, { short: string; long: string }> = {
  everyone: { short: "다 같이", long: "다 같이 부르기 좋은 곡" },
  many: { short: "대부분 앎", long: "대부분 아는 곡" },
  some: { short: "꽤 알려짐", long: "아는 사람이 꽤 있는 곡" },
  fans: { short: "아는 사람만", long: "아는 사람만 아는 곡" },
};
