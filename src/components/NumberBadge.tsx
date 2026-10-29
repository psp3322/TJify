import type { ResolvedNumber } from "@/lib/client/match-store";
import { BRAND_LABEL, type Brand } from "@/lib/types";

const BRAND_TEXT: Record<Brand, string> = { tj: "text-tj", ky: "text-ky" };

/** 목록 한 줄 오른쪽의 노래방 번호 표시 */
export function NumberBadge({ brand, resolved, size = "md" }: { brand: Brand; resolved: ResolvedNumber; size?: "md" | "lg" }) {
  const big = size === "lg";
  const label = <span className={`text-[10px] font-semibold tracking-wide ${BRAND_TEXT[brand]} opacity-80`}>{BRAND_LABEL[brand]}</span>;

  let body: React.ReactNode;
  let title: string | undefined;
  switch (resolved.status) {
    case "pending":
      body = <span className="num animate-pulse text-muted">···</span>;
      title = "번호 찾는 중";
      break;
    case "found":
    case "manual":
      body = (
        <span className={`num font-bold ${big ? "text-3xl" : "text-lg"} ${BRAND_TEXT[brand]}`}>
          {resolved.song?.no}
          {resolved.status === "manual" && <span className="ml-0.5 align-top text-[10px] text-ok">✓</span>}
        </span>
      );
      title = resolved.status === "manual" ? "직접 고른 번호" : resolved.confidence === "medium" ? "거의 확실" : "확실";
      break;
    case "maybe":
      body = (
        <span className={`num font-bold ${big ? "text-3xl" : "text-lg"} text-warn/90`}>
          {resolved.song?.no}
          <span className="ml-0.5 text-xs">?</span>
        </span>
      );
      title = `확실하지 않음: ${resolved.song?.title} - ${resolved.song?.singer}`;
      break;
    case "none":
      body = <span className="text-sm text-muted/70">없음</span>;
      title = "노래방에서 찾지 못함";
      break;
    case "error":
      body = <span className="text-sm text-danger/80">확인 불가</span>;
      title = resolved.error;
      break;
  }

  return (
    <span className="flex min-w-14 flex-col items-end leading-tight" title={title}>
      {label}
      {body}
    </span>
  );
}
