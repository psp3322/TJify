"use client";

import { useState } from "react";
import { insightEngine, settingsStore, updateSettings, type UserSettings } from "@/lib/client/settings";
import { useStoredValue } from "@/lib/client/stored-value";
import { PUBLIC_CONFIG } from "@/lib/config";
import { type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n/react";
import { DEFAULT_MODEL, INSIGHT_MODELS } from "@/lib/insights/models";
import { RichText } from "./RichText";

const linkClass = "underline underline-offset-2 hover:text-ink";

/**
 * 방문자가 직접 넣는 API 키. 이 사이트에는 서버가 없어서, 키가 필요한 기능은 방문자 브라우저가 그 키로 바로 부른다.
 * 키는 이 브라우저(localStorage)에만 저장된다.
 */
export function SettingsPanel() {
  const { t } = useT();
  const settings = useStoredValue(settingsStore);
  const engine = insightEngine(settings);
  const engineKey: MessageKey = !engine
    ? "settings.engine.off"
    : engine.provider === "claude"
      ? "settings.engine.claudeMine"
      : engine.source === "site"
        ? "settings.engine.geminiSite"
        : "settings.engine.geminiMine";
  const anySaved = Boolean(settings.geminiApiKey || settings.anthropicApiKey || settings.youtubeApiKey);

  return (
    <details id="settings" className="group rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden">
        <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
        {t("settings.title")}
        {anySaved && <span className="ml-2 text-xs font-normal text-ok">{t("settings.saved")}</span>}
      </summary>
      <div className="space-y-5 border-t border-line px-4 py-4 text-sm">
        <p className="text-xs text-muted">{t("settings.engineNow", { engine: t(engineKey) })}</p>

        <KeyField
          field="geminiApiKey"
          label={t("settings.gemini.label")}
          placeholder="AIza..."
          value={settings.geminiApiKey}
          help={
            <>
              {PUBLIC_CONFIG.geminiApiKey && <>{t("settings.gemini.siteKey")} </>}
              <RichText
                text={t("settings.gemini.help")}
                link={(label) => (
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={linkClass}>
                    {label}
                  </a>
                )}
              />
            </>
          }
        />

        <KeyField
          field="anthropicApiKey"
          label={t("settings.anthropic.label")}
          placeholder="sk-ant-..."
          value={settings.anthropicApiKey}
          help={
            <RichText
              text={t("settings.anthropic.help")}
              link={(label) => (
                <a href="https://platform.claude.com/" target="_blank" rel="noreferrer" className={linkClass}>
                  {label}
                </a>
              )}
            />
          }
        />
        {settings.anthropicApiKey && (
          <label className="flex flex-wrap items-center gap-2 text-muted">
            {t("settings.model")}
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
          label={t("settings.youtube.label")}
          placeholder="AIza..."
          value={settings.youtubeApiKey}
          help={PUBLIC_CONFIG.youtubeApiKey ? t("settings.youtube.siteKey") : t("settings.youtube.help")}
        />

        <p className="text-xs leading-relaxed text-muted">{t("settings.footer")}</p>
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
  field: keyof Pick<UserSettings, "geminiApiKey" | "anthropicApiKey" | "youtubeApiKey">;
  label: string;
  placeholder: string;
  value?: string;
  help: React.ReactNode;
}) {
  const { t } = useT();
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
          <code className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted">{t("settings.savedKey", { last4: value.slice(-4) })}</code>
          <button
            type="button"
            onClick={() => updateSettings({ [field]: undefined })}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink"
          >
            {t("settings.clear")}
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
            {t("settings.save")}
          </button>
        </form>
      )}
    </div>
  );
}
