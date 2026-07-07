import "./Header.css";
import { useRef } from "react";
import { loadFileText, openBackupDialog, saveBackup } from "../lib/backup";
import { engine } from "../lib/engine";
import { connectHID } from "../lib/hid";
import { LOCALE_STORE_KEY, locale, t } from "../lib/i18n";
import { forgetSavedKeymap, hasSavedKeymap } from "../lib/kb";
import { isTauri } from "../lib/platform";
import { ui } from "../lib/store";

export function Header() {
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  return (
    <header>
      <h1>
        Vial <span>Typing</span>
      </h1>
      <div className="sub">{t("header.sub")}</div>
      <div className="actions">
        <div id="status" className={ui.status.cls}>
          {ui.status.text}
        </div>
        <button type="button" id="btnConnect" className="primary" onClick={() => void connectHID()}>
          {t("header.connect")}
        </button>
        <button type="button" id="btnVil" onClick={() => fileRef.current?.click()}>
          {t("header.openVil")}
        </button>
        <button
          type="button"
          id="btnForget"
          title={t("header.forgetTitle")}
          hidden={!hasSavedKeymap()}
          onClick={() => {
            forgetSavedKeymap();
            engine.idle();
          }}
        >
          {t("header.forget")}
        </button>
        <button type="button" id="btnSave" title={t("header.saveTitle")} onClick={() => void saveBackup()}>
          {t("header.save")}
        </button>
        <button
          type="button"
          id="btnRestore"
          title={t("header.restoreTitle")}
          onClick={() => (isTauri() ? void openBackupDialog() : backupRef.current?.click())}
        >
          {t("header.restore")}
        </button>
        <select
          id="selLang"
          className="lang-select"
          title={t("header.langTitle")}
          aria-label={t("header.langTitle")}
          value={locale}
          onChange={(e) => {
            try {
              localStorage.setItem(LOCALE_STORE_KEY, e.currentTarget.value);
            } catch {}
            location.reload();
          }}
        >
          <option value="en">{t("header.langEn")}</option>
          <option value="ja">{t("header.langJa")}</option>
        </select>
      </div>
      <input
        type="file"
        id="vilFile"
        accept=".vil,application/json"
        hidden
        ref={fileRef}
        onChange={(e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (f) f.text().then((t) => loadFileText(t, f.name));
          input.value = "";
        }}
      />
      <input
        type="file"
        id="backupFile"
        accept=".json,application/json"
        hidden
        ref={backupRef}
        onChange={(e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (f) f.text().then((t) => loadFileText(t, f.name));
          input.value = "";
        }}
      />
    </header>
  );
}
