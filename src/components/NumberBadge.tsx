"use client";

import type { ResolvedNumber } from "@/lib/client/match-store";
import { useT } from "@/lib/i18n/react";
import type { Brand } from "@/lib/types";

const BRAND_TEXT: Record<Brand, string> = { tj: "text-tj", ky: "text-ky" };

/** 목록 한 줄 오른쪽의 노래방 번호 표시 */
export function NumberBadge({ brand, resolved, size = "md" }: { brand: Brand; resolved: ResolvedNumber; size?: "md" | "lg" }) {
  const { t } = useT();
  const big = size === "lg";
  const label = <span className={`text-[10px] font-semibold tracking-wide ${BRAND_TEXT[brand]} opacity-80`}>{t(`brand.${brand}`)}</span>;

  let body: React.ReactNode;
  let title: string | undefined;
  switch (resolved.status) {
    case "pending":
      body = <span className="num animate-pulse text-muted">···</span>;
      title = t("number.pending");
      break;
    case "found":
    case "manual":
      body = (
        <span className={`num font-bold ${big ? "text-3xl" : "text-lg"} ${BRAND_TEXT[brand]}`}>
          {resolved.song?.no}
          {resolved.status === "manual" && <span className="ml-0.5 align-top text-[10px] text-ok">✓</span>}
        </span>
      );
      title = resolved.status === "manual" ? t("number.manual") : resolved.confidence === "medium" ? t("number.medium") : t("number.high");
      break;
    case "maybe":
      body = (
        <span className={`num font-bold ${big ? "text-3xl" : "text-lg"} text-warn/90`}>
          {resolved.song?.no}
          <span className="ml-0.5 text-xs">?</span>
        </span>
      );
      title = t("number.maybe", { title: resolved.song?.title ?? "", singer: resolved.song?.singer ?? "" });
      break;
    case "none":
      body = <span className="text-sm text-muted/70">{t("number.none")}</span>;
      title = t("number.noneTitle");
      break;
    case "error":
      body = <span className="text-sm text-danger/80">{t("number.error")}</span>;
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
