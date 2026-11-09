import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Bell, 
  ExternalLink, 
  RefreshCw, 
  Sparkles, 
  X, 
  Video, 
  Target, 
  Layers, 
  BookOpen,
  ArrowRight,
  Download,
  Smartphone,
  ShieldCheck,
  Trash2,
  Check
} from 'lucide-react';
import { StudyPlan, RevisionItem, ExamDate, TestResult, Assignment } from '../types';
import { syncStudyPlansToGoogleCalendar, cleanDuplicateGoogleCalendarEvents } from '../lib/googleCalendarService';
import { cleanDuplicateGoogleTasks } from '../lib/googleTasksService';
import { downloadCalendarICS } from '../lib/icalendarExportService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface UploadToGoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StudyPlan[];
  revisions?: RevisionItem[];
  examDates?: ExamDate[];
  testResults?: TestResult[];
  assignments?: Assignment[];
  onSavePlan?: (plan: StudyPlan) => void;
  onBatchSavePlans?: (plans: StudyPlan[]) => Promise<void> | void;
}

export const UploadToGoogleCalendarModal: React.FC<UploadToGoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  plans = [],
  revisions = [],
  examDates = [],
  testResults = [],
  assignments = [],
  onSavePlan,
  onBatchSavePlans
}) => {
  const [preferredStartTime, setPreferredStartTime] = useState<string>('09:00');
  const [uploadMode, setUploadMode] = useState<'daily_plan' | 'individual_topics'>('daily_plan');
  const [autoCreateMeetLinks, setAutoCreateMeetLinks] = useState<boolean>(false);
  const [includeRevisions, setIncludeRevisions] = useState<boolean>(true);
  const [includeExams, setIncludeExams] = useState<boolean>(true);
  const [reminderSetting, setReminderSetting] = useState<'10m' | '5m' | 'default' | 'none' | 'intensive'>('10m');

  // Upload Progress State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; itemName: string }>({
    current: 0,
    total: 0,
    itemName: ''
  });
  const [uploadSuccess, setUploadSuccess] = useState<{ createdCount: number; updatedCount: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Duplicate Cleaner State
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState<boolean>(false);
  const [cleanNotice, setCleanNotice] = useState<string | null>(null);

  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate total topics across plans
  const totalTopics = plans.reduce((acc, p) => acc + (p.topics?.length || 0), 0);

  // Estimated event count
  const estimatedEventsCount = (uploadMode === 'individual_topics' ? totalTopics : plans.length) +
    (includeExams ? examDates.length : 0) +
    (includeRevisions ? revisions.filter(r => r.status !== 'Completed').length : 0);

  const handleDownloadICS = () => {
    const ok = downloadCalendarICS({
      plans,
      examDates: includeExams ? examDates : [],
      revisions: includeRevisions ? revisions : [],
      assignments,
      preferredStartTime,
      scheduleEachTopicIndividually: uploadMode === 'individual_topics',
      alarmMinutesBefore: reminderSetting === 'none' ? [] : reminderSetting === '5m' ? [5] : [10]
    });

    if (ok) {
      setDownloadSuccessNotice(`✓ Calendar file (.ics) downloaded with ${estimatedEventsCount} events! In Safari/iPad, tap the downloaded file to add all events with clean alarms.`);
      triggerStudyGoalConfetti();
      setTimeout(() => setDownloadSuccessNotice(null), 8000);
    }
  };

  const handleCleanDuplicates = async () => {
    setIsCleaningDuplicates(true);
    setCleanNotice(null);
    setUploadError(null);

    try {
      const dates = plans.map(p => p.date).filter(Boolean).sort();
      const startDate = dates[0] || new Date().toISOString().split('T')[0];
      const endDate = dates[dates.length - 1] || startDate;

      const calRes = await cleanDuplicateGoogleCalendarEvents(startDate, endDate);
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
      setUploadError(e.message || 'Failed to clean duplicates from Google Workspace.');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleStartUpload = async () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setCurrentProgress({ current: 0, total: estimatedEventsCount || plans.length, itemName: 'Initiating Google Calendar OAuth session...' });

    try {
      const res = await syncStudyPlansToGoogleCalendar(
        {
          plans,
          examDates: includeExams ? examDates : [],
          revisions: includeRevisions ? revisions : [],
          testResults,
          assignments,
          autoCreateMeetLinks,
          preferredStartTime,
          scheduleEachTopicIndividually: uploadMode === 'individual_topics',
          reminderSetting
        },
        (current, total, itemName) => {
          setCurrentProgress({ current, total, itemName });
        }
      );

      if (res.createdCount > 0 || res.updatedCount > 0) {
        setUploadSuccess({ createdCount: res.createdCount, updatedCount: res.updatedCount });
        triggerStudyGoalConfetti();
      } else if (res.errors.length > 0) {
        setUploadError(res.errors[0]);
      } else {
        setUploadError('No events were created. Please verify your calendar items.');
      }
    } catch (err: any) {
      console.error('Google Calendar upload error:', err);
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        setUploadError('Safari blocked the sign-in pop-up window. Use the "Add to iPad & Phone Calendar (.ics)" button below to sync all events directly without pop-ups!');
      } else {
        setUploadError(err.message || 'Failed to upload events to Google Calendar.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl space-y-6 relative text-[#4A4E4D] max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider font-mono flex items-center gap-1.5">
                <span>Google Calendar Push</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-sans">Zero Duplicates</span>
              </div>
              <h3 className="text-lg font-serif italic font-bold text-[#6B705C]">
                Upload Schedule to Google Calendar
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-[#A5A58D] hover:text-[#4A4E4D] rounded-xl hover:bg-[#F9F7F2] transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUCCESS VIEW */}
        {uploadSuccess ? (
          <div className="space-y-5 py-4 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xl font-serif italic font-bold text-[#6B705C]">
                🎉 Synchronization Complete!
              </h4>
              <p className="text-xs text-[#6B705C] max-w-md mx-auto leading-relaxed">
                Successfully synced: <strong>{uploadSuccess.createdCount} new event(s) created</strong>
                {uploadSuccess.updatedCount > 0 ? `, and ${uploadSuccess.updatedCount} existing event(s) updated in place` : ''}. Zero duplicate events were created!
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs text-left space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-blue-800">
                <Bell className="w-4 h-4 text-blue-600" />
                <span>Clean Notification Reminders Configured</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-900/90">
                {reminderSetting === 'none'
                  ? 'Events are scheduled silently without alarms.'
                  : reminderSetting === 'default'
                  ? 'Using your default Google Calendar reminder rules.'
                  : reminderSetting === '5m'
                  ? 'A gentle pop-up notification will buzz your devices 5 minutes before each study session.'
                  : 'A gentle pop-up notification will buzz your devices 10 minutes before each study session (preventing notification flooding).'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Google Calendar</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] font-bold text-xs text-[#4A4E4D] transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : isUploading ? (
          /* UPLOADING PROGRESS VIEW */
          <div className="space-y-5 py-6 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-serif italic font-bold text-[#6B705C]">
                Uploading Schedule to Google Calendar...
              </h4>
              <p className="text-xs text-[#A5A58D]">
                Connecting via Google Workspace OAuth and updating events without duplicates
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 max-w-md mx-auto">
              <div className="w-full h-3 bg-[#F2EFE9] rounded-full overflow-hidden border border-[#E0DBD0]">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ 
                    width: `${Math.min(100, Math.round(((currentProgress.current || 1) / Math.max(1, currentProgress.total || 1)) * 100))}%` 
                  }}
                />
              </div>

              <div className="flex justify-between text-xs font-mono font-bold text-[#6B705C]">
                <span>{currentProgress.current} / {currentProgress.total} Items</span>
                <span>
                  {Math.min(100, Math.round(((currentProgress.current || 1) / Math.max(1, currentProgress.total || 1)) * 100))}%
                </span>
              </div>

              {currentProgress.itemName && (
                <div className="text-[11px] text-[#A5A58D] truncate max-w-sm mx-auto font-mono">
                  {currentProgress.itemName}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#A5A58D]">
              Please do not close this window while events are being synchronized.
            </p>
          </div>
        ) : (
          /* CONFIGURATION VIEW */
          <div className="space-y-5 text-xs">
            {/* Error banner if previous run failed */}
            {uploadError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Cleanup Notice */}
            {cleanNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-fade-in">
                <span>{cleanNotice}</span>
                <button onClick={() => setCleanNotice(null)} className="font-bold opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            {/* Summary statistics cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                <div className="text-[10px] uppercase font-bold text-[#A5A58D]">Daily Plans</div>
                <div className="text-xl font-bold font-mono text-[#6B705C] mt-0.5">{plans.length}</div>
                <div className="text-[10px] text-[#A5A58D]">Days in app</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                <div className="text-[10px] uppercase font-bold text-[#A5A58D]">Total Topics</div>
                <div className="text-xl font-bold font-mono text-[#6B705C] mt-0.5">{totalTopics}</div>
                <div className="text-[10px] text-[#A5A58D]">To schedule</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                <div className="text-[10px] uppercase font-bold text-[#A5A58D]">Exams</div>
                <div className="text-xl font-bold font-mono text-[#6B705C] mt-0.5">{examDates.length}</div>
                <div className="text-[10px] text-[#A5A58D]">Target milestones</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-center">
                <div className="text-[10px] uppercase font-bold text-[#A5A58D]">1-3-7 Revisions</div>
                <div className="text-xl font-bold font-mono text-[#6B705C] mt-0.5">{revisions.length}</div>
                <div className="text-[10px] text-[#A5A58D]">Active cycles</div>
              </div>
            </div>

            {/* Configuration Options */}
            <div className="space-y-3.5 p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
              <div className="font-bold text-xs uppercase tracking-wider text-[#6B705C] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#6B705C]" />
                  <span>Pacing & Notification Alarm Controls</span>
                </div>
                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  disabled={isCleaningDuplicates}
                  className="text-[10px] text-rose-700 hover:text-rose-900 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition font-mono"
                  title="Remove duplicate StudyFlow events from Google Calendar"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>{isCleaningDuplicates ? 'Cleaning...' : 'Clean Duplicate Events'}</span>
                </button>
              </div>

              {/* Notification Alarm Setting (Prevents 11 notification blast) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[11px] font-bold text-[#4A4E4D]">
                    Notification Reminders:
                  </label>
                  <p className="text-[10px] text-[#A5A58D]">
                    Prevents notification spam when multiple topics are scheduled
                  </p>
                </div>
                <select
                  value={reminderSetting}
                  onChange={e => setReminderSetting(e.target.value as any)}
                  className="p-2 rounded-xl bg-white border border-[#E0DBD0] text-xs font-semibold text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
                >
                  <option value="10m">1 Gentle Reminder (10m before) [Recommended]</option>
                  <option value="5m">1 Quick Reminder (5m before)</option>
                  <option value="default">Use My Google Calendar Default</option>
                  <option value="none">Silent (No notifications)</option>
                  <option value="intensive">Intensive (10m & 30m before)</option>
                </select>
              </div>

              {/* Preferred Study Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-2 border-t border-[#E0DBD0]/60">
                <div>
                  <label className="block text-[11px] font-bold text-[#4A4E4D]">
                    Primary Daily Study Time:
                  </label>
                  <p className="text-[10px] text-[#A5A58D]">
                    Used when events do not have a pre-assigned time
                  </p>
                </div>
                <select
                  value={preferredStartTime}
                  onChange={e => setPreferredStartTime(e.target.value)}
                  className="p-2 rounded-xl bg-white border border-[#E0DBD0] text-xs font-semibold text-[#4A4E4D] focus:outline-hidden focus:ring-2 focus:ring-[#6B705C]"
                >
                  <option value="08:00">08:00 AM (Early Morning Focus)</option>
                  <option value="09:00">09:00 AM (Morning Standard)</option>
                  <option value="11:00">11:00 AM (Late Morning)</option>
                  <option value="14:00">02:00 PM (Afternoon)</option>
                  <option value="16:00">04:00 PM (Late Afternoon)</option>
                  <option value="17:00">05:00 PM (Evening Routine)</option>
                  <option value="19:00">07:00 PM (Night Sprint)</option>
                </select>
              </div>

              {/* Upload Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-2 border-t border-[#E0DBD0]/60">
                <div>
                  <label className="block text-[11px] font-bold text-[#4A4E4D]">
                    Calendar Layout:
                  </label>
                  <p className="text-[10px] text-[#A5A58D]">
                    1 consolidated daily block or individual topic sessions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode('daily_plan')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      uploadMode === 'daily_plan'
                        ? 'bg-[#6B705C] text-white border-[#6B705C]'
                        : 'bg-white text-[#4A4E4D] border-[#E0DBD0]'
                    }`}
                  >
                    1 Block / Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('individual_topics')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      uploadMode === 'individual_topics'
                        ? 'bg-[#6B705C] text-white border-[#6B705C]'
                        : 'bg-white text-[#4A4E4D] border-[#E0DBD0]'
                    }`}
                  >
                    Each Topic
                  </button>
                </div>
              </div>
            </div>

            {/* Inclusions Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExams}
                  onChange={e => setIncludeExams(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="font-semibold text-[#4A4E4D]">
                  Include upcoming Exam milestones ({examDates.length} locked exams)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRevisions}
                  onChange={e => setIncludeRevisions(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="font-semibold text-[#4A4E4D]">
                  Include 1-3-7 Spaced Repetition Due Dates ({revisions.length} revision tasks)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreateMeetLinks}
                  onChange={e => setAutoCreateMeetLinks(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-[#4A4E4D]">
                  Attach Google Meet video room link to each session
                </span>
              </label>
            </div>

            {/* Download notice */}
            {downloadSuccessNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-fade-in">
                <span>{downloadSuccessNotice}</span>
                <button onClick={() => setDownloadSuccessNotice(null)} className="font-bold opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            {/* iPad / Safari Popup Notice */}
            <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Using iPad or Safari?</strong> Safari blocks sign-in popups. Use <strong>"Add to iPad & Phone (.ics)"</strong> below to directly add all {estimatedEventsCount} events with clean alarms and ZERO popups!
              </span>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-[#E0DBD0] flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D] transition cursor-pointer self-start sm:self-auto"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* 1-CLICK IPAD & PHONE CALENDAR (.ICS WITH ALARMS) */}
                <button
                  type="button"
                  onClick={handleDownloadICS}
                  disabled={plans.length === 0}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Direct 1-click import into Apple Calendar, Google Calendar, or iPad calendar with built-in alarm alerts"
                >
                  <Download className="w-4 h-4" />
                  <span>Add to iPad & Phone (.ics)</span>
                </button>

                {/* CLOUD GOOGLE CALENDAR PUSH */}
                <button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={plans.length === 0}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Upload all schedule items to Google Calendar via Google Workspace OAuth (with zero duplicates)"
                >
                  <Upload className="w-4 h-4" />
                  <span>Push to Google Calendar ({plans.length}d)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

