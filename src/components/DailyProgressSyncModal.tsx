import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Flame, 
  BookOpen, 
  Copy, 
  Check, 
  Camera, 
  Share2, 
  Send, 
  Layers, 
  AlertCircle,
  Mail,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { StudySession, StudyPlan, UserProfile } from '../types';
import { generateTransferPin, redeemTransferPin } from '../lib/deviceService';
import { sendDailyCompletedWorkEmail } from '../lib/gmailService';

interface DailyProgressSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: StudySession[];
  plans: StudyPlan[];
  userProfile: UserProfile | null;
  onOpenQRScanner: () => void;
  onImportTodayProgress?: (data: any) => Promise<void> | void;
}

export const DailyProgressSyncModal: React.FC<DailyProgressSyncModalProps> = ({
  isOpen,
  onClose,
  sessions,
  plans,
  userProfile,
  onOpenQRScanner,
  onImportTodayProgress
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'manual_paste'>('export');
  const [transferPin, setTransferPin] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLinkCopied, setIsLinkCopied] = useState<boolean>(false);
  const [isSummaryCopied, setIsSummaryCopied] = useState<boolean>(false);
  const [manualJsonInput, setManualJsonInput] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ message: string; success: boolean } | null>(null);

  // Email report state
  const [targetEmail, setTargetEmail] = useState<string>(
    userProfile?.email || 'atharkhanteambuster@gmail.com'
  );
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.date === todayStr);
  const todayMinutes = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const todayHours = Number((todayMinutes / 60).toFixed(1));
  const todayPlans = plans.filter(p => p.date === todayStr);

  // Construct daily progress payload
  const progressPayload = useMemo(() => ({
    type: 'DAILY_PROGRESS_TRANSFER',
    date: todayStr,
    timestamp: Date.now(),
    todayMinutes,
    todayHours,
    studyStreak: userProfile?.studyStreak || 1,
    sessions: todaySessions,
    plans: todayPlans,
    studentName: userProfile?.displayName || 'Student'
  }), [todayStr, todayMinutes, todayHours, userProfile, todaySessions, todayPlans]);

  const payloadString = JSON.stringify(progressPayload);

  // Dynamically resolve live application URL with fallback to public Cloud Run domain
  const currentOrigin = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin 
    : '';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Base64 encoded payload for self-contained instant iPad sync
  const encodedPayload = useMemo(() => {
    try {
      const compactPayload = {
        type: 'DAILY_PROGRESS_TRANSFER',
        date: todayStr,
        timestamp: Date.now(),
        todayMinutes,
        todayHours,
        studyStreak: userProfile?.studyStreak || 1,
        studentName: userProfile?.displayName || 'Student',
        sessions: todaySessions.map(s => ({
          id: s.id,
          subjectName: s.subjectName,
          topicName: s.topicName,
          durationMinutes: s.durationMinutes,
          startTime: s.startTime,
          endTime: s.endTime,
          date: s.date,
          notes: s.notes
        })),
        plans: todayPlans.map(p => ({
          id: p.id,
          date: p.date,
          topics: p.topics
        }))
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(compactPayload))));
    } catch {
      return '';
    }
  }, [todayStr, todayMinutes, todayHours, userProfile, todaySessions, todayPlans]);

  // Guaranteed public base domain: when on localhost or internal iframe, fallback to live Cloud Run app
  const cleanBaseUrl = useMemo(() => {
    const isLocal = !currentOrigin || currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');
    const domain = isLocal
      ? 'https://ais-pre-af73hcwbkbncwkbutixe6a-304783015553.asia-southeast1.run.app'
      : currentOrigin;
    return `${domain}${currentPath}`;
  }, [currentOrigin, currentPath]);

  // Crisp, low-density QR code URL (scans in 0.1s on any iPad / iPhone / Android camera)
  const qrTransferUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (transferPin) {
      params.set('transfer_code', transferPin);
      params.set('pin', transferPin);
      params.set('code', transferPin);
    }
    params.set('action', 'daily_sync');
    params.set('today_hours', String(todayHours));
    params.set('today_minutes', String(todayMinutes));
    params.set('streak', String(userProfile?.studyStreak || 1));
    return `${cleanBaseUrl}?${params.toString()}`;
  }, [cleanBaseUrl, transferPin, todayHours, todayMinutes, userProfile]);

  // Full direct link containing both query params and hash fallback for 100% offline payload
  const directShareLink = useMemo(() => {
    return `${qrTransferUrl}${encodedPayload ? `#daily_data=${encodedPayload}` : ''}`;
  }, [qrTransferUrl, encodedPayload]);

  // Auto-generate PIN on open
  useEffect(() => {
    if (isOpen) {
      handleGeneratePin();
      setEmailStatus(null);
    }
  }, [isOpen]);

  const handleGeneratePin = async () => {
    setIsGenerating(true);
    try {
      const res = await generateTransferPin(
        userProfile?.uid || 'device_sync',
        userProfile?.email || targetEmail || 'student@studyos.app',
        progressPayload
      );
      setTransferPin(res.code);
    } catch (e) {
      // Fallback 6-digit random code
      const fallbackPin = Math.floor(100000 + Math.random() * 900000).toString();
      setTransferPin(fallbackPin);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyDirectLink = () => {
    navigator.clipboard.writeText(directShareLink);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };

  const handleCopySummary = () => {
    const summaryText = `📚 StudyOS Daily Progress & Time Log (${todayStr})\n` +
      `⏱️ Delivered Time: ${todayHours} hrs (${todayMinutes} mins)\n` +
      `🔥 Active Streak: ${userProfile?.studyStreak || 1} days\n` +
      `📋 Completed Sessions: ${todaySessions.length}\n` +
      (transferPin ? `🔑 iPad Sync PIN: ${transferPin}\n` : '') +
      `🔗 1-Click iPad Sync Link:\n${directShareLink}`;
    navigator.clipboard.writeText(summaryText);
    setIsSummaryCopied(true);
    setTimeout(() => setIsSummaryCopied(false), 2000);
  };

  // Immediate Email Dispatch for Today's Delivered Hours & Logs
  const handleSendEmailReport = async () => {
    if (!targetEmail.includes('@')) {
      setEmailStatus('Please enter a valid email address.');
      return;
    }
    setIsSendingEmail(true);
    setEmailStatus(null);

    const emailBody = `Today's Delivered Study Time: ${todayHours} hrs (${todayMinutes} mins)\n` +
      `Date: ${todayStr}\n` +
      `Study Streak: ${userProfile?.studyStreak || 1} days\n` +
      `Sessions Completed: ${todaySessions.length}\n\n` +
      `Study Sessions:\n` +
      (todaySessions.length > 0 
        ? todaySessions.map((s, i) => `${i + 1}. [${s.subjectName}] ${s.topicName} — ${s.durationMinutes}m (${s.startTime || '—'} to ${s.endTime || '—'}) ${s.notes ? `\n   Takeaway: ${s.notes}` : ''}`).join('\n')
        : '• No sessions recorded yet today.') +
      (transferPin ? `\n\n6-Digit iPad Sync PIN: ${transferPin}` : '') +
      `\n\n1-Click iPad Sync Link (Works without logging in):\n${directShareLink}`;

    try {
      // Attempt 1: Gmail API
      await sendDailyCompletedWorkEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.displayName || 'Student',
        dateStr: todayStr,
        totalStudyMinutes: todayMinutes,
        todaySessions: todaySessions,
        completedTopics: todayPlans.flatMap(p => p.topics.filter(t => t.completed)).map(t => ({
          subjectName: t.subjectName || 'Study',
          topicName: t.topicName,
          timeSpentMinutes: t.plannedDurationMinutes || 45,
          notes: t.completionDetails || 'Completed'
        })),
        userProfile
      });
      setEmailStatus(`✅ Study report sent to ${targetEmail} via Gmail!`);
    } catch (gErr) {
      // Fallback 2: Mailto client
      const mailto = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(`StudyOS Report: ${todayHours}h Delivered on ${todayStr}`)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailto, '_blank');
      setEmailStatus(`📧 Prepared study log in your email client for ${targetEmail}!`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleManualImport = async () => {
    const input = manualJsonInput.trim();
    if (!input) return;

    // 1. Extract 6-digit PIN anywhere in text (e.g. "PIN: 542198" or "542198" or "TIME-542198")
    const pinMatch = input.match(/\b\d{6}\b/);
    const cleanPin = pinMatch ? pinMatch[0] : input.replace(/[^0-9]/g, '');

    // Check if user entered or pasted a 6-digit numeric PIN
    if (cleanPin.length === 6) {
      try {
        setImportStatus({ message: 'Looking up PIN ' + cleanPin + '...', success: true });
        const res = await redeemTransferPin(cleanPin, { forcePull: true });
        if (res.success && res.payload) {
          if (onImportTodayProgress) {
            await onImportTodayProgress(res.payload);
          }
          setImportStatus({
            message: `🎉 Connected! Imported ${(res.payload.todayMinutes || 0) / 60} hrs from remote device.`,
            success: true
          });
          setTimeout(() => onClose(), 1500);
          return;
        } else {
          // If Firestore didn't have PIN doc, check if input also had embedded hours/mins
          const hoursMatch = input.match(/(?:hours|hrs|today_hours)=([\d.]+)/i);
          const minsMatch = input.match(/(?:mins|minutes|today_minutes)=(\d+)/i);
          if (hoursMatch || minsMatch) {
            const h = hoursMatch ? Number(hoursMatch[1]) : 0;
            const m = minsMatch ? Number(minsMatch[1]) : Math.round(h * 60);
            if (onImportTodayProgress) {
              await onImportTodayProgress({
                type: 'DAILY_PROGRESS_TRANSFER',
                todayHours: h,
                todayMinutes: m,
                studyStreak: 1,
                sessions: [{
                  id: `sess-import-${Date.now()}`,
                  subjectName: 'Study Session',
                  topicName: 'Imported Delivered Hours',
                  durationMinutes: m,
                  date: todayStr,
                  notes: `Transferred via PIN ${cleanPin}`
                }]
              });
              setImportStatus({
                message: `🎉 Imported ${h || (m / 60).toFixed(1)} hrs delivered!`,
                success: true
              });
              setTimeout(() => onClose(), 1500);
              return;
            }
          }
          setImportStatus({
            message: res.message || 'PIN not found or expired.',
            success: false
          });
          return;
        }
      } catch (pinErr: any) {
        setImportStatus({
          message: `PIN lookup error: ${pinErr.message}`,
          success: false
        });
        return;
      }
    }

    // 2. Check if user pasted a link or hash containing daily_data
    if (input.includes('daily_data=') || input.includes('payload=')) {
      try {
        const rawEncoded = input.includes('daily_data=')
          ? input.split('daily_data=')[1].split('&')[0]
          : input.split('payload=')[1].split('&')[0];
        const decoded = JSON.parse(decodeURIComponent(escape(atob(rawEncoded))));
        if (onImportTodayProgress) {
          await onImportTodayProgress(decoded);
        }
        setImportStatus({
          message: `🎉 Synced from link! Imported ${(decoded.todayMinutes || 0) / 60} hrs and ${decoded.sessions?.length || 0} sessions.`,
          success: true
        });
        setTimeout(() => onClose(), 1500);
        return;
      } catch (linkErr) {}
    }

    // 3. Check if user pasted URL with hours / mins query params
    if (input.includes('hours=') || input.includes('today_hours=') || input.includes('action=daily_sync')) {
      try {
        const url = new URL(input.startsWith('http') ? input : `https://studyos.local/${input}`);
        const h = Number(url.searchParams.get('today_hours') || url.searchParams.get('hours') || 0);
        const m = Number(url.searchParams.get('today_minutes') || url.searchParams.get('mins') || (h * 60));
        const streak = Number(url.searchParams.get('streak') || 1);
        if (h > 0 || m > 0) {
          if (onImportTodayProgress) {
            await onImportTodayProgress({
              type: 'DAILY_PROGRESS_TRANSFER',
              todayHours: h,
              todayMinutes: m,
              studyStreak: streak,
              sessions: [{
                id: `sess-url-${Date.now()}`,
                subjectName: 'Study Session',
                topicName: 'Transferred Study Hours',
                durationMinutes: m,
                date: todayStr,
                notes: 'Transferred from iPad/device link'
              }]
            });
          }
          setImportStatus({
            message: `🎉 Synced from link! Imported ${h || (m / 60).toFixed(1)} delivered study hours.`,
            success: true
          });
          setTimeout(() => onClose(), 1500);
          return;
        }
      } catch (uErr) {}
    }

    // 4. Check if user pasted raw base64 string
    if (input.startsWith('eyJ') && input.length > 20) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(input))));
        if (onImportTodayProgress) {
          await onImportTodayProgress(decoded);
        }
        setImportStatus({
          message: `🎉 Imported ${(decoded.todayMinutes || 0) / 60} hrs from encoded data!`,
          success: true
        });
        setTimeout(() => onClose(), 1500);
        return;
      } catch (bErr) {}
    }

    try {
      const parsed = JSON.parse(input);
      if (onImportTodayProgress) {
        await onImportTodayProgress(parsed);
      }
      setImportStatus({
        message: `Successfully imported ${parsed.sessions?.length || 0} sessions and ${parsed.todayMinutes || 0} minutes!`,
        success: true
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      setImportStatus({
        message: `Invalid format: Please enter a 6-digit PIN (e.g. 542198), a sync link, or progress JSON.`,
        success: false
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-primary space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-primary">Cross-Device Progress & Hours Sync</h3>
              <p className="text-[11px] text-muted">Transfer delivered study time & logs to iPad, phone, or laptop</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Today's Metrics Highlight */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-surface border border-theme text-center">
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-primary" /> Delivered Time
            </span>
            <span className="text-base font-mono font-bold text-primary">{todayHours} hrs</span>
            <span className="text-[10px] text-muted block">({todayMinutes} mins)</span>
          </div>
          <div className="space-y-0.5 border-x border-theme">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider flex items-center justify-center gap-1">
              <BookOpen className="w-3 h-3 text-emerald-600" /> Sessions
            </span>
            <span className="text-base font-mono font-bold text-primary">{todaySessions.length} done</span>
            <span className="text-[10px] text-muted block">{todayPlans.length} plans</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" /> Streak
            </span>
            <span className="text-base font-mono font-bold text-primary">{userProfile?.studyStreak || 1} days</span>
            <span className="text-[10px] text-emerald-600 font-bold block">Active</span>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-surface p-1 border border-theme text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'export' ? 'bg-card text-primary shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            📱 Push to Other Device (QR / PIN / Email)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual_paste')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'manual_paste' ? 'bg-card text-primary shadow-xs' : 'text-muted hover:text-primary'
            }`}
          >
            📥 Enter PIN or Paste Data
          </button>
        </div>

        {activeTab === 'export' ? (
          <div className="space-y-4">
            {/* QR Code Display with live dynamic origin URL */}
            <div className="p-4 rounded-2xl bg-surface border border-theme flex flex-col items-center justify-center space-y-3">
              <div className="p-2 bg-white rounded-2xl shadow-xs border border-gray-200">
                <QRCodeDisplay
                  value={qrTransferUrl}
                  size={190}
                />
              </div>

              <div className="text-center space-y-1.5 w-full">
                <span className="text-xs text-muted block">
                  Scan with iPad / phone camera, or enter this 6-digit code on your iPad:
                </span>
                {transferPin && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="text-sm font-mono font-extrabold tracking-widest px-4 py-1.5 rounded-xl bg-card border-2 border-primary/40 text-primary">
                      {transferPin}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(transferPin);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary text-white hover:opacity-90 text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Copy 6-digit PIN"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied' : 'Copy PIN'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePin}
                      disabled={isGenerating}
                      className="p-1.5 rounded-xl hover:bg-card text-muted hover:text-primary transition cursor-pointer"
                      title="Generate fresh code"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-muted max-w-sm mx-auto">
                  Works even if you're not logged into your account on iPad!
                </p>
              </div>
            </div>

            {/* Direct Link, Log Message & Raw Data Copy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopyDirectLink}
                className="py-2.5 px-3 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Copy direct sync URL to open in Safari on iPad without logging in"
              >
                {isLinkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <ExternalLink className="w-4 h-4" />}
                <span>{isLinkCopied ? 'Copied Safari Link' : 'Copy iPad Sync Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummary}
                className="py-2.5 px-3 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Copy formatted work log message to text or email"
              >
                {isSummaryCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-amber-500" />}
                <span>{isSummaryCopied ? 'Copied Daily Log' : 'Copy Log Message'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPayload}
                className="py-2.5 px-3 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? 'Copied Raw JSON' : 'Copy Progress JSON'}</span>
              </button>
            </div>

            {/* Email What I Have Done Today Section */}
            <div className="p-3.5 rounded-2xl bg-surface/80 border border-theme space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span>Email What I Have Done Today</span>
                </span>
                <span className="text-[10px] font-mono text-muted">{todayHours} hrs log</span>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-1.5 bg-card border border-theme rounded-xl text-xs font-medium text-primary focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleSendEmailReport}
                  disabled={isSendingEmail}
                  className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-pulse' : ''}`} />
                  <span>{isSendingEmail ? 'Sending...' : 'Send Log'}</span>
                </button>
              </div>

              {emailStatus && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  {emailStatus}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenQRScanner();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-primary text-white hover:opacity-90 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Camera className="w-4 h-4" />
              <span>Open In-App Camera Scanner</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted">Enter 6-Digit Transfer PIN or Paste Raw JSON</label>
              <textarea
                rows={5}
                value={manualJsonInput}
                onChange={(e) => setManualJsonInput(e.target.value)}
                placeholder='Enter 6-digit PIN (e.g. 542198) or paste raw progress JSON here'
                className="w-full p-3 bg-surface border border-theme rounded-2xl text-xs font-mono text-primary focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleManualImport}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-white font-bold text-xs shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Verify & Import Delivered Progress
            </button>

            {importStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                importStatus.success
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30'
              }`}>
                {importStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
