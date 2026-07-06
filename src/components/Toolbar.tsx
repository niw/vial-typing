import "./Toolbar.css";
import { audio } from "../lib/audio";
import { engine } from "../lib/engine";
import { type CourseId, guided, guidedRefreshJpCourse } from "../lib/guided";
import { charCache, KB } from "../lib/kb";
import { applyRomajiStyle } from "../lib/romaji";
import { type RomajiStyle, saveSetting, settings } from "../lib/settings";
import { invalidate } from "../lib/store";

const MODES = [
  ["en", "英単語・英文"],
  ["jp", "日本語ローマ字"],
  ["sym", "記号・レイヤー"],
  ["mix", "ミックス"],
] as const;

const TIMES = [
  [30, "30秒"],
  [60, "60秒"],
  [90, "90秒"],
  [0, "無制限"],
] as const;

export function Toolbar() {
  return (
    <div className="toolbar">
      <div className="ctrl-group">
        <span className="ctrl-label">モード</span>
        <div className="playstyle">
          <button type="button" className={engine.guided ? "" : "active"} onClick={() => setGuided(false)}>
            通常
          </button>
          <button
            type="button"
            className={engine.guided ? "active" : ""}
            title="タイピング履歴に応じてキーを解放し、解放済みキーだけで打てるお題を出す"
            onClick={() => setGuided(true)}
          >
            キー習得
          </button>
        </div>
      </div>
      <div className="ctrl-group">
        <span className="ctrl-label">練習モード</span>
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
        <span className="ctrl-label">プレイ時間</span>
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
        <span className="ctrl-label">設定</span>
        <div className="settings-row">
          <button
            type="button"
            id="btnSound"
            title="効果音のON/OFF"
            onClick={() => {
              settings.soundOn = !settings.soundOn;
              saveSetting("cornixSound", settings.soundOn ? "1" : "0");
              invalidate();
              if (settings.soundOn) audio.play("type"); // confirmation blip
            }}
          >
            {settings.soundOn ? "🔊 音あり" : "🔇 音なし"}
          </button>
          <label
            className="pref"
            title="文字の出方の解釈。『US互換』= OSがUS設定で変換なし、またはOSがJIS設定でファームウェアがUS刻印通りに変換する場合。『JIS互換』= OSがJIS設定で変換なし、またはOSがUS設定でファームウェアがJIS刻印通りに変換する場合"
          >
            配列
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
              <option value="us">US互換</option>
              <option value="jis">JIS互換</option>
            </select>
          </label>
          <label className="pref" title="同じ文字を複数の方法で入力できる場合に、どの打ち方を案内するか">
            入力案内
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
              <option value="auto">自動（おすすめ）</option>
              <option value="shift">Shift優先</option>
              <option value="layer">レイヤー優先</option>
            </select>
          </label>
          <label className="pref" title="日本語ローマ字の案内に使う綴り。どちらのスタイルの綴りでも入力はできます">
            ローマ字
            <select
              id="selRomaji"
              value={settings.romajiStyle}
              onChange={(e) => {
                settings.romajiStyle = e.currentTarget.value as RomajiStyle;
                saveSetting("cornixRomaji", settings.romajiStyle);
                applyRomajiStyle(settings.romajiStyle);
                guidedRefreshJpCourse();
                engine.idle(); // 走行中の単語は古い綴りのままなので仕切り直す
              }}
            >
              <option value="hepburn">ヘボン式</option>
              <option value="kunrei">訓令式</option>
            </select>
          </label>
          <LayerPrefSelect
            id="selNumLayer"
            prefKey="num"
            store="cornixNumLayer"
            label="数字"
            title="数字をどのレイヤーで打つかを固定する"
          />
          <LayerPrefSelect
            id="selSymLayer"
            prefKey="sym"
            store="cornixSymLayer"
            label="記号"
            title="記号をどのレイヤーで打つかを固定する"
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
    // 練習モードに対応するコース表示へ自動で切り替える
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
        <option value="auto">自動</option>
        {Array.from({ length: KB.layerCount }, (_, i) => (
          <option key={i} value={String(i)}>
            L{i}
          </option>
        ))}
      </select>
    </label>
  );
}
