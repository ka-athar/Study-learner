import React, { useState, useEffect } from 'react';
import { Bell, X, Zap, CheckCircle2, ChevronRight, Play, Volume2 } from 'lucide-react';
import { PushNotificationPayload } from '../lib/pushNotificationManager';

interface ImmediateAlertHUDProps {
  onNavigateToCockpit?: () => void;
  onStartTimer?: (minutes: number) => void;
}

export const ImmediateAlertHUD: React.FC<ImmediateAlertHUDProps> = ({
  onNavigateToCockpit,
  onStartTimer
}) => {
  const [activeAlert, setActiveAlert] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    const handleAlert = (e: any) => {
      const payload: PushNotificationPayload = e.detail;
      if (!payload) return;
      setActiveAlert(payload);
    };

    window.addEventListener('studyplanner:immediate-in-app-alert', handleAlert);
    return () => {
      window.removeEventListener('studyplanner:immediate-in-app-alert', handleAlert);
    };
  }, []);

  // Auto-dismiss after 14 seconds
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(() => {
      setActiveAlert(null);
    }, 14000);
    return () => clearTimeout(timer);
  }, [activeAlert]);

  if (!activeAlert) return null;

  return (
    <aside
      aria-label="Study alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-lg animate-bounce-short pointer-events-auto"
    >
      <div className="bg-[#1C1D1A]/98 text-white rounded-3xl p-4 sm:p-5 shadow-2xl border-2 border-amber-500/70 ring-4 ring-amber-500/20 backdrop-blur-md flex items-start gap-3.5 relative overflow-hidden">
        {/* Pulsing Accent Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500 animate-pulse" />

        {/* Pulsing Bell Icon */}
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-5 h-5 animate-wiggle" />
        </div>

        {/* Alert Content */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/25">
              Immediate Study Alert
            </span>
            <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-emerald-400" />
              <span>Chime Sounded</span>
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-bold font-serif text-white truncate leading-tight">
            {activeAlert.title}
          </h3>

          <p className="text-xs text-stone-300 mt-1 leading-relaxed">
            {activeAlert.body}
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-white/10">
            {onNavigateToCockpit && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToCockpit();
                  setActiveAlert(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#585C4B] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>Open Study Cockpit</span>
              </button>
            )}

            {onStartTimer && (
              <button
                type="button"
                onClick={() => {
                  onStartTimer(5);
                  setActiveAlert(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <Play className="w-3 h-3 fill-current text-emerald-400" />
                <span>Start 5m Break</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveAlert(null)}
              className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-white/10 text-stone-400 hover:text-white text-xs font-medium transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setActiveAlert(null)}
          className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-stone-400 hover:text-white transition shrink-0 cursor-pointer"
          title="Dismiss Alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
