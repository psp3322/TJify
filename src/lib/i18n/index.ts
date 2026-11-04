import { en, ko, type MessageKey } from "./messages";

/*
 * 한국어·영어 화면 문구. 처음에는 브라우저 언어를 따르고, 화면 위쪽 버튼으로 바꾸면 그 선택을 localStorage에 남긴다.
 * 컴포넌트 밖(오류 문구를 만드는 라이브러리 코드)에서도 t()를 바로 쓸 수 있게 현재 언어를 모듈에 둔다.
 * 빌드할 때(서버 코드)와 테스트에서는 한국어다. 컴포넌트용 훅은 ./react 에 있다.
 */

export type Lang = "ko" | "en";
export type { MessageKey };

const STORAGE_KEY = "tjify:lang:v1";
const listeners = new Set<() => void>();
let current: Lang | null = null;

function detect(): Lang {
  if (typeof navigator === "undefined") return "ko";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith("ko")) ? "ko" : "en";
}

export function getLang(): Lang {
  if (current) return current;
  if (typeof window === "undefined") return "ko";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ko" || saved === "en") return (current = saved);
  } catch {
    // 저장소를 못 읽으면 브라우저 언어를 따른다
  }
  return (current = detect());
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 저장하지 못해도 이번 방문 동안은 바꾼 언어로 보인다
  }
  for (const l of listeners) l();
}

export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

/** {name} 자리를 vars 값으로 채운 문구 */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const text = (lang === "en" ? en : ko)[key];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

/** 컴포넌트 밖(오류 문구 등)에서 쓰는 현재 언어 문구 */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(getLang(), key, vars);
}

export function subscribeLang(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 날짜·숫자 표기에 쓰는 로캘 */
export function locale(lang: Lang = getLang()): string {
  return lang === "en" ? "en-US" : "ko-KR";
}
