/** 난이도 추정에 쓰는 AI 모델. 설정 화면이 Anthropic SDK를 불러오지 않도록 따로 둔다 */
export const DEFAULT_MODEL = "claude-opus-5-5";

export const INSIGHT_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
];

/**
 * Gemini 무료 등급에서 쓸 수 있는 Flash 계열의 최신 모델을 가리키는 별칭.
 * 모델이 새로 나오면 Google이 이 이름 뒤의 모델을 바꿔 주므로, 예전 모델이 내려가도 코드를 고치지 않아도 된다.
 */
export const GEMINI_MODEL = "gemini-flash-latest";
