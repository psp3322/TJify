import { Fragment } from "react";

/** 문구 안의 [글자]를 link가 돌려주는 요소(보통 링크)로 바꿔 그린다. 번역마다 링크 위치가 달라서 쓴다 */
export function RichText({ text, link }: { text: string; link(label: string): React.ReactNode }) {
  const parts = text.split(/\[([^\]]+)\]/);
  return <>{parts.map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{link(part)}</Fragment> : part))}</>;
}
