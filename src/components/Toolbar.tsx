import "./Toolbar.css";
import { audio } from "../lib/audio";
import { engine } from "../lib/engine";
import { type CourseId, guided, guidedRefreshJpCourse } from "../lib/guided";
import { LOCALE_STORE_KEY, locale, t } from "../lib/i18n";
import { charCache, KB } from "../lib/kb";
import { applyRomajiStyle } from "../lib/romaji";
import { type RomajiStyle, saveSetting, settings } from "../lib/settings";
import { invalidate } from "../lib/store";

const MODES = [
  ["en", t("toolbar.modeEn")],
  ["jp", t("toolbar.modeJp")],
  ["sym", t("toolbar.modeSym")],
  ["mix", t("toolbar.modeMix")],
] as const;

const TIMES = [
  [30, t("toolbar.time30")],
  [60, t("toolbar.time60")],
  [90, t("toolbar.time90")],
  [0, t("toolbar.unlimited")],
] as const;

export function Toolbar() {
  return (
    <div className="toolbar">
      <div className="ctrl-group">
        <span className="ctrl-label">{t("toolbar.modeLabel")}</span>
        <div className="playstyle">
          <button type="button" className={engine.guided ? "" : "active"} onClick={() => setGuided(false)}>
            {t("toolbar.normal")}
          </button>
          <button
            type="button"
            className={engine.guided ? "active" : ""}
            title={t("toolbar.keyMasteryTitle")}
            onClick={() => setGuided(true)}
          >
            {t("toolbar.keyMastery")}
          </button>
        </div>
      </div>
      <div className="ctrl-group">
        <span className="ctrl-label">{t("toolbar.practiceModeLabel")}</span>
        <div className="modes">
          {MODES.map(([mode, label]) => (
            <button
              type="button"
              key={mode}
              className={engine.mode === mode ? "active" : ""}
              onClick={() => setMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="ctrl-group">
        <span className="ctrl-label">{t("toolbar.playTimeLabel")}</span>
        <div className="times">
          {TIMES.map(([seconds, label]) => (
            <button
              type="button"
              key={seconds}
              className={settings.runSeconds === seconds ? "active" : ""}
              onClick={() => {
                settings.runSeconds = seconds;
                saveSetting("cornixTime", String(seconds));
                engine.idle();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="ctrl-group settings">
        <span className="ctrl-label">{t("toolbar.settingsLabel")}</span>
        <div className="settings-row">
          <button
            type="button"
            id="btnSound"
            title={t("toolbar.soundTitle")}
            onClick={() => {
              settings.soundOn = !settings.soundOn;
              saveSetting("cornixSound", settings.soundOn ? "1" : "0");
              invalidate();
              if (settings.soundOn) audio.play("type"); // confirmation blip
            }}
          >
            {settings.soundOn ? t("toolbar.soundOn") : t("toolbar.soundOff")}
          </button>
          <label className="pref" title={t("toolbar.outTitle")}>
            {t("toolbar.outLabel")}
            <select
              id="selOut"
              value={settings.outMode}
              onChange={(e) => {
                settings.outMode = e.currentTarget.value as "us" | "jis";
                saveSetting("cornixOutMode", settings.outMode);
                charCache.clear();
                invalidate();
              }}
            >
              <option value="us">{t("toolbar.outUs")}</option>
              <option value="jis">{t("toolbar.outJis")}</option>
            </select>
          </label>
          <label className="pref" title={t("toolbar.prefTitle")}>
            {t("toolbar.prefLabel")}
            <select
              id="selPref"
              value={settings.keyPref}
              onChange={(e) => {
                settings.keyPref = e.currentTarget.value as typeof settings.keyPref;
                saveSetting("cornixPref", settings.keyPref);
                charCache.clear(); // recompute guidance with the new preference
                invalidate();
              }}
            >
              <option value="auto">{t("toolbar.prefAuto")}</option>
              <option value="shift">{t("toolbar.prefShift")}</option>
              <option value="layer">{t("toolbar.prefLayer")}</option>
            </select>
          </label>
          <label className="pref" title={t("toolbar.romajiTitle")}>
            {t("toolbar.romajiLabel")}
            <select
              id="selRomaji"
              value={settings.romajiStyle}
              onChange={(e) => {
                settings.romajiStyle = e.currentTarget.value as RomajiStyle;
                saveSetting("cornixRomaji", settings.romajiStyle);
                applyRomajiStyle(settings.romajiStyle);
                guidedRefreshJpCourse();
                engine.idle(); // reset the run since its words are stuck with the old spelling
              }}
            >
              <option value="hepburn">{t("toolbar.romajiHepburn")}</option>
              <option value="kunrei">{t("toolbar.romajiKunrei")}</option>
            </select>
          </label>
          <LayerPrefSelect
            id="selNumLayer"
            prefKey="num"
            store="cornixNumLayer"
            label={t("toolbar.numLabel")}
            title={t("toolbar.numTitle")}
          />
          <LayerPrefSelect
            id="selSymLayer"
            prefKey="sym"
            store="cornixSymLayer"
            label={t("toolbar.symLabel")}
            title={t("toolbar.symTitle")}
          />
          <label className="pref" title={t("toolbar.langTitle")}>
            {t("toolbar.langLabel")}
            <select
              id="selLang"
              value={locale}
              onChange={(e) => {
                try {
                  localStorage.setItem(LOCALE_STORE_KEY, e.currentTarget.value);
                } catch {}
                location.reload();
              }}
            >
              <option value="en">{t("toolbar.langEn")}</option>
              <option value="ja">{t("toolbar.langJa")}</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function setGuided(on: boolean) {
  engine.guided = on;
  engine.idle();
}

function setMode(mode: string) {
  engine.mode = mode;
  if (mode !== "mix" && guided.course !== mode) {
    // Auto-switch the displayed course to match the practice mode
    guided.course = mode as CourseId;
    guided.selected = null;
  }
  engine.idle();
}

function LayerPrefSelect({
  id,
  prefKey,
  store,
  label,
  title,
}: {
  id: string;
  prefKey: "num" | "sym";
  store: string;
  label: string;
  title: string;
}) {
  return (
    <label className="pref" title={title}>
      {label}
      <select
        id={id}
        value={settings.layerPref[prefKey]}
        onChange={(e) => {
          settings.layerPref[prefKey] = e.currentTarget.value;
          saveSetting(store, settings.layerPref[prefKey]);
          charCache.clear();
          invalidate();
        }}
      >
        <option value="auto">{t("toolbar.layerAuto")}</option>
        {Array.from({ length: KB.layerCount }, (_, i) => (
          <option key={i} value={String(i)}>
            L{i}
          </option>
        ))}
      </select>
    </label>
  );
}
