import type { Lang, MessageKey } from "@/lib/i18n";

/**
 * 난이도가 높거나 낮은 이유로 고를 수 있는 꼬리표 (화면 표시가 들쭉날쭉하지 않게 목록을 고정한다).
 * 값 자체는 AI 응답 형식에 쓰는 한국어이고, 영어 화면에서는 TAG_EN으로 바꿔 보여 준다.
 */
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

const TAG_EN: Record<DifficultyTag, string> = {
  고음: "High notes",
  저음: "Low notes",
  "넓은 음역": "Wide range",
  랩: "Rap",
  "빠른 박자": "Fast tempo",
  "박자 까다로움": "Tricky rhythm",
  "긴 호흡": "Long phrases",
  "긴 곡": "Long song",
  "감정 표현": "Emotional",
  "영어 가사": "English lyrics",
  "일본어 가사": "Japanese lyrics",
  "쉬운 멜로디": "Easy melody",
  "반복 많음": "Repetitive",
};

export function tagLabel(tag: DifficultyTag, lang: Lang): string {
  return lang === "en" ? (TAG_EN[tag] ?? tag) : tag;
}

/** 난이도를 추정한 AI */
export type InsightEngine = "claude" | "gemini";

/** AI가 추정한 곡 정보 */
export interface SongInsight {
  /** 노래방에서 일반인이 부르기 기준 1(아주 쉬움) ~ 5(아주 어려움). 모르는 곡이면 null */
  difficulty: number | null;
  tags: DifficultyTag[];
  /** 한국에서 아는 정도 1(아는 사람만) ~ 5(모두 따라 부르는 곡). 모르는 곡이면 null */
  popularity: number | null;
  /** 부를 때 도움이 되는 한 줄 (한국어) */
  tip?: string;
  /** 같은 팁의 영어 */
  tipEn?: string;
}

export interface InsightRequestItem {
  key: string;
  title: string;
  artists: string[];
}

export function difficultyKey(level: number): MessageKey {
  return `difficulty.${Math.min(5, Math.max(1, Math.round(level)))}` as MessageKey;
}

/** 다른 사람들이 따라 부를 수 있는 정도 */
export type SingAlong = "everyone" | "many" | "some" | "fans";

export function singAlongKey(level: SingAlong, long = false): MessageKey {
  return (long ? `singAlong.${level}.long` : `singAlong.${level}`) as MessageKey;
}
