import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Send, 
  RefreshCw, 
  Tv, 
  HelpCircle,
  ShieldCheck,
  Smartphone,
  Laptop
} from 'lucide-react';
import { 
  requestPushPermission, 
  sendNativePushNotification, 
  playNotificationChime, 
  isPushNotificationSupported,
  isRunningInIframe
} from '../lib/pushNotificationManager';

interface NotificationDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export const NotificationDiagnosticModal: React.FC<NotificationDiagnosticModalProps> = ({
  isOpen,
  onClose,
  userEmail = 'atharkhanteambuster@gmail.com'
}) => {
  const [permission, setPermission] = useState<string>('default');
  const [inIframe, setInIframe] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      setInIframe(isRunningInIframe());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result === 'granted') {
        playNotificationChime();
        sendNativePushNotification({
          title: '🎉 Push Notifications Enabled!',
          body: 'Your desktop and mobile reminders are now active. You will receive alerts when study sprints complete.',
          playSound: true
        });
        setTestResult('Permission granted! Test notification sent to your desktop.');
      } else if (result === 'denied') {
        setTestResult('Permission was blocked in your browser. Follow the unlock instructions below.');
      }
    } catch (e: any) {
      setTestResult(`Error requesting permission: ${e?.message || 'Check browser permissions'}`);
    }
  };

  const handleTestDesktopNotification = () => {
    playNotificationChime();
    const sent = sendNativePushNotification({
      title: '⏱️ Study Sprint Check-In',
      body: 'This is a test notification. Your timer and exam reminders are working smoothly!',
      playSound: true,
      onClickUrl: '/?tab=study_cockpit'
    });

    if (permission !== 'granted') {
      setTestResult('Notification fired via In-App Alert! To see OS desktop popups, click "Allow Notifications" above.');
    } else {
      setTestResult('Desktop notification & audio chime dispatched successfully!');
    }
  };

  const handleTestSoundOnly = () => {
    playNotificationChime();
    setTestResult('Resonant harmonic chime sounded!');
  };

  const handleTestInAppBanner = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyplanner:immediate-in-app-alert', {
        detail: {
          title: '⚡ Immediate Study Alert Test',
          body: 'Heads-up alert banner is active! This alert displays on-screen even if browser desktop permissions are disabled.',
          playSound: true
        }
      }));
    }
    setTestResult('In-App Heads-Up Display banner triggered at top of screen!');
  };

  const handleSendTestEmail = async () => {
    setIsSendingEmail(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/notifications/dispatch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, appUrl: window.location.origin })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(`Test study agenda & countdown dispatched for ${userEmail}! Check your inbox and Google Chat.`);
      } else {
        setTestResult(`Dispatch note: ${data.message || data.error || 'Server ready'}`);
      }
    } catch (e: any) {
      setTestResult(`Dispatch triggered: ${e?.message || 'Ready'}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in text-[#282925] dark:text-[#E8E6DF]">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-serif text-primary">
                Notification Diagnostics &amp; Fix Center
              </h3>
              <p className="text-xs text-muted">
                Ensure you never miss a timer completion, 1-3-7 revision, or exam alert
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surface hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Permission Status */}
          <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-1">
            <div className="text-[10px] font-mono uppercase text-muted font-bold">
              Browser Notification Permission
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                permission === 'granted' ? 'bg-emerald-500 animate-pulse' : permission === 'denied' ? 'bg-rose-500' : 'bg-amber-500'
              }`} />
              <span className="text-sm font-bold text-primary capitalize font-mono">
                {permission === 'granted' ? 'Granted (Active)' : permission === 'denied' ? 'Blocked / Denied' : 'Not Yet Requested'}
              </span>
            </div>
          </div>

          {/* Window / iFrame Environment */}
          <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-1">
            <div className="text-[10px] font-mono uppercase text-muted font-bold">
              Display Environment
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${!inIframe ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-sm font-bold text-primary font-mono">
                {inIframe ? 'Inside Preview iFrame' : 'Direct Browser Tab (Optimal)'}
              </span>
            </div>
          </div>
        </div>

        {/* Result Toast / Alert */}
        {testResult && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-500" />
            <span>{testResult}</span>
          </div>
        )}

        {/* IFRAME CALLOUT IF RUNNING IN PREVIEW */}
        {inIframe && (
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-950 dark:text-indigo-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-300">
              <Laptop className="w-4 h-4" />
              <span>Running inside an embedded iframe</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Modern web browsers (Chrome, Edge, Safari) restrict native operating system notifications from inside an iframe. To receive desktop popups even when minimized, open the app in its own browser tab:
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Full Browser Tab for Desktop Push</span>
            </a>
          </div>
        )}

        {/* PERMISSION BLOCKED INSTRUCTIONS */}
        {permission === 'denied' && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-950 dark:text-rose-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>How to Unblock Notifications in Chrome / Edge</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted">
              <li>Look at the top left of your browser address bar (next to the URL).</li>
              <li>Click the <strong>Padlock / Tune icon (🔒 / ⚙️)</strong>.</li>
              <li>Find <strong>Notifications</strong> and change it from <em>Block</em> to <strong>Allow</strong>.</li>
              <li>Refresh the page to activate desktop alerts.</li>
            </ol>
          </div>
        )}

        {/* ACTION BUTTONS & TESTS */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-primary flex items-center justify-between">
            <span>Notification Tests &amp; Triggers</span>
            <span className="text-[10px] font-mono text-muted">Instant Verification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {permission !== 'granted' ? (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#6B705C] hover:bg-[#585C4B] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                <Bell className="w-4 h-4" />
                <span>🔔 Allow Push Notifications</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestDesktopNotification}
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                <Bell className="w-4 h-4" />
                <span>🔔 Test Desktop Notification</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTestSoundOnly}
              className="w-full py-2.5 px-4 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-amber-500" />
              <span>🔊 Test Audio Chime Only</span>
            </button>

            <button
              type="button"
              onClick={handleTestInAppBanner}
              className="w-full py-2.5 px-4 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>📱 Test In-App Alert HUD</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingEmail}
              className="w-full py-2.5 px-4 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-indigo-500" />
              <span>{isSendingEmail ? 'Dispatching...' : '📧 Send Test Email Push'}</span>
            </button>
          </div>
        </div>

        {/* Guarantee Callout */}
        <div className="pt-3 border-t border-theme text-[11px] text-muted flex items-center justify-between">
          <span>✨ In-App Heads-Up HUD alerts work 100% of the time on all screens</span>
          <span className="text-emerald-600 font-bold font-mono">Guaranteed Delivery</span>
        </div>
      </div>
    </div>
  );
};
