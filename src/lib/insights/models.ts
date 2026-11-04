/** 난이도 추정에 쓰는 Claude 모델. 설정 화면이 Anthropic SDK를 불러오지 않도록 따로 둔다 */
export const DEFAULT_MODEL = "claude-opus-5-5";

export const INSIGHT_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (더 정확)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (더 저렴)" },
];
