import { collapseSpaces, compact } from "./normalize";
import type { Track } from "@/lib/types";

export type PasteOrder = "artist-title" | "title-artist";

/**
 * 붙여넣은 목록을 곡 목록으로 바꾼다.
 * - 한 줄에 한 곡: "가수 - 제목" (순서는 order로 바꿀 수 있음). 구분자가 없으면 제목만 있는 것으로 본다.
 * - CSV: 첫 줄에 "Track Name"/"Artist Name(s)" 같은 머리글이 있으면 그 열을 쓴다 (Exportify 내보내기 형식).
 */
export function parsePastedList(text: string, order: PasteOrder = "artist-title"): Track[] {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) return [];
  const rows = looksLikeCsv(trimmed) ? fromCsv(trimmed) : fromLines(trimmed, order);
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const row of rows) {
    const title = collapseSpaces(row.title);
    const artists = row.artists.map(collapseSpaces).filter(Boolean);
    if (!compact(title)) continue;
    const id = `paste:${compact(artists.join(","))}|${compact(title)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    tracks.push({ id, source: "paste", title, artists });
  }
  return tracks;
}

interface Row {
  title: string;
  artists: string[];
}

const TITLE_HEADER = /^(track\s*name|title|song|곡\s*명|곡\s*제목|제목|노래)$/i;
const ARTIST_HEADER = /^(artist\s*name\(s\)|artist\s*names?|artists?|가수|아티스트)$/i;

function looksLikeCsv(text: string): boolean {
  const header = parseCsv(text.split(/\r?\n/, 1)[0] ?? "")[0] ?? [];
  return header.some((h) => TITLE_HEADER.test(h.trim())) && header.some((h) => ARTIST_HEADER.test(h.trim()));
}

function fromCsv(text: string): Row[] {
  const [header, ...records] = parseCsv(text);
  const titleCol = header.findIndex((h) => TITLE_HEADER.test(h.trim()));
  const artistCol = header.findIndex((h) => ARTIST_HEADER.test(h.trim()));
  return records.map((r) => ({
    title: r[titleCol] ?? "",
    // Exportify는 여러 가수를 쉼표로 이어 붙인다
    artists: (r[artistCol] ?? "").split(/\s*[,;]\s*/),
  }));
}

const SEPARATORS = [" - ", " – ", " — ", "\t", " / ", " | "];

function fromLines(text: string, order: PasteOrder): Row[] {
  const rows: Row[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(?:\d+[.)]\s+|[-*•·]\s+)/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const sep = SEPARATORS.find((s) => line.includes(s));
    if (!sep) {
      rows.push({ title: line, artists: [] });
      continue;
    }
    const idx = line.indexOf(sep);
    const left = line.slice(0, idx).trim();
    const right = line.slice(idx + sep.length).trim();
    rows.push(order === "artist-title" ? { title: right, artists: [left] } : { title: left, artists: [right] });
  }
  return rows;
}

/** 따옴표·이스케이프("")·따옴표 안 줄바꿈을 처리하는 작은 CSV 파서 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}
