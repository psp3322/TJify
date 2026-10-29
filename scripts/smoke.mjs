#!/usr/bin/env node
/**
 * 실제 노래방 사이트에 붙어서 검색·매칭이 되는지 확인하는 스크립트.
 * 먼저 다른 터미널에서 `npm run dev`(또는 `npm start`)로 서버를 띄운 뒤 실행한다.
 *
 *   npm run smoke
 *   BASE_URL=https://내-배포-주소 npm run smoke
 */
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");

const searches = [
  { brand: "tj", type: "title", q: "밤편지" },
  { brand: "tj", type: "singer", q: "아이유" },
  { brand: "ky", type: "title", q: "밤편지" },
  { brand: "ky", type: "singer", q: "아이유" },
];

const tracks = [
  { key: "1", title: "밤편지", artists: ["IU"] },
  { key: "2", title: "Hype Boy", artists: ["NewJeans"] },
  { key: "3", title: "주저하는 연인들을 위해", artists: ["잔나비"] },
  { key: "4", title: "Shape of You", artists: ["Ed Sheeran"] },
];

let failed = false;

for (const s of searches) {
  const url = `${BASE}/api/karaoke/search?${new URLSearchParams(s)}`;
  try {
    const res = await fetch(url);
    const body = await res.json();
    const songs = body.songs ?? [];
    const head = songs
      .slice(0, 3)
      .map((x) => `${x.no} ${x.title} - ${x.singer}`)
      .join(" | ");
    console.log(`[${res.status}] ${s.brand} ${s.type} "${s.q}": ${songs.length}건 ${head || body.message || ""}`);
    if (!res.ok || songs.length === 0) failed = failed || s.brand === "tj";
  } catch (error) {
    console.log(`[ERR] ${s.brand} ${s.type} "${s.q}": ${error.message}`);
    failed = true;
  }
}

try {
  const res = await fetch(`${BASE}/api/karaoke/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: tracks, brands: ["tj", "ky"] }),
  });
  const body = await res.json();
  console.log(`\n[${res.status}] 매칭 결과`);
  for (const r of body.results ?? []) {
    const t = tracks.find((x) => x.key === r.key);
    const fmt = (m) => (m?.best ? `${m.best.no} (${m.confidence})` : m?.error ? `오류: ${m.error}` : "없음");
    console.log(`  ${t.artists[0]} - ${t.title}  →  TJ ${fmt(r.tj)} / 금영 ${fmt(r.ky)}`);
    if (!r.tj?.best) failed = true;
  }
  if (!res.ok) failed = true;
} catch (error) {
  console.log(`[ERR] 매칭: ${error.message}`);
  failed = true;
}

if (failed) {
  console.log("\nTJ 검색이 기대대로 동작하지 않았습니다. 서버 로그와 네트워크(방화벽·프록시)를 확인하세요.");
  process.exit(1);
}
console.log("\n정상 동작합니다.");
