import "./Toolbar.css";
import { audio } from "../lib/audio";
import { engine } from "../lib/engine";
import { type CourseId, guided, guidedRefreshJpCourse } from "../lib/guided";
import { t } from "../lib/i18n";
import { charCache, KB } from "../lib/kb";
import { applyRomajiStyle } from "../lib/romaji";
import { type RomajiStyle, saveSetting, settings } from "../lib/settings";
import { invalidate } from "../lib/store";

const MODES = [
  ["en", t("toolbar.modeEn")],
  ["jp", t("toolbar.modeJp")],
  ["sym", t("toolbar.modeSym")],
  ["vim", t("toolbar.modeVim")],
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
        <select
          id="selPlaystyle"
          className="mode-select select-playstyle"
          title={t("toolbar.keyMasteryTitle")}
          value={engine.guided ? "guided" : "normal"}
          onChange={(e) => setGuided(e.currentTarget.value === "guided")}
        >
          <option value="normal">{t("toolbar.normal")}</option>
          <option value="guided">{t("toolbar.keyMastery")}</option>
        </select>
      </div>
      <div className="ctrl-group">
        <span className="ctrl-label">{t("toolbar.practiceModeLabel")}</span>
        <select
          id="selMode"
          className="mode-select select-mode"
          value={engine.mode}
          onChange={(e) => setMode(e.currentTarget.value)}
        >
          {MODES.map(([mode, label]) => (
            <option key={mode} value={mode}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="ctrl-group">
        <span className="ctrl-label">{t("toolbar.playTimeLabel")}</span>
        <select
          id="selTime"
          className="mode-select select-time"
          value={settings.runSeconds}
          onChange={(e) => {
            const seconds = +e.currentTarget.value;
            settings.runSeconds = seconds;
            saveSetting("cornixTime", String(seconds));
            engine.idle();
          }}
        >
          {TIMES.map(([seconds, label]) => (
            <option key={seconds} value={seconds}>
              {label}
            </option>
          ))}
        </select>
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
