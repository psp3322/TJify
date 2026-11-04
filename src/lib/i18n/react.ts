"use client";

import { useSyncExternalStore } from "react";
import { getLang, subscribeLang, translate, type Lang, type Translate } from ".";

/** 현재 언어. 언어를 바꾸면 다시 그린다 (정적 HTML과 첫 렌더는 한국어) */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, () => "ko");
}

/** 컴포넌트용: 지금 그리는 언어에 묶인 t */
export function useT(): { lang: Lang; t: Translate } {
  const lang = useLang();
  return { lang, t: (key, vars) => translate(lang, key, vars) };
}
