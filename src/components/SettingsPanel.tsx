"use client";

import { useState } from "react";
import { settingsStore, updateSettings, type UserSettings } from "@/lib/client/settings";
import { useStoredValue } from "@/lib/client/stored-value";
import { PUBLIC_CONFIG } from "@/lib/config";
import { DEFAULT_MODEL, INSIGHT_MODELS } from "@/lib/insights/models";

/**
 * 방문자가 직접 넣는 API 키. 이 사이트에는 서버가 없어서, 키가 필요한 기능은 방문자 브라우저가 그 키로 바로 부른다.
 * 키는 이 브라우저(localStorage)에만 저장된다.
 */
export function SettingsPanel() {
  const settings = useStoredValue(settingsStore);
  const siteHasYoutubeKey = Boolean(PUBLIC_CONFIG.youtubeApiKey);

  return (
    <details id="settings" className="group rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden">
        <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
        설정 · 내 API 키
        {(settings.anthropicApiKey || settings.youtubeApiKey) && <span className="ml-2 text-xs font-normal text-ok">키 저장됨</span>}
      </summary>
      <div className="space-y-5 border-t border-line px-4 py-4 text-sm">
        <KeyField
          field="anthropicApiKey"
          label="Anthropic API 키 · 곡 난이도 자동 추정"
          placeholder="sk-ant-..."
          value={settings.anthropicApiKey}
          help={
            <>
              넣으면 Claude가 곡마다 난이도와 대중성을 추정해요. 20곡마다 한 번 요청하고 요금은 이 키의 계정에 청구돼요. 결과는 이 브라우저에 90일 동안
              남아서 같은 곡을 다시 묻지 않아요. 키는{" "}
              <a href="https://platform.claude.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                Claude Console
              </a>
              에서 만들 수 있어요.
            </>
          }
        />
        {settings.anthropicApiKey && (
          <label className="flex flex-wrap items-center gap-2 text-muted">
            추정에 쓸 모델
            <select
              value={settings.anthropicModel ?? DEFAULT_MODEL}
              onChange={(e) => updateSettings({ anthropicModel: e.target.value === DEFAULT_MODEL ? undefined : e.target.value })}
              className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-ink"
            >
              {INSIGHT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <KeyField
          field="youtubeApiKey"
          label="YouTube API 키 · 재생목록 링크 가져오기"
          placeholder="AIza..."
          value={settings.youtubeApiKey}
          help={
            siteHasYoutubeKey
              ? "이 사이트에 넣어 둔 키로도 가져올 수 있어요. 오늘 할당량을 다 써서 막혔을 때만 내 키를 넣으면 돼요."
              : "YouTube·YouTube Music 공개 재생목록을 가져오려면 필요해요. Google Cloud에서 YouTube Data API v3를 켜고 API 키를 만들어 넣어 주세요."
          }
        />

        <p className="text-xs leading-relaxed text-muted">
          키는 이 브라우저에만 저장되고, Anthropic·Google에 요청할 때만 써요. 이 사이트에는 따로 서버가 없어서 키가 다른 곳으로 가지 않아요. 여럿이 쓰는
          컴퓨터라면 다 쓴 뒤 지워 주세요.
        </p>
      </div>
    </details>
  );
}

function KeyField({
  field,
  label,
  placeholder,
  value,
  help,
}: {
  field: keyof Pick<UserSettings, "anthropicApiKey" | "youtubeApiKey">;
  label: string;
  placeholder: string;
  value?: string;
  help: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    updateSettings({ [field]: draft.trim() });
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <p className="font-medium">{label}</p>
      <p className="text-xs leading-relaxed text-muted">{help}</p>
      {value ? (
        <div className="flex items-center gap-2">
          <code className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted">저장됨 ····{value.slice(-4)}</code>
          <button
            type="button"
            onClick={() => updateSettings({ [field]: undefined })}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink"
          >
            지우기
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="flex gap-2">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-muted"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-bg hover:brightness-95">
            저장
          </button>
        </form>
      )}
    </div>
  );
}
