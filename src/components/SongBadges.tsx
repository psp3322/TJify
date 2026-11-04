import type { SongMeta } from "@/lib/client/song-meta";
import { DIFFICULTY_LABEL, SING_ALONG_LABEL, type SingAlong } from "@/lib/insights/types";

const DIFFICULTY_STYLE: Record<number, string> = {
  1: "border-ok/40 text-ok",
  2: "border-ok/30 text-ok/90",
  3: "border-line text-muted",
  4: "border-warn/40 text-warn",
  5: "border-danger/50 text-danger",
};

const SING_ALONG_STYLE: Record<SingAlong, string> = {
  everyone: "border-accent/50 text-accent",
  many: "border-accent/30 text-accent/80",
  some: "border-line text-muted",
  fans: "border-line text-muted/70",
};

/** 목록 한 줄의 난이도·대중성 꼬리표 */
export function SongBadges({ meta }: { meta: SongMeta }) {
  if (meta.difficulty === null && !meta.singAlong) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {meta.difficulty !== null && (
        <span
          className={`rounded-full border px-1.5 py-px text-[11px] leading-4 ${DIFFICULTY_STYLE[meta.difficulty]}`}
          title={meta.difficultyIsMine ? "내가 매긴 난이도" : "Claude가 추정한 난이도"}
        >
          {DIFFICULTY_LABEL[meta.difficulty]}
          {meta.difficultyIsMine ? " · 내 평가" : ""}
        </span>
      )}
      {meta.singAlong && (
        <span
          className={`rounded-full border px-1.5 py-px text-[11px] leading-4 ${SING_ALONG_STYLE[meta.singAlong]}`}
          title={SING_ALONG_LABEL[meta.singAlong].long}
        >
          {meta.chart ? `노래방 인기 ${meta.chart[0]}위` : SING_ALONG_LABEL[meta.singAlong].short}
        </span>
      )}
    </span>
  );
}
