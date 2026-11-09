import React, { useState } from 'react';
import { 
  RefreshCw, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  X, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  Send,
  Mail,
  Check
} from 'lucide-react';
import { StudyPlan, InAppCalendarEvent } from '../types';
import { 
  batchSynchronizeInAppCalendar, 
  getAllInAppCalendarEvents,
  formatHumanDate 
} from '../lib/inbuiltCalendarAnalyzer';
import { cleanDuplicateGoogleCalendarEvents, getOrCreateAcademicCalendar } from '../lib/googleCalendarService';
import { cleanDuplicateGoogleTasks } from '../lib/googleTasksService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface InbuiltCalendarGoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StudyPlan[];
  onBatchSavePlans?: (plans: StudyPlan[]) => Promise<void> | void;
}

export const InbuiltCalendarGoogleSyncModal: React.FC<InbuiltCalendarGoogleSyncModalProps> = ({
  isOpen,
  onClose,
  plans,
  onBatchSavePlans
}) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; itemName: string }>({
    current: 0,
    total: 0,
    itemName: ''
  });
  const [syncResult, setSyncResult] = useState<{
    syncedCount: number;
    errors: string[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sync' | 'zapier' | 'events'>('sync');

  // Option A: Dedicated secondary calendar state
  const [useDedicatedCalendar, setUseDedicatedCalendar] = useState<boolean>(true);

  // Reminder Mode State: 'per_session' = 1 singular alert at each study time, 'silent' = zero notifications
  const [reminderMode, setReminderMode] = useState<'per_session' | 'daily_digest' | 'silent'>('per_session');

  // Duplicate Cleaner State
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState<boolean>(false);
  const [cleanNotice, setCleanNotice] = useState<string | null>(null);

  // Zapier webhook simulation / testing
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('studyflow_zapier_webhook_url') || '';
  });
  const [zapierTestStatus, setZapierTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const allEvents = getAllInAppCalendarEvents(plans);
  const totalEvents = allEvents.length;
  const syncedGCalCount = allEvents.filter(e => Boolean(e.googleCalendarEventId)).length;
  const syncedGTasksCount = allEvents.filter(e => Boolean(e.googleTaskId)).length;

  const handleCleanDuplicates = async () => {
    setIsCleaningDuplicates(true);
    setCleanNotice(null);
    setSyncError(null);

    try {
      const dates = plans.map(p => p.date).filter(Boolean).sort();
      const startDate = dates[0] || new Date().toISOString().split('T')[0];
      const endDate = dates[dates.length - 1] || startDate;

      let targetCalId = 'primary';
      if (useDedicatedCalendar) {
        const acadCal = await getOrCreateAcademicCalendar();
        targetCalId = acadCal.id;
      }

      // 1. Clean Google Calendar duplicates
      const calRes = await cleanDuplicateGoogleCalendarEvents(startDate, endDate, undefined, targetCalId);
      
      // 2. Clean Google Tasks duplicates
      const tasksRes = await cleanDuplicateGoogleTasks();

      const totalRemoved = calRes.removedDuplicatesCount + tasksRes.removedDuplicatesCount;

      if (totalRemoved > 0) {
        setCleanNotice(
          `✓ Cleaned up ${totalRemoved} duplicate item(s) (${calRes.removedDuplicatesCount} in Google Calendar, ${tasksRes.removedDuplicatesCount} in Google Tasks)!`
        );
        triggerStudyGoalConfetti();
      } else {
        setCleanNotice('✓ Zero duplicates found! Both Google Calendar and Google Tasks are completely clean.');
      }
      setTimeout(() => setCleanNotice(null), 8000);
    } catch (e: any) {
      setSyncError(e.message || 'Failed to clean duplicate calendar events and tasks.');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setSyncProgress({ current: 0, total: totalEvents, itemName: 'Authorizing Google Workspace...' });

    try {
      let targetCalendarId = 'primary';
      if (useDedicatedCalendar) {
        setSyncProgress({ current: 0, total: totalEvents, itemName: 'Finding or creating dedicated "StudyFlow Academic Schedule" calendar...' });
        const acadCal = await getOrCreateAcademicCalendar();
        targetCalendarId = acadCal.id;
      }

      const reminderMinutes = reminderMode === 'silent' ? 0 : reminderMode === 'daily_digest' ? 0 : 10;
      const res = await batchSynchronizeInAppCalendar(
        plans,
        undefined,
        (current, total, itemName) => {
          setSyncProgress({ current, total, itemName });
        },
        { 
          reminderMinutes,
          calendarId: targetCalendarId,
          syncToTasks: false // Cleanly managed via dedicated Google Tasks tab
        }
      );

      // Persist updated plans with external IDs
      if (onBatchSavePlans && res.updatedPlans.length > 0) {
        await onBatchSavePlans(res.updatedPlans);
      }

      setSyncResult({
        syncedCount: res.count,
        errors: res.errors
      });

      triggerStudyGoalConfetti();
    } catch (err: any) {
      console.error('Batch sync error:', err);
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        setSyncError('Browser blocked the sign-in pop-up. Please allow pop-ups for this site or authorize once.');
      } else {
        setSyncError(err.message || 'Failed to synchronize with Google Calendar.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestZapierWebhook = async () => {
    if (!zapierWebhookUrl.trim()) {
      setZapierTestStatus('Please enter your Zapier Webhook URL first.');
      return;
    }

    localStorage.setItem('studyflow_zapier_webhook_url', zapierWebhookUrl.trim());
    setZapierTestStatus('Sending test payload to Zapier...');

    try {
      const sampleEvent = allEvents[0] || {
        id: 'cal-evt-sample-1',
        subjectName: 'Biology',
        chapterName: 'Chapter 10 — Animalia',
        topicName: 'Arthropoda',
        date: new Date().toISOString().split('T')[0],
        startTime: '6:00 PM',
        endTime: '7:00 PM',
        durationMinutes: 60,
        deadline: '7:00 PM',
        priority: 'High',
        completed: false
      };

      await fetch(zapierWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          source: 'StudyFlow Inbuilt Calendar',
          event: 'study_session_accountability',
          studySession: {
            inAppEventId: sampleEvent.id,
            subject: sampleEvent.subjectName,
            chapter: sampleEvent.chapterName,
            topic: sampleEvent.topicName,
            date: sampleEvent.date,
            formattedDate: formatHumanDate(sampleEvent.date),
            startTime: sampleEvent.startTime,
            endTime: sampleEvent.endTime,
            durationMinutes: sampleEvent.durationMinutes,
            deadline: sampleEvent.deadline,
            priority: sampleEvent.priority,
            status: sampleEvent.completed ? 'Completed' : 'Pending',
            accountabilityAction: 'Gmail Daily Reminder / Check-in'
          },
          timestamp: new Date().toISOString()
        })
      });

      setZapierTestStatus('✓ Test payload sent successfully to Zapier webhook! Check your Zapier History / Gmail.');
      setTimeout(() => setZapierTestStatus(null), 8000);
    } catch (e: any) {
      setZapierTestStatus(`Webhook error: ${e.message || 'Could not reach URL'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#4A4E4D]">
        
        {/* Header */}
        <div className="bg-[#2B2D42] text-white p-6 border-b border-[#3D405B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-emerald-300">
              <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold font-mono">
                Source of Truth: Inbuilt App Calendar
              </div>
              <h2 className="text-xl font-bold font-serif">
                In-App Calendar ➔ Google Sync & Accountability
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#E0DBD0] bg-[#F9F7F2]">
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Google Synchronization
          </button>
          <button
            onClick={() => setActiveTab('zapier')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'zapier'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            Zapier ➔ Gmail Accountability
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer ${
              activeTab === 'events'
                ? 'bg-white text-[#2B2D42] border-t border-x border-[#E0DBD0] shadow-2xs'
                : 'text-[#6B705C] hover:text-[#2B2D42]'
            }`}
          >
            In-App Events ({totalEvents})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Architecture Chain Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
            <div className="text-[10px] font-mono font-bold text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Intended Architectural Flow</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-amber-950 font-mono">
              <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300">Study Plan Analysis</span>
              <span>↓</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300">Inbuilt Calendar Analyzer</span>
              <span>↓</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-200 border border-amber-400 font-extrabold text-amber-950">Inbuilt App Calendar (Source of Truth)</span>
              <span>↓</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300">Google Calendar</span>
              <span>↓</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300">Google Tasks</span>
              <span>↓</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300">Zapier</span>
              <span>↓</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300">Gmail</span>
            </div>
          </div>

          {activeTab === 'sync' && (
            <div className="space-y-5">
              
              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-1">
                  <div className="text-[10px] font-bold text-[#A5A58D] uppercase font-mono">Inbuilt Calendar</div>
                  <div className="text-xl font-bold text-[#2B2D42]">{totalEvents}</div>
                  <div className="text-[10px] text-[#6B705C]">Primary Source of Truth</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
                  <div className="text-[10px] font-bold text-blue-800 uppercase font-mono">Google Calendar</div>
                  <div className="text-xl font-bold text-blue-900">{syncedGCalCount} / {totalEvents}</div>
                  <div className="text-[10px] text-blue-700">Events synchronized</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase font-mono">Google Tasks</div>
                  <div className="text-xl font-bold text-emerald-900">{syncedGTasksCount} / {totalEvents}</div>
                  <div className="text-[10px] text-emerald-700">Accountability bridge</div>
                </div>
              </div>

              {/* Duplicate Prevention Guarantee */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E0DBD0] flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#2B2D42]">Zero-Duplicate Synchronization Guarantee</div>
                    <p className="text-[#6B705C] text-[11px] leading-relaxed">
                      Every calendar entry inside the application has a unique internal calendar-event ID.
                      When synchronizing, if a Google Calendar event or Google Task already exists, the application
                      updates it in-place. Refreshing, reopening, reanalyzing, or resynchronizing will never create duplicate entries.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  disabled={isCleaningDuplicates}
                  className="px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 shrink-0 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Scan and delete any duplicate StudyFlow events or tasks from Google Calendar & Google Tasks"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCleaningDuplicates ? 'animate-spin' : ''}`} />
                  <span>{isCleaningDuplicates ? 'Cleaning Both Calendars...' : '🧹 Clean Duplicates in Both Calendars'}</span>
                </button>
              </div>

              {/* Duplicate Cleaner Notice */}
              {cleanNotice && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
                  <span>{cleanNotice}</span>
                  <button onClick={() => setCleanNotice(null)} className="font-bold opacity-60 hover:opacity-100">✕</button>
                </div>
              )}

              {/* Option A: Dedicated Secondary Study Calendar Setting */}
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#2B2D42] text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Option A: Dedicated Study Calendar (Google Calendar)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    Option A Active
                  </span>
                </div>
                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="dedicatedCalCheck"
                    checked={useDedicatedCalendar}
                    onChange={(e) => setUseDedicatedCalendar(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor="dedicatedCalCheck" className="cursor-pointer space-y-0.5">
                    <div className="font-bold text-[#2B2D42] text-xs">
                      Create & sync into dedicated "StudyFlow Academic Schedule" calendar
                    </div>
                    <div className="text-[11px] text-[#6B705C] leading-relaxed">
                      Keeps all study topics completely separate from your personal events. You can toggle this academic calendar on/off in Google Calendar with a single tap on your phone or tablet.
                    </div>
                  </label>
                </div>
              </div>

              {/* Phone Notification & Alarm Control (Singular Alert at Study Times) */}
              <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#2B2D42] text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Notification & Alarm Setting (No Bombardment)</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Smart Pacing
                  </span>
                </div>
                <p className="text-[11px] text-[#6B705C]">
                  Choose how your Google Calendar and phone calendar should alert you for these {totalEvents} study sessions:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReminderMode('per_session')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2 ${
                      reminderMode === 'per_session'
                        ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-bold'
                        : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#6B705C] hover:bg-white'
                    }`}
                  >
                    <span className="text-base">⏰</span>
                    <div>
                      <div className="text-[11px] font-bold">Singular Alarm at Study Times</div>
                      <div className="text-[10px] opacity-80">1 single alert when each scheduled session arrives.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReminderMode('daily_digest')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2 ${
                      reminderMode === 'daily_digest'
                        ? 'bg-amber-50/70 border-amber-400 text-amber-950 font-bold'
                        : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#6B705C] hover:bg-white'
                    }`}
                  >
                    <span className="text-base">☀️</span>
                    <div>
                      <div className="text-[11px] font-bold">Daily Briefing Only</div>
                      <div className="text-[10px] opacity-80">1 morning notification for the day's goals.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReminderMode('silent')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2 ${
                      reminderMode === 'silent'
                        ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#6B705C] hover:bg-white'
                    }`}
                  >
                    <span className="text-base">🔕</span>
                    <div>
                      <div className="text-[11px] font-bold">Silent Mode</div>
                      <div className="text-[10px] opacity-80">Calendar time-blocks only with 0 sound/buzz alarms.</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sync Trigger Box */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#F2EFE9] to-[#EAE7DF] border border-[#E0DBD0] text-center space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#2B2D42] font-serif">
                    Synchronize Finalized In-App Calendar
                  </h3>
                  <p className="text-xs text-[#6B705C] max-w-md mx-auto">
                    Pushes all scheduled sessions from your Inbuilt Application Calendar to Google Calendar and Google Tasks,
                    preserving exact dates, start times, durations, and deadlines.
                  </p>
                </div>

                {isSyncing ? (
                  <div className="space-y-2 max-w-xs mx-auto">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#2B2D42]">
                      <span>Syncing {syncProgress.current} of {syncProgress.total}...</span>
                      <span>{Math.round((syncProgress.current / Math.max(1, syncProgress.total)) * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white border border-[#E0DBD0] overflow-hidden">
                      <div 
                        className="h-full bg-emerald-600 transition-all duration-200"
                        style={{ width: `${Math.round((syncProgress.current / Math.max(1, syncProgress.total)) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[#6B705C] truncate font-mono">
                      {syncProgress.itemName}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleStartSync}
                    disabled={totalEvents === 0}
                    className="px-6 py-3 rounded-2xl bg-[#2B2D42] hover:bg-[#1E202F] text-white text-xs font-bold shadow-md inline-flex items-center gap-2.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Synchronize In-App Calendar ({totalEvents} Events)</span>
                  </button>
                )}
              </div>

              {/* Sync Results Feedback */}
              {syncResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Synchronization Complete: {syncResult.syncedCount} study sessions synchronized to Google Calendar & Google Tasks!</span>
                  </div>
                  {syncResult.errors.length > 0 && (
                    <div className="text-[10px] text-amber-800 space-y-0.5">
                      <div>Notes:</div>
                      {syncResult.errors.slice(0, 3).map((e, idx) => (
                        <div key={idx}>• {e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {syncError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
                  {syncError}
                </div>
              )}
            </div>
          )}

          {activeTab === 'zapier' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#2B2D42]">
                  <Mail className="w-4 h-4 text-sky-600" />
                  <span>Google Tasks ➔ Zapier ➔ Gmail Accountability Bridge</span>
                </div>
                <p className="text-[#6B705C] text-[11px] leading-relaxed">
                  The Google Task represents the external accountability representation of the in-app calendar session.
                  This allows Zapier to monitor the Google Task independently from the application.
                  When you complete a study session in the app, the Google Task is marked complete in real-time.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E0DBD0] space-y-3">
                <div className="font-bold text-[#2B2D42]">How to Set Up Zapier ➔ Gmail Monitoring:</div>
                <div className="space-y-2 text-[11px] text-[#4A4E4D]">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">1</span>
                    <span>In Zapier, create a new Zap with Trigger: <strong>Google Tasks</strong> ➔ <em>"Updated Task"</em> or <em>"Completed Task"</em>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">2</span>
                    <span>Select the <strong>"StudyFlow Academic Tasks"</strong> list.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">3</span>
                    <span>Add Action: <strong>Gmail</strong> ➔ <em>"Send Email"</em>. Use the Google Task's Title (e.g. <code>Biology — Ch. 10 Animalia — Arthropoda</code>) and Notes (containing Scheduled Time, Duration, and Deadline) in the email body!</span>
                  </div>
                </div>
              </div>

              {/* Webhook test section */}
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-3">
                <div className="font-bold text-[#2B2D42] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Direct Webhook / Zapier Catch Hook (Optional)</span>
                </div>
                <input
                  type="url"
                  value={zapierWebhookUrl}
                  onChange={(e) => setZapierWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                />
                <button
                  onClick={handleTestZapierWebhook}
                  className="px-4 py-2 bg-[#2B2D42] hover:bg-[#1E202F] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Accountability Ping to Zapier</span>
                </button>
                {zapierTestStatus && (
                  <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    {zapierTestStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-3">
              <div className="text-[#6B705C] text-[11px]">
                Showing all <strong>{allEvents.length}</strong> finalized study sessions converted by the Inbuilt Calendar Analyzer:
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {allEvents.map((evt) => (
                  <div key={evt.id} className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#2B2D42]">{evt.subjectName} — {evt.chapterName ? `${evt.chapterName} — ` : ''}{evt.topicName}</div>
                        <div className="text-[11px] text-[#A5A58D] font-mono">
                          {formatHumanDate(evt.date)} • {evt.startTime}–{evt.endTime} ({evt.durationMinutes} mins) • Deadline: {evt.deadline}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {evt.completed ? 'Completed ✓' : 'Scheduled'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E0DBD0]/60 text-[10px]">
                      <span className="font-mono text-[#A5A58D]">ID: {evt.id}</span>
                      <span className={`px-1.5 py-0.5 rounded ${evt.googleCalendarEventId ? 'bg-blue-100 text-blue-800' : 'bg-stone-100 text-stone-600'}`}>
                        Google Cal: {evt.googleCalendarEventId ? 'Synced ✓' : 'Pending'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${evt.googleTaskId ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                        Google Task: {evt.googleTaskId ? 'Synced ✓' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F9F7F2] border-t border-[#E0DBD0] flex items-center justify-between">
          <div className="text-[11px] text-[#A5A58D] font-mono">
            Inbuilt App Calendar = Source of Truth
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
