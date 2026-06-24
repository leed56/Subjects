"use client";

import { useAcInAppAlerts } from "@/hooks/use-ac-in-app-alerts";
import { useLocale } from "@/lib/i18n/locale-provider";

export function AcInAppAlertSettings() {
  const { t } = useLocale();
  const { enabled, prefs, updatePrefs } = useAcInAppAlerts();

  if (!enabled) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-black text-slate-900">{t("ac_alerts.settings_title")}</h2>
      <p className="mt-1 text-xs font-medium text-slate-500">
        {t("ac_alerts.settings_hint")}
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={prefs.overdue}
            onChange={(event) =>
              updatePrefs({ ...prefs, overdue: event.target.checked })
            }
            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">
              {t("ac_alerts.toggle_overdue")}
            </span>
            <span className="block text-xs text-slate-500">
              {t("ac_alerts.toggle_overdue_hint")}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={prefs.dueToday}
            onChange={(event) =>
              updatePrefs({ ...prefs, dueToday: event.target.checked })
            }
            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">
              {t("ac_alerts.toggle_today")}
            </span>
            <span className="block text-xs text-slate-500">
              {t("ac_alerts.toggle_today_hint")}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={prefs.upcoming}
            onChange={(event) =>
              updatePrefs({ ...prefs, upcoming: event.target.checked })
            }
            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-800">
              {t("ac_alerts.toggle_upcoming")}
            </span>
            <span className="block text-xs text-slate-500">
              {t("ac_alerts.toggle_upcoming_hint")}
            </span>
            {prefs.upcoming && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-600">{t("ac_alerts.days_before")}</span>
                <select
                  value={prefs.upcomingDays}
                  onChange={(event) =>
                    updatePrefs({
                      ...prefs,
                      upcomingDays: Number(event.target.value),
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold"
                >
                  {[1, 2, 3, 5, 7, 14].map((days) => (
                    <option key={days} value={days}>
                      {days}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </span>
        </label>
      </div>
    </section>
  );
}
