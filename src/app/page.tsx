import { Suspense } from "react";
import TjifyApp from "@/components/TjifyApp";

export default function Page() {
  return (
    <Suspense fallback={<Shell />}>
      <TjifyApp />
    </Suspense>
  );
}

/** 자바스크립트가 뜨기 전 잠깐 보이는 정적 화면 */
function Shell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 pt-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          TJify<span className="text-accent">.</span>
        </h1>
        <p className="text-sm text-muted">내 플레이리스트를 노래방 번호로</p>
      </div>
      <div className="h-9 w-72 animate-pulse rounded-full bg-surface" />
      <div className="h-40 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
