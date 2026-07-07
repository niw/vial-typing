import "./StatBar.css";
import { engine } from "../lib/engine";
import { t } from "../lib/i18n";
import { isUnlimited, settings } from "../lib/settings";

export function StatBar() {
  const unlimited = isUnlimited();
  let timeText: string;
  let low = false;
  if (engine.running) {
    if (unlimited) {
      // Count up elapsed time; does not auto-end
      timeText = ((Date.now() - engine.startTime) / 1000).toFixed(1);
    } else {
      const rem = Math.max(0, engine.endTime - Date.now());
      timeText = (rem / 1000).toFixed(1);
      low = rem < 10000;
    }
  } else {
    timeText = unlimited ? "0.0" : settings.runSeconds.toFixed(1);
  }
  const min = engine.startTime ? (Date.now() - engine.startTime) / 60000 : 0;
  const wpm = min > 0 ? Math.round(engine.correct / 5 / min) : 0;
  const tot = engine.correct + engine.miss;
  const acc = tot ? Math.round((engine.correct / tot) * 100) : 100;
  return (
    <div className="statbar">
      <div className="stat time" id="stTimeWrap">
        <span className="lbl" id="stTimeLbl">
          {unlimited ? t("statbar.elapsed") : t("statbar.remaining")}
        </span>
        <b id="stTime" className={low ? "low" : ""}>
          {timeText}
        </b>
        {engine.bonusPops.map((id) => (
          <span key={id} className="bonus-pop">
            +1s
          </span>
        ))}
      </div>
      <div className="stat">
        <span className="lbl">WPM</span>
        <b id="stWpm">{wpm}</b>
      </div>
      <div className="stat">
        <span className="lbl">{t("statbar.accuracy")}</span>
        <b id="stAcc">{acc}%</b>
      </div>
      <div className="stat">
        <span className="lbl">{t("statbar.combo")}</span>
        <b id="stCombo">{engine.combo}</b>
      </div>
      <div className="stat">
        <span className="lbl">{t("statbar.miss")}</span>
        <b id="stMiss">{engine.miss}</b>
      </div>
    </div>
  );
}
