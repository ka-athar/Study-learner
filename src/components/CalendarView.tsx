import React, { useState, useRef, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Award, 
  X, 
  Download, 
  Check, 
  Play, 
  ExternalLink, 
  Share2, 
  Plus, 
  BookOpen, 
  FileText,
  RefreshCw,
  Trash2,
  RotateCcw,
  Edit2,
  Printer,
  ArrowRight
} from 'lucide-react';
import { StudySession, StudyPlan, StudyPlanTopic, TestResult, RevisionItem, UserProfile, Subject, ActiveTab, Assignment, InAppCalendarEvent, ExamDate } from '../types';
import { generateIcsCalendarContent, downloadIcsFile } from '../lib/icsExport';
import { AICalendarScheduleImporter } from './AICalendarScheduleImporter';
import { TwoWaySyncModal } from './TwoWaySyncModal';
import { InbuiltCalendarGoogleSyncModal } from './InbuiltCalendarGoogleSyncModal';
import { WeeklyMentorReportModal } from './WeeklyMentorReportModal';
import { GoogleTasksSyncModal } from './GoogleTasksSyncModal';
import { TestPreparationTimelineCard } from './TestPreparationTimelineCard';
import { SbbmAnswerSheetModal } from './SbbmAnswerSheetModal';
import { SmartScheduleConflictResolverModal } from './SmartScheduleConflictResolverModal';
import { EmergencyPreExamTriageModal } from './EmergencyPreExamTriageModal';
import { InteractiveDayTimelineCard } from './InteractiveDayTimelineCard';
import { getImpendingExams } from '../lib/preExamTriageService';
import { loadMistakes } from '../lib/mistakeVaultStorage';
import { diagnoseScheduleConflicts } from '../lib/scheduleConflictEngine';
import { buildTestPreparationTimelines, calculateMultiMonthWorkload } from '../lib/spacedRevisionEngine';
import { Target, Zap, Activity, ShieldCheck, Wifi, Globe, Layers, Link2, Upload, CheckSquare } from 'lucide-react';
import { SyllabusAutoAllocatorModal } from './SyllabusAutoAllocatorModal';
import { UploadToGoogleCalendarModal } from './UploadToGoogleCalendarModal';
import { downloadCalendarICS } from '../lib/icalendarExportService';
import { openStudyKitPrintWindow, openSbbmAnswerSheetPrintWindow } from '../lib/studyKitExportService';
import { triggerStudyGoalConfetti } from '../lib/confetti';
import { 
  getAllInAppCalendarEvents, 
  analyzeStudyTopicIntoCalendarEvent,
  analyzeStudyPlanIntoCalendar,
  formatHumanDate, 
  calculateConsistentEndTime, 
  deleteInAppEventFromExternalServices, 
  synchronizeInAppEventToExternalServices, 
  toggleInAppEventCompletionExternal,
  rolloverIncompleteStudyPlanTopics
} from '../lib/inbuiltCalendarAnalyzer';

interface CalendarViewProps {
  sessions: StudySession[];
  plans: StudyPlan[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  assignments?: Assignment[];
  userProfile: UserProfile | null;
  subjects?: Subject[];
  onSavePlan?: (plan: StudyPlan) => void;
  onBatchSavePlans?: (plans: StudyPlan[]) => Promise<void> | void;
  onAddTo137Cycle?: (subjectName: string, chapterName: string, topicName: string, initialDate?: string) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onToggleTopicCompletion?: (planId: string, topicId: string, completedOverride?: boolean) => void;
  setActiveTab?: (tab: ActiveTab) => void;
  onOpenWorkspaceHub?: (tab?: 'calendar' | 'drive' | 'keep' | 'tasks') => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  sessions,
  plans,
  testResults,
  revisions,
  assignments = [],
  userProfile,
  subjects = [],
  onSavePlan,
  onBatchSavePlans,
  onAddTo137Cycle,
  onUpdateProfile,
  onStartTimerForTopic,
  onToggleTopicCompletion,
  setActiveTab,
  onOpenWorkspaceHub
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showImporterBox, setShowImporterBox] = useState<boolean>(true);
  const [isTwoWaySyncOpen, setIsTwoWaySyncOpen] = useState<boolean>(false);
  const [isInbuiltSyncModalOpen, setIsInbuiltSyncModalOpen] = useState<boolean>(false);
  const [isAutoAllocatorOpen, setIsAutoAllocatorOpen] = useState<boolean>(false);
  const [isUploadToGoogleCalOpen, setIsUploadToGoogleCalOpen] = useState<boolean>(false);
  const importerSectionRef = useRef<HTMLDivElement>(null);

  // ICS Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportScope, setExportScope] = useState<'all' | 'month' | 'day'>('all');
  const [incPlans, setIncPlans] = useState<boolean>(true);
  const [incSessions, setIncSessions] = useState<boolean>(true);
  const [incExams, setIncExams] = useState<boolean>(true);
  const [incRevisions, setIncRevisions] = useState<boolean>(true);
  const [incTests, setIncTests] = useState<boolean>(true);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Option E: Weekly Mentor Academic Report Modal state
  const [isMentorReportOpen, setIsMentorReportOpen] = useState<boolean>(false);

  // Dedicated Google Tasks Dependency & Sync Modal state
  const [isGoogleTasksModalOpen, setIsGoogleTasksModalOpen] = useState<boolean>(false);

  // Category B: Dynamic Conflict Resolver & Real-time Auto-Rescheduling Modal state
  const [isConflictResolverOpen, setIsConflictResolverOpen] = useState<boolean>(false);

  // 24-Hour Emergency Pre-Exam Triage & Cram Sheet Modal state
  const [isTriageModalOpen, setIsTriageModalOpen] = useState<boolean>(false);
  const [selectedTriageSubject, setSelectedTriageSubject] = useState<string | undefined>(undefined);
  const [vaultMistakes, setVaultMistakes] = useState<any[]>(() => loadMistakes());

  React.useEffect(() => {
    const handleVaultUpdate = () => {
      setVaultMistakes(loadMistakes());
    };
    window.addEventListener('study_mistake_vault_updated', handleVaultUpdate);
    return () => {
      window.removeEventListener('study_mistake_vault_updated', handleVaultUpdate);
    };
  }, []);

  // Day Schedule View Mode: Visual Timeline vs Classic List
  const [dayScheduleViewMode, setDayScheduleViewMode] = useState<'timeline' | 'list'>('timeline');

  // Option G: Adaptive Catch-Up Rollover state
  const [rolloverNotice, setRolloverNotice] = useState<string | null>(null);
  const [isRollingOver, setIsRollingOver] = useState<boolean>(false);

  const handleAdaptiveCatchUpRollover = async () => {
    setIsRollingOver(true);
    setRolloverNotice(null);
    try {
      const res = rolloverIncompleteStudyPlanTopics(plans, selectedDayStr || new Date().toISOString().split('T')[0]);
      if (res.rolledOverCount > 0 && onBatchSavePlans) {
        await onBatchSavePlans(res.updatedPlans);
        triggerStudyGoalConfetti();
      }
      setRolloverNotice(res.message);
      setTimeout(() => setRolloverNotice(null), 8000);
    } catch (err: any) {
      setRolloverNotice(`Rollover error: ${err.message || 'Failed to roll over topics'}`);
    } finally {
      setIsRollingOver(false);
    }
  };

  // Quick Task Scheduling state for selected day
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskTopic, setNewTaskTopic] = useState<string>('');
  const [newTaskSubject, setNewTaskSubject] = useState<string>('');
  const [newTaskChapter, setNewTaskChapter] = useState<string>('');
  const [newTaskStartTime, setNewTaskStartTime] = useState<string>('6:00 PM');
  const [newTaskMinutes, setNewTaskMinutes] = useState<number>(60);
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskReason, setNewTaskReason] = useState<string>('');
  const [isExamPressureDrill, setIsExamPressureDrill] = useState<boolean>(false);
  const [taskActionNotice, setTaskActionNotice] = useState<string | null>(null);

  // Quick Exam Scheduling state (Target Exam & Countdown)
  const [isAddingExam, setIsAddingExam] = useState<boolean>(false);
  const [newExamTitle, setNewExamTitle] = useState<string>('');
  const [newExamSubject, setNewExamSubject] = useState<string>('');
  const [isAnswerSheetModalOpen, setIsAnswerSheetModalOpen] = useState<boolean>(false);

  // Reschedule study session state
  const [editingEvent, setEditingEvent] = useState<InAppCalendarEvent | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('6:00 PM');
  const [editDuration, setEditDuration] = useState<number>(60);

  // Set default subject when subjects prop changes or dialog opens
  useEffect(() => {
    if (subjects.length > 0 && !newTaskSubject) {
      setNewTaskSubject(subjects[0].name);
      setNewExamSubject(subjects[0].name);
    }
  }, [subjects]);

  const handleSaveQuickTask = () => {
    if (!newTaskTopic.trim()) return;
    const resolvedSubject = newTaskSubject.trim() || (subjects.length > 0 ? subjects[0].name : 'General');
    const timeCalc = calculateConsistentEndTime(newTaskStartTime || '6:00 PM', newTaskMinutes || 60);

    const newTopicItem: StudyPlanTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectName: resolvedSubject,
      chapterName: newTaskChapter.trim() || 'General',
      topicName: isExamPressureDrill ? `[Exam Pressure] ${newTaskTopic.trim()}` : newTaskTopic.trim(),
      estimatedMinutes: timeCalc.durationMinutes,
      date: selectedDayStr,
      startTime: timeCalc.startTime12,
      endTime: timeCalc.endTime12,
      deadline: timeCalc.endTime12,
      priority: isExamPressureDrill ? 'High' : newTaskPriority,
      reason: newTaskReason.trim() || (isExamPressureDrill ? 'Timed Board Exam Pressure Sprint' : 'Self-scheduled calendar study session'),
      completed: false
    };

    // Aggregate any existing topics across all plan records for this date
    const existingTopics = dayPlans.flatMap(p => p.topics || []);
    const updatedTopics = [...existingTopics, newTopicItem];

    const basePlan: StudyPlan = dayPlan || {
      id: `plan-${selectedDayStr}`,
      userId: userProfile?.id || 'guest',
      title: `Plan for ${selectedDayStr}`,
      date: selectedDayStr,
      topics: [],
      reasoning: isExamPressureDrill ? 'Timed Board Exam Pressure Sprint' : 'Self-scheduled calendar study session',
      createdAt: new Date().toISOString()
    };

    const newEvent = analyzeStudyTopicIntoCalendarEvent(basePlan, newTopicItem, updatedTopics.length - 1);
    const existingEvents = dayPlans.flatMap(p => p.calendarEvents || []);
    const updatedPlan: StudyPlan = {
      ...basePlan,
      topics: updatedTopics,
      calendarEvents: [...existingEvents, newEvent],
      updatedAt: new Date().toISOString()
    };

    if (onSavePlan) onSavePlan(updatedPlan);

    setTaskActionNotice(`✓ Added "${newTopicItem.topicName}" to Inbuilt Calendar (${timeCalc.startTime12}–${timeCalc.endTime12})!`);
    setNewTopicItemStateReset();
    setTimeout(() => setTaskActionNotice(null), 4000);
  };

  /**
   * 1-Click Fast-Track: Instantly injects an authentic Exam Pressure Drill into the day's schedule.
   * Supports:
   * - 21.5s/MCQ Rapid Blitz (15m block)
   * - 2m/SQ Short Question Sprint (20m block)
   * - 15m/LQ Long Question Dossier (45m block)
   */
  const handleQuickAddExamSprint = (type: 'mcq' | 'short' | 'long') => {
    const resolvedSubject = newTaskSubject.trim() || (subjects.length > 0 ? subjects[0].name : 'General Science');
    const title = type === 'mcq'
      ? `[Exam Pressure] 21.5s MCQ Rapid Blitz (${resolvedSubject})`
      : type === 'short'
      ? `[Exam Pressure] 2-Min Short Question Sprint (${resolvedSubject})`
      : `[Exam Pressure] 15-Min Long Question Dossier (${resolvedSubject})`;
    const duration = type === 'mcq' ? 15 : type === 'short' ? 20 : 45;
    const timeCalc = calculateConsistentEndTime(newTaskStartTime || '5:00 PM', duration);

    const newTopicItem: StudyPlanTopic = {
      id: `topic-exam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectName: resolvedSubject,
      chapterName: newTaskChapter.trim() || 'Board Exam Prep',
      topicName: title,
      estimatedMinutes: duration,
      date: selectedDayStr,
      startTime: timeCalc.startTime12,
      endTime: timeCalc.endTime12,
      deadline: timeCalc.endTime12,
      priority: 'High',
      reason: `Timed Board Exam Pressure Sprint (${type === 'mcq' ? '21.5s/MCQ Benchmark' : type === 'short' ? '2m/SQ Quick Mode' : '15m/LQ Quick Mode'})`,
      completed: false
    };

    const existingTopics = dayPlans.flatMap(p => p.topics || []);
    const updatedTopics = [...existingTopics, newTopicItem];

    const basePlan: StudyPlan = dayPlan || {
      id: `plan-${selectedDayStr}`,
      userId: userProfile?.id || 'guest',
      title: `Plan for ${selectedDayStr}`,
      date: selectedDayStr,
      topics: [],
      reasoning: 'Timed Board Exam Pressure Sprint',
      createdAt: new Date().toISOString()
    };

    const newEvent = analyzeStudyTopicIntoCalendarEvent(basePlan, newTopicItem, updatedTopics.length - 1);
    const existingEvents = dayPlans.flatMap(p => p.calendarEvents || []);
    const updatedPlan: StudyPlan = {
      ...basePlan,
      topics: updatedTopics,
      calendarEvents: [...existingEvents, newEvent],
      updatedAt: new Date().toISOString()
    };

    if (onSavePlan) onSavePlan(updatedPlan);
    setTaskActionNotice(`⚡ Scheduled "${title}" (${duration}m) into Inbuilt Calendar immediately!`);
    setTimeout(() => setTaskActionNotice(null), 4000);
  };

  /**
   * Auto-rebalances workload for overloaded or burnout risk days by moving excess study block to next day.
   */
  const handleRebalanceDayWorkload = (targetDate: string) => {
    const plansForDate = plans.filter(p => p.date === targetDate);
    if (plansForDate.length === 0 || !onSavePlan) return;
    
    const nextDateObj = new Date(targetDate);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];

    const planToShift = plansForDate[0];
    if (!planToShift.topics || planToShift.topics.length <= 1) {
      setTaskActionNotice(`Notice: Only 1 task on ${targetDate}. Workload already minimal.`);
      setTimeout(() => setTaskActionNotice(null), 3000);
      return;
    }

    const shiftedTopic = planToShift.topics[planToShift.topics.length - 1];
    const remainingTopics = planToShift.topics.slice(0, -1);

    const updatedCurrentPlan: StudyPlan = {
      ...planToShift,
      topics: remainingTopics,
      calendarEvents: (planToShift.calendarEvents || []).filter(e => e.topicName !== shiftedTopic.topicName),
      updatedAt: new Date().toISOString()
    };
    onSavePlan(updatedCurrentPlan);

    const nextDayPlan = plans.find(p => p.date === nextDateStr);
    const shiftedTopicWithNewDate: StudyPlanTopic = {
      ...shiftedTopic,
      date: nextDateStr,
      id: `topic-${Date.now()}`
    };

    if (nextDayPlan) {
      const updatedNextTopics = [...(nextDayPlan.topics || []), shiftedTopicWithNewDate];
      const nextPlanUpdated: StudyPlan = {
        ...nextDayPlan,
        topics: updatedNextTopics,
        updatedAt: new Date().toISOString()
      };
      const { plan: analyzedNext } = analyzeStudyPlanIntoCalendar(nextPlanUpdated);
      onSavePlan(analyzedNext);
    } else {
      const brandNewNextPlan: StudyPlan = {
        id: `plan-${nextDateStr}`,
        userId: userProfile?.id || 'guest',
        title: `Plan for ${nextDateStr}`,
        date: nextDateStr,
        topics: [shiftedTopicWithNewDate],
        reasoning: 'Rebalanced study workload session',
        createdAt: new Date().toISOString()
      };
      const { plan: analyzedNext } = analyzeStudyPlanIntoCalendar(brandNewNextPlan);
      onSavePlan(analyzedNext);
    }

    setTaskActionNotice(`⚖️ Rebalanced! Shifted "${shiftedTopic.topicName}" from ${targetDate} to ${nextDateStr}.`);
    setTimeout(() => setTaskActionNotice(null), 4500);
  };

  const setNewTopicItemStateReset = () => {
    setNewTaskTopic('');
    setNewTaskChapter('');
    setNewTaskReason('');
    setIsExamPressureDrill(false);
    setIsAddingTask(false);
  };

  const handleSaveExam = () => {
    if (!newExamTitle.trim() || !userProfile || !onUpdateProfile) return;
    const resolvedSubject = newExamSubject.trim() || (subjects.length > 0 ? subjects[0].name : 'General');
    const newExam: ExamDate = {
      id: `exam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectName: resolvedSubject,
      examName: newExamTitle.trim(),
      date: selectedDayStr
    };

    const updatedProfile: UserProfile = {
      ...userProfile,
      examDates: [...(userProfile.examDates || []).filter(e => e.id !== newExam.id), newExam]
    };
    onUpdateProfile(updatedProfile);

    setTaskActionNotice(`✓ Scheduled Target Exam "${newExam.examName}" on ${selectedDayStr}! Countdown active.`);
    setNewExamTitle('');
    setIsAddingExam(false);
    setTimeout(() => setTaskActionNotice(null), 4500);
  };

  const handleToggleEventCompletion = async (event: InAppCalendarEvent) => {
    const nextCompleted = !event.completed;
    if (onToggleTopicCompletion && event.planId && event.planTopicId) {
      onToggleTopicCompletion(event.planId, event.planTopicId, nextCompleted);
    } else if (onSavePlan && event.planId) {
      const parentPlan = plans.find(p => p.id === event.planId);
      if (parentPlan) {
        const updatedTopics = parentPlan.topics.map(t => {
          if (t.id === event.planTopicId || t.calendarEventId === event.id) {
            return {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : undefined
            };
          }
          return t;
        });
        const updatedEvents = (parentPlan.calendarEvents || []).map(evt => {
          if (evt.id === event.id) {
            return {
              ...evt,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : undefined
            };
          }
          return evt;
        });
        await onSavePlan({
          ...parentPlan,
          topics: updatedTopics,
          calendarEvents: updatedEvents,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Toggle in Google Tasks for Zapier accountability
    toggleInAppEventCompletionExternal(event, nextCompleted).catch(err => {
      console.warn('Failed to toggle external Google Task status:', err);
    });

    setTaskActionNotice(`${nextCompleted ? '✓ Completed' : '↺ Reopened'}: "${event.topicName}" (Google Tasks updated)`);
    setTimeout(() => setTaskActionNotice(null), 3000);
  };

  const handleSaveReschedule = async () => {
    if (!editingEvent) return;
    const parentPlan = plans.find(p => p.id === editingEvent.planId);
    if (!parentPlan) return;

    const timeCalc = calculateConsistentEndTime(editStartTime, editDuration);
    const updatedTopics = parentPlan.topics.map(t => {
      if (t.id === editingEvent.planTopicId || t.calendarEventId === editingEvent.id) {
        return {
          ...t,
          date: editDate,
          startTime: timeCalc.startTime12,
          endTime: timeCalc.endTime12,
          estimatedMinutes: editDuration,
          deadline: timeCalc.endTime12
        };
      }
      return t;
    });

    const updatedEvents = (parentPlan.calendarEvents || []).map(evt => {
      if (evt.id === editingEvent.id) {
        return {
          ...evt,
          date: editDate,
          startTime: timeCalc.startTime12,
          endTime: timeCalc.endTime12,
          durationMinutes: editDuration,
          deadline: timeCalc.endTime12
        };
      }
      return evt;
    });

    const updatedPlan: StudyPlan = {
      ...parentPlan,
      topics: updatedTopics,
      calendarEvents: updatedEvents,
      updatedAt: new Date().toISOString()
    };

    if (onSavePlan) {
      await onSavePlan(updatedPlan);
    }

    // Synchronize to external Google Calendar & Tasks in sync
    const updatedEvt = updatedEvents.find(e => e.id === editingEvent.id);
    if (updatedEvt && (updatedEvt.googleCalendarEventId || updatedEvt.googleTaskId)) {
      synchronizeInAppEventToExternalServices(updatedEvt).catch(e => {
        console.warn('Could not sync rescheduled event to external services:', e);
      });
    }

    setEditingEvent(null);
    setTaskActionNotice(`✓ Rescheduled "${editingEvent.topicName}" to ${formatHumanDate(editDate)}, ${timeCalc.startTime12}–${timeCalc.endTime12}!`);
    setTimeout(() => setTaskActionNotice(null), 4000);
  };

  const handleDeleteCalendarEvent = async (event: InAppCalendarEvent) => {
    const parentPlan = plans.find(p => p.id === event.planId);
    if (!parentPlan) return;

    const updatedTopics = parentPlan.topics.filter(t => t.id !== event.planTopicId && t.calendarEventId !== event.id);
    const updatedEvents = (parentPlan.calendarEvents || []).filter(e => e.id !== event.id);

    const updatedPlan: StudyPlan = {
      ...parentPlan,
      topics: updatedTopics,
      calendarEvents: updatedEvents,
      updatedAt: new Date().toISOString()
    };

    if (onSavePlan) {
      await onSavePlan(updatedPlan);
    }

    // Delete from external Google Calendar and Google Tasks
    deleteInAppEventFromExternalServices(event).catch(err => {
      console.warn('Could not delete event from external Google services:', err);
    });

    setTaskActionNotice(`Removed "${event.topicName}" from Inbuilt Calendar and external Google records.`);
    setTimeout(() => setTaskActionNotice(null), 3500);
  };

  const handleDeleteQuickTask = (topicIdx: number) => {
    if (!dayPlan) return;
    const removedTopic = dayPlan.topics[topicIdx];
    const updatedTopics = dayPlan.topics.filter((_, idx) => idx !== topicIdx);
    const updatedPlan: StudyPlan = {
      ...dayPlan,
      topics: updatedTopics
    };
    if (onSavePlan) onSavePlan(updatedPlan);
    setTaskActionNotice(`Removed "${removedTopic?.topicName || 'task'}" and synced across devices.`);
    setTimeout(() => setTaskActionNotice(null), 3000);
  };

  const handleTriggerExport = () => {
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (exportScope === 'month') {
      const year = currentMonthDate.getFullYear();
      const monthFormatted = String(currentMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, currentMonthDate.getMonth() + 1, 0).getDate();
      const lastDayFormatted = String(lastDay).padStart(2, '0');

      startDate = `${year}-${monthFormatted}-01`;
      endDate = `${year}-${monthFormatted}-${lastDayFormatted}`;
    } else if (exportScope === 'day') {
      startDate = selectedDayStr;
      endDate = selectedDayStr;
    }

    const icsString = generateIcsCalendarContent({
      plans,
      sessions,
      examDates: userProfile?.examDates || [],
      revisions,
      testResults,
      includePlans: incPlans,
      includeSessions: incSessions,
      includeExams: incExams,
      includeRevisions: incRevisions,
      includeTests: incTests,
      calendarName: userProfile?.displayName ? `${userProfile.displayName}'s Study Schedule` : 'StudyFlow Academic Schedule',
      startDate,
      endDate
    });

    const filename = exportScope === 'month' 
      ? `study_schedule_${currentMonthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '_')}.ics`
      : exportScope === 'day'
      ? `study_schedule_${selectedDayStr}.ics`
      : 'study_schedule_full.ics';

    downloadIcsFile(icsString, filename);

    setExportSuccessMsg(`Successfully generated and downloaded ${filename}! Import it into Google Calendar, Outlook, or Apple Calendar.`);
    setTimeout(() => {
      setExportSuccessMsg(null);
    }, 6000);
  };

  // Month navigation
  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  // When AI importer adds dates
  const handleDatesImported = (dates: string[]) => {
    if (dates.length > 0) {
      const firstDate = dates[0];
      setSelectedDayStr(firstDate);
      const [y, m] = firstDate.split('-');
      setCurrentMonthDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    }
  };

  const monthYearStr = currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Generate days matrix for calendar grid
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (string | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayFormatted = String(d).padStart(2, '0');
    const monthFormatted = String(month + 1).padStart(2, '0');
    daysArray.push(`${year}-${monthFormatted}-${dayFormatted}`);
  }

  // Day specific data filters for selectedDayStr
  const daySessions = sessions.filter(s => s.date === selectedDayStr);
  const dayPlans = plans.filter(p => p.date === selectedDayStr);
  const dayPlan = dayPlans[0] || null;

  // Inbuilt Calendar Events: Primary Source of Truth
  const allCalendarEvents = React.useMemo(() => {
    return getAllInAppCalendarEvents(plans);
  }, [plans]);

  // Events specifically scheduled for selectedDayStr (instantly aggregated across all dayPlans)
  const dayCalendarEvents = React.useMemo(() => {
    const list = allCalendarEvents.filter(e => e.date === selectedDayStr);
    const seenEventKeys = new Set(list.map(e => e.id));
    
    // Immediately synthesize any topic from dayPlans that may not be in list yet
    dayPlans.forEach(p => {
      (p.topics || []).forEach((t, idx) => {
        const alreadyInList = list.some(e => e.id === t.calendarEventId || (e.topicName.toLowerCase() === (t.topicName || '').toLowerCase() && e.subjectName.toLowerCase() === (t.subjectName || '').toLowerCase()));
        if (!alreadyInList) {
          const generated = analyzeStudyTopicIntoCalendarEvent(p, t, idx);
          if (!seenEventKeys.has(generated.id)) {
            seenEventKeys.add(generated.id);
            list.push(generated);
          }
        }
      });
    });
    return list;
  }, [allCalendarEvents, dayPlans, selectedDayStr]);

  // Deduplicate and aggregate all topics across any plans logged for this date
  const dayTopics: StudyPlanTopic[] = React.useMemo(() => {
    const topicMap = new Map<string, StudyPlanTopic>();
    dayPlans.forEach(p => {
      (p.topics || []).forEach(t => {
        const key = `${(t.subjectName || '').toLowerCase()}::${(t.topicName || '').toLowerCase()}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, t);
        }
      });
    });
    return Array.from(topicMap.values());
  }, [dayPlans]);
  const dayTests = testResults.filter(t => t.date === selectedDayStr);
  const dayExams = (userProfile?.examDates || []).filter(e => e.date === selectedDayStr);
  const dayRevisions = revisions.filter(r => r.dueDate === selectedDayStr);

  // Multi-Month Workload Analysis
  const [calendarSubView, setCalendarSubView] = useState<'calendar' | 'test_prep' | 'workload'>('calendar');
  const testTimelines = React.useMemo(() => {
    return buildTestPreparationTimelines(subjects, assignments, sessions, revisions);
  }, [subjects, assignments, sessions, revisions]);

  const workloadDiagnostics = React.useMemo(() => {
    return calculateMultiMonthWorkload(plans, revisions, assignments, 30);
  }, [plans, revisions, assignments]);

  // Category B: Real-time Schedule Conflict & Overcapacity Diagnostics
  const scheduleDiagnosis = React.useMemo(() => {
    return diagnoseScheduleConflicts({
      plans,
      inAppEvents: allCalendarEvents,
      assignments,
      examDates: userProfile?.examDates || [],
      revisions,
      userProfile
    });
  }, [plans, allCalendarEvents, assignments, userProfile, revisions]);

  // 24-Hour Pre-Exam Triage Impending Exams
  const impendingExams = React.useMemo(() => {
    return getImpendingExams(userProfile?.examDates || []);
  }, [userProfile?.examDates]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 24-Hour Emergency Pre-Exam Triage Desk Banner */}
      {impendingExams.length > 0 && impendingExams[0].hoursRemaining <= 48 && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-xs font-bold text-primary flex items-center gap-2">
                <span>🚨 Emergency Pre-Exam Triage: {impendingExams[0].exam.subjectName} Exam in {impendingExams[0].hoursRemaining}h</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold animate-pulse">
                  {impendingExams[0].isUrgent ? 'URGENT 24H' : 'APPROACHING'}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                Suppresses low-yield textbook clutter. Access your customized 1-page A4 Cram Sheet, formula traps, and 10-minute confidence primer.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedTriageSubject(impendingExams[0].exam.subjectName);
              setIsTriageModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 shadow-xs active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Open 24h Cram Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Category B: Schedule Conflict Warning Banner if clashes exist */}
      {scheduleDiagnosis.conflicts.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-xs font-bold text-primary flex items-center gap-2">
                <span>{scheduleDiagnosis.conflicts.length} Timetable Clashes & Inefficiencies Detected</span>
                {scheduleDiagnosis.criticalCount > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">
                    {scheduleDiagnosis.criticalCount} Critical
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                Overlapping time-blocks or overloaded study days detected. 1-click auto-rescheduling will rebalance your study slots cleanly.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsConflictResolverOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 shadow-xs active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Auto-Reschedule & Rebalance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#6B705C] flex items-center justify-center text-white shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
                <span>Academic Study Calendar & Timeline</span>
              </h2>
            </div>
            <p className="text-xs text-[#A5A58D] mt-1">
              Real-time Inbuilt Calendar • 1-3-7 Spaced Revisions • Multi-Month Exam Pressure Diagnostics
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
          <button
            onClick={() => setCalendarSubView('calendar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              calendarSubView === 'calendar'
                ? 'bg-[#6B705C] text-white shadow-xs'
                : 'text-[#6B705C] hover:bg-[#F2EFE9]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => setCalendarSubView('test_prep')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              calendarSubView === 'test_prep'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-purple-800 hover:bg-purple-50'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Test Timelines ({testTimelines.length})</span>
          </button>

          <button
            onClick={() => setCalendarSubView('workload')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              calendarSubView === 'workload'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-indigo-800 hover:bg-indigo-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Multi-Month Workload</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Device 1: Google Calendar (Option A: Dedicated Study Calendar) */}
            <button
              onClick={() => setIsInbuiltSyncModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Option A: Sync to dedicated StudyFlow Academic Schedule in Google Calendar"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Google Calendar</span>
            </button>

            {/* Device 2: iPad and Apple Calendar (.ics export with timed alarms) */}
            <button
              onClick={() => {
                downloadCalendarICS({
                  plans,
                  revisions,
                  assignments,
                  preferredStartTime: '09:00',
                  alarmMinutesBefore: [30, 10]
                });
              }}
              className="px-3.5 py-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Download .ics schedule for iPad, iPhone, and Apple Calendar with built-in timed alarms"
            >
              <Download className="w-3.5 h-3.5" />
              <span>iPad / Apple Calendar</span>
            </button>

            {/* Device 3: Schedule & Timetable Importer */}
            <button
              onClick={() => {
                setShowImporterBox(true);
                setTimeout(() => {
                  importerSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-3.5 py-2 rounded-2xl bg-[#6B705C]/15 hover:bg-[#6B705C]/25 text-[#2B2D42] font-bold text-xs transition flex items-center gap-1.5 shadow-2xs border border-[#6B705C]/30 cursor-pointer active:scale-95"
              title="Paste and import external timetable or syllabus pace"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Schedule Import</span>
            </button>

            {/* Device 4: Google Tasks (with target list dependency) */}
            <button
              onClick={() => setIsGoogleTasksModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Select target task list dependency and sync study sessions to Google Tasks"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Google Tasks</span>
            </button>

            {/* Device 5: Printable Monthly Wall Calendar with Boxes */}
            <button
              onClick={() => {
                openStudyKitPrintWindow({
                  format: 'monthly_wall_calendar',
                  selectedSubjectNames: subjects ? subjects.map(s => s.name) : [],
                  includeFormulas: true,
                  includeMnemonics: true,
                  includeFlashcards: false,
                  includeExams: true,
                  columns: 2,
                  fontSize: 'standard',
                  title: `Academic Wall Calendar — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                  notes: 'Check off boxes daily to maintain peak study consistency.'
                }, {
                  subjects: subjects || [],
                  flashcardDecks: [],
                  plans,
                  userProfile,
                  revisions
                });
              }}
              className="px-3.5 py-2 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Print Monthly Academic Wall Calendar with daily check-off boxes"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Wall Calendar</span>
            </button>

            <div className="h-5 w-[1px] bg-[#E0DBD0] mx-0.5 hidden sm:block" />

            {/* Option E: Weekly Mentor Academic Report & Habit Box */}
            <button
              onClick={() => setIsMentorReportOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Generate weekly academic progress report and habit review for your mentor / senior"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Mentor Report & Habits</span>
            </button>

            {/* Option G: Adaptive Catch-Up Rollover */}
            <button
              onClick={handleAdaptiveCatchUpRollover}
              disabled={isRollingOver}
              className="px-3.5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Option G: Adaptive rollover of past incomplete study topics into upcoming slots"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRollingOver ? 'animate-spin' : ''}`} />
              <span>{isRollingOver ? 'Rolling Over...' : '⚡ Catch-Up Rollover'}</span>
            </button>

            {/* Category B Option 1: Dynamic Conflict Resolver & Auto-Rescheduler */}
            <button
              onClick={() => setIsConflictResolverOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Category B: Resolve timetable conflicts, overlaps, and auto-reschedule overloaded sessions"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Resolve Clashes ({scheduleDiagnosis.conflicts.length})</span>
            </button>

            {/* 24-Hour Emergency Pre-Exam Cram Desk Button */}
            <button
              onClick={() => {
                setSelectedTriageSubject(undefined);
                setIsTriageModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              title="Launch 24-Hour Pre-Exam Emergency Triage Desk and printable A4 cheat sheet"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>🚨 24h Cram Desk</span>
            </button>

            {/* Syllabus-to-Calendar Auto-Allocator */}
            <button
              onClick={() => setIsAutoAllocatorOpen(true)}
              className="px-3 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Auto-allocate uncompleted syllabus topics (200-300+ items) across calendar dates"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Auto-Allocate</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Export schedule as .ics file for Google Calendar / Outlook"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .ICS</span>
            </button>

            <button
              onClick={() => {
                const today = new Date();
                setCurrentMonthDate(today);
                setSelectedDayStr(today.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 rounded-2xl bg-[#F9F7F2] hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-xs font-bold font-mono transition shadow-2xs cursor-pointer"
              title="Snap calendar directly back to today"
            >
              Today
            </button>

            <div className="flex items-center gap-2 bg-[#F9F7F2] p-1.5 rounded-2xl border border-[#E0DBD0]">
              <button onClick={prevMonth} className="p-1.5 text-[#A5A58D] hover:text-[#4A4E4D] rounded-xl transition cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold font-mono text-[#4A4E4D] px-3">{monthYearStr}</span>
              <button onClick={nextMonth} className="p-1.5 text-[#A5A58D] hover:text-[#4A4E4D] rounded-xl transition cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {rolloverNotice && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
            <span>{rolloverNotice}</span>
            <button onClick={() => setRolloverNotice(null)} className="font-bold opacity-60 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}
      </div>

      {/* LIVE CONNECTION & ALLOCATION STATUS BRIDGE */}
      <div className="bg-[#F9F7F2] border border-[#E0DBD0] rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Cloud Database Connection */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-[#E0DBD0] text-[#4A4E4D]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold">Cloud Database:</span>
            <span className="text-[#6B705C] font-mono font-semibold">
              {plans.length} Study Plans Active (500+ allocation safe)
            </span>
          </div>

          {/* Google Workspace / Calendar Connection */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-[#E0DBD0] text-[#4A4E4D]">
            <Globe className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-bold">Google Calendar:</span>
            <span className="text-sky-700 font-medium">Connected & 2-Way Sync Ready</span>
            <button
              onClick={() => setIsTwoWaySyncOpen(true)}
              className="ml-1 text-[11px] underline text-sky-600 hover:text-sky-800 font-bold cursor-pointer"
            >
              Sync Now
            </button>
          </div>

          {/* 1-3-7 Spaced Revision Connection */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-[#E0DBD0] text-[#4A4E4D]">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span className="font-bold">1-3-7 Spaced Revision:</span>
            <span className="text-purple-700 font-medium">{revisions.length} Cycles Connected</span>
            {setActiveTab && (
              <button
                onClick={() => setActiveTab('137_revision')}
                className="ml-1 text-[11px] underline text-purple-600 hover:text-purple-800 font-bold cursor-pointer"
              >
                Open 1-3-7 Center
              </button>
            )}
          </div>
        </div>

        {/* High Volume / 108 Items Safeguard Notice */}
        <div className="text-[11px] text-[#A5A58D] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Batch Atomic Firestore Engine enabled (Safe for 108+ topic allocations)</span>
        </div>
      </div>

      {/* AI CALENDAR & SCHEDULE IMPORTER BOX (Prominently available in Calendar Area) */}
      <div ref={importerSectionRef}>
        {onSavePlan && (
          <AICalendarScheduleImporter
            subjects={subjects}
            userProfile={userProfile}
            onSavePlan={onSavePlan}
            onBatchSavePlans={onBatchSavePlans}
            onUpdateProfile={onUpdateProfile}
            onDatesImported={handleDatesImported}
            initialOpen={showImporterBox}
          />
        )}
      </div>

      {/* Calendar Grid & Day Details OR Alternate SubViews */}
      {calendarSubView === 'test_prep' ? (
        <div className="space-y-6">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-700" />
                <span>Active Test Preparation Engines ({testTimelines.length})</span>
              </h3>
              <p className="text-xs text-[#A5A58D] mt-0.5">
                Every test scheduled in your calendar triggers this strategic backward-planning countdown covering all audited SLOs.
              </p>
            </div>
            <button
              onClick={() => setCalendarSubView('calendar')}
              className="px-3 py-1.5 rounded-xl border border-[#E0DBD0] text-xs font-bold text-[#6B705C] hover:bg-[#F2EFE9] transition"
            >
              ← Back to Calendar
            </button>
          </div>

          {testTimelines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {testTimelines.map(timeline => (
                <TestPreparationTimelineCard
                  key={timeline.testId}
                  timeline={timeline}
                  onStartTimerForTopic={onStartTimerForTopic || (() => {})}
                  onNavigateTab={setActiveTab}
                />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E0DBD0] space-y-3">
              <Target className="w-12 h-12 text-purple-400 mx-auto" />
              <h4 className="font-bold text-base text-[#4A4E4D]">No Upcoming Tests or Exams Found</h4>
              <p className="text-xs text-[#A5A58D] max-w-md mx-auto">
                Schedule an exam or past paper in the Assignments/Tests view or use the quick task adder to automatically generate your preparation timeline!
              </p>
            </div>
          )}
        </div>
      ) : calendarSubView === 'workload' ? (
        <div className="space-y-6">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 shadow-2xs">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                  <span>Multi-Month Study Workload & Stress Diagnostic</span>
                </h3>
                <p className="text-xs text-[#A5A58D] mt-0.5">
                  Scans 30+ days ahead across Planner tasks, 1-3-7 Spaced Revisions, and Exam Dates to identify burnout risks and conflicts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCalendarSubView('calendar')}
              className="px-3 py-1.5 rounded-xl border border-[#E0DBD0] text-xs font-bold text-[#6B705C] hover:bg-[#F2EFE9] transition"
            >
              ← Back to Calendar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {workloadDiagnostics.map(diag => {
              const isSelected = diag.date === selectedDayStr;
              return (
                <div
                  key={diag.date}
                  onClick={() => setSelectedDayStr(diag.date)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between h-32 ${
                    isSelected ? 'ring-2 ring-indigo-600 shadow-sm ' : ''
                  }${
                    diag.pressureLevel === 'burnout_risk'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-900'
                      : diag.pressureLevel === 'overloaded'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-900'
                      : diag.pressureLevel === 'moderate'
                      ? 'bg-blue-500/5 border-blue-500/20 text-blue-900'
                      : 'bg-white border-[#E0DBD0] text-[#4A4E4D]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                      <span>{diag.date.slice(5)}</span>
                      {diag.isTestDay && <span className="px-1 rounded bg-purple-600 text-white text-[8px]">EXAM</span>}
                    </div>
                    <div className="text-sm font-extrabold mt-1">
                      {diag.totalCommitmentHours} hrs
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] opacity-80 flex items-center justify-between">
                      <span>Plans: {diag.plannedTasksCount}</span>
                      <span>1-3-7: {diag.revisionsDue137Count}</span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full ${
                      diag.pressureLevel === 'burnout_risk'
                        ? 'bg-rose-600'
                        : diag.pressureLevel === 'overloaded'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Workload Day Quick Action Bar */}
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F2EFE9] flex items-center justify-center text-[#6B705C] border border-[#E0DBD0]">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#A5A58D]">
                    Selected Diagnostic Date
                  </div>
                  <h4 className="text-base font-bold text-[#4A4E4D]">
                    {formatHumanDate(selectedDayStr)} ({selectedDayStr})
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCalendarSubView('calendar')}
                  className="px-3 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Open in Calendar Grid</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRebalanceDayWorkload(selectedDayStr)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Shift 1 excess task from overloaded day to next lighter day"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-700" />
                  <span>⚖️ Rebalance Workload</span>
                </button>
              </div>
            </div>

            {/* Quick 1-Click Fast Track Exam Drill Injection from Workload */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#6B705C] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-rose-600" />
                <span>Instant Exam Pressure Sprints (0ms Direct Injection into this Date):</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAddExamSprint('mcq')}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Zap className="w-3.5 h-3.5 text-rose-600" />
                  <span>⚡ +21.5s MCQ Rapid Blitz (15m)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAddExamSprint('short')}
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>⚡ +2m Short Question Drill (20m)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAddExamSprint('long')}
                  className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Award className="w-3.5 h-3.5 text-purple-600" />
                  <span>⚡ +15m Long Question Dossier (45m)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAnswerSheetModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-700" />
                  <span>🖨️ Print SBBM Answer Sheet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-4">
          {/* Days Header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-[#A5A58D] font-mono py-2 border-b border-[#E0DBD0]">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {daysArray.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} className="h-20 bg-[#F9F7F2]/40 rounded-2xl"></div>;
              }

              const isSelected = dateStr === selectedDayStr;
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              const hasSessions = sessions.some(s => s.date === dateStr);
              const dayPlansForDate = plans.filter(p => p.date === dateStr);
              const hasPlan = dayPlansForDate.length > 0;
              const totalPlannedTopics = dayPlansForDate.reduce((acc, p) => acc + p.topics.length, 0);
              const hasExam = (userProfile?.examDates || []).some(e => e.date === dateStr);
              const dayRevisionsForDate = revisions.filter(r => r.dueDate === dateStr);
              const hasRevisions = dayRevisionsForDate.length > 0;
              const dayNum = parseInt(dateStr.split('-')[2]);

              // Gather badges for event stacking
              const dayBadges: Array<{ label: string; className: string }> = [];
              if (hasExam) {
                dayBadges.push({ label: 'Exam', className: 'bg-rose-100 text-rose-800' });
              }
              if (hasSessions) {
                dayBadges.push({ label: '✓ Studied', className: 'bg-[#6B705C]/20 text-[#6B705C]' });
              }
              if (hasPlan) {
                dayBadges.push({ label: `Plan (${totalPlannedTopics})`, className: 'bg-amber-100 text-amber-800' });
              }
              if (hasRevisions) {
                dayBadges.push({ label: `Rev (${dayRevisionsForDate.length})`, className: 'bg-purple-100 text-purple-800' });
              }
              const dayAssignmentsForDate = (assignments || []).filter(a => a.dueDate === dateStr && !a.completed);
              if (dayAssignmentsForDate.length > 0) {
                dayBadges.push({ label: `Due (${dayAssignmentsForDate.length})`, className: 'bg-blue-100 text-blue-800' });
              }

              // Event stacking: show first 2 items; if 3 or more, show 1 item + "+N more" badge
              const visibleBadges = dayBadges.length > 2 ? dayBadges.slice(0, 1) : dayBadges;
              const overflowCount = dayBadges.length - visibleBadges.length;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDayStr(dateStr)}
                  className={`min-h-[82px] p-2 rounded-2xl cursor-pointer border transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#6B705C]/15 border-[#6B705C] shadow-xs'
                      : isToday
                      ? 'bg-[#F2EFE9] border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-bold ${isToday ? 'text-[#6B705C]' : 'text-[#4A4E4D]'}`}>
                      {dayNum}
                    </span>
                    {hasExam && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-2xs" title="Exam scheduled"></span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {visibleBadges.map((b, bIdx) => (
                      <div
                        key={bIdx}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate leading-tight ${b.className}`}
                      >
                        {b.label}
                      </div>
                    ))}
                    {overflowCount > 0 && (
                      <div
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EAE7DF] text-[#4A4E4D] border border-[#E0DBD0] truncate"
                        title={`${overflowCount} more items today. Click day to view all.`}
                      >
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail Drawer */}
        <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 shadow-xs space-y-5">
          <div className="border-b border-[#E0DBD0] pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Inbuilt Calendar • Source of Truth
                </span>
              </div>
              <h3 className="text-base font-serif italic font-bold text-[#6B705C] mt-1">
                {formatHumanDate(selectedDayStr)} <span className="font-mono text-xs font-normal text-[#A5A58D]">({selectedDayStr})</span>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {dayCalendarEvents.length} Session(s)
              </span>
            </div>
          </div>

          {/* Feedback notice for added/deleted task */}
          {taskActionNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-2xl flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{taskActionNotice}</span>
            </div>
          )}

          {/* Scheduled Exams */}
          {dayExams.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
              <span className="font-bold text-rose-800 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Exam Scheduled Today!
              </span>
              {dayExams.map((e) => (
                <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl bg-white border border-rose-200/60">
                  <div className="text-rose-950 font-medium">
                    <strong>{e.examName}</strong> ({e.subjectName})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTriageSubject(e.subjectName);
                      setIsTriageModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] flex items-center gap-1 transition shadow-2xs cursor-pointer w-fit"
                    title="Launch 24-Hour Pre-Exam Triage Desk for this exam"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>⚡ 24h Cram Desk</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Scheduled Study Sessions (Inbuilt Application Calendar) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold text-[#6B705C] uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#6B705C]" />
                <span>Scheduled Study Sessions:</span>
              </h4>
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* View Mode Toggle: Timeline vs List */}
                <div className="flex items-center gap-0.5 bg-[#F9F7F2] p-0.5 rounded-xl border border-[#E0DBD0] text-xs">
                  <button
                    type="button"
                    onClick={() => setDayScheduleViewMode('timeline')}
                    className={`px-2 py-0.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      dayScheduleViewMode === 'timeline'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'text-[#6B705C] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayScheduleViewMode('list')}
                    className={`px-2 py-0.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      dayScheduleViewMode === 'list'
                        ? 'bg-[#6B705C] text-white shadow-2xs'
                        : 'text-[#6B705C] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    List
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTask(!isAddingTask);
                    if (isAddingExam) setIsAddingExam(false);
                  }}
                  className="px-2.5 py-1 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAddingTask ? 'Cancel' : 'Schedule Session'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddingExam(!isAddingExam);
                    if (isAddingTask) setIsAddingTask(false);
                  }}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Schedule a Target Exam Date with automatic countdown"
                >
                  <Award className="w-3 h-3" />
                  <span>{isAddingExam ? 'Cancel Exam' : '+ Target Exam'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAnswerSheetModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                  title="Print Official SBBM Answer Sheet with Target Stamps"
                >
                  <Printer className="w-3 h-3 text-amber-600" />
                  <span>Answer Sheet</span>
                </button>
              </div>
            </div>

            {/* 1-Click Fast-Track Exam Pressure Sprint Injectors */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-600" />
                  <span>1-Click Exam Pressure Sprints (0ms Direct Injection):</span>
                </span>
                <span className="text-[10px] text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded font-mono">Exam Pacer</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAddExamSprint('mcq')}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Schedule 21.5s/MCQ timed blitz into this day"
                >
                  <Zap className="w-3 h-3 text-rose-600" />
                  <span>⚡ +21.5s MCQ Blitz</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddExamSprint('short')}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Schedule 2-minute short question drill into this day"
                >
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>⚡ +2m Short Q Drill</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddExamSprint('long')}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Schedule 15-minute long question dossier into this day"
                >
                  <Award className="w-3 h-3 text-purple-600" />
                  <span>⚡ +15m Long Q Dossier</span>
                </button>
              </div>
            </div>

            {/* Inline Target Exam Creator */}
            {isAddingExam && (
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-300 space-y-3 animate-fade-in shadow-2xs">
                <div className="text-xs font-bold text-rose-900 uppercase tracking-wider font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-rose-600" />
                    <span>Schedule Target Exam ({formatHumanDate(selectedDayStr)})</span>
                  </span>
                  <span className="text-[10px] text-rose-700 font-bold px-1.5 py-0.5 rounded bg-rose-200/60">Board Countdown</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newExamTitle}
                    onChange={(e) => setNewExamTitle(e.target.value)}
                    placeholder="Exam Title (e.g. Sindh Board Physics Paper 1 / Midterm)"
                    className="w-full px-3 py-2 text-xs bg-white border border-rose-200 rounded-xl focus:outline-hidden focus:border-rose-500 text-rose-950 font-medium"
                    autoFocus
                  />

                  <div>
                    <label className="block text-[10px] text-rose-800 font-mono mb-1 font-bold">Subject</label>
                    <select
                      value={newExamSubject}
                      onChange={(e) => setNewExamSubject(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-200 rounded-xl focus:outline-hidden text-rose-950 font-medium"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-rose-700 font-mono">
                      📅 Date: <strong>{selectedDayStr}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingExam(false)}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveExam}
                        disabled={!newExamTitle.trim()}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        Save Target Exam
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Quick Task / Session Creator */}
            {isAddingTask && (
              <div className="p-4 rounded-2xl bg-[#F9F7F2] border border-[#6B705C]/30 space-y-3 animate-fade-in">
                <div className="text-xs font-bold text-[#6B705C] uppercase tracking-wider font-mono flex items-center justify-between">
                  <span>Add Study Session ({formatHumanDate(selectedDayStr)})</span>
                  <span className="text-[10px] text-[#A5A58D]">Inbuilt Calendar</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTaskTopic}
                    onChange={(e) => setNewTaskTopic(e.target.value)}
                    placeholder="Study topic (e.g. Arthropoda)"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden focus:border-[#6B705C]"
                    autoFocus
                  />

                  {/* Exam Pressure Drill Toggle */}
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/60 border border-rose-200 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={isExamPressureDrill}
                      onChange={(e) => setIsExamPressureDrill(e.target.checked)}
                      className="w-3.5 h-3.5 text-rose-600 rounded"
                    />
                    <span className="font-bold text-rose-800 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-rose-600" />
                      <span>Tag as Timed Exam Pressure Drill (High-Priority Speed Practice)</span>
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Subject</label>
                      {subjects.length > 0 ? (
                        <select
                          value={newTaskSubject}
                          onChange={(e) => {
                            setNewTaskSubject(e.target.value);
                            setNewTaskChapter('');
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newTaskSubject}
                          onChange={(e) => setNewTaskSubject(e.target.value)}
                          placeholder="Subject (e.g. Biology)"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Chapter / Unit</label>
                      {(() => {
                        const selSub = subjects.find(s => s.name === newTaskSubject);
                        if (selSub && selSub.chapters && selSub.chapters.length > 0) {
                          return (
                            <select
                              value={newTaskChapter}
                              onChange={(e) => setNewTaskChapter(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                            >
                              <option value="">(Select Chapter)</option>
                              {selSub.chapters.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          );
                        }
                        return (
                          <input
                            type="text"
                            value={newTaskChapter}
                            onChange={(e) => setNewTaskChapter(e.target.value)}
                            placeholder="Chapter (e.g. Chapter 10 — Animalia)"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                          />
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Start Time</label>
                      <input
                        type="text"
                        value={newTaskStartTime}
                        onChange={(e) => setNewTaskStartTime(e.target.value)}
                        placeholder="6:00 PM"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Priority</label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                      >
                        <option value="High">High Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="Low">Low Priority</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#A5A58D] font-mono mb-1">Duration (minutes)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[15, 30, 45, 60, 90].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setNewTaskMinutes(mins)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                            newTaskMinutes === mins
                              ? 'bg-[#6B705C] text-white'
                              : 'bg-white border border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculated End Time & Deadline Preview */}
                  {(() => {
                    const timeCalc = calculateConsistentEndTime(newTaskStartTime || '6:00 PM', newTaskMinutes || 60);
                    return (
                      <div className="p-2 rounded-xl bg-white border border-[#E0DBD0] font-mono text-[10px] text-[#6B705C] flex items-center justify-between">
                        <span>Calculated End Time: <strong>{timeCalc.endTime12}</strong></span>
                        <span>Deadline: <strong>{timeCalc.endTime12}</strong></span>
                      </div>
                    );
                  })()}

                  <input
                    type="text"
                    value={newTaskReason}
                    onChange={(e) => setNewTaskReason(e.target.value)}
                    placeholder="Focus objective / notes (optional)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#E0DBD0] rounded-xl focus:outline-hidden"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(false)}
                      className="px-3 py-1.5 text-xs font-medium text-[#A5A58D] hover:text-[#4A4E4D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuickTask}
                      disabled={!newTaskTopic.trim()}
                      className="px-4 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      Add to Inbuilt Calendar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Day Schedule View: Visual Timeline Drag & Drop vs Classic List */}
            {dayScheduleViewMode === 'timeline' ? (
              <InteractiveDayTimelineCard
                selectedDateStr={selectedDayStr}
                events={dayCalendarEvents}
                plans={plans}
                dayExams={dayExams}
                onSavePlan={onSavePlan}
                onStartTimerForTopic={onStartTimerForTopic}
                onDeleteEvent={handleDeleteCalendarEvent}
              />
            ) : (
              /* Inbuilt Calendar Events List for Selected Day */
              dayCalendarEvents.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {dayCalendarEvents.map((evt) => (
                    <div key={evt.id} className="p-3.5 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-2 group shadow-2xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleEventCompletion(evt)}
                            className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 ${
                              evt.completed
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-[#A5A58D] hover:border-[#6B705C]'
                            }`}
                            title={evt.completed ? "Mark incomplete" : "Mark completed (updates Google Tasks for Zapier accountability)"}
                          >
                            {evt.completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          <div>
                            <div className={`font-bold text-[#4A4E4D] ${evt.completed ? 'line-through text-[#A5A58D]' : ''}`}>
                              {evt.topicName}
                            </div>
                            <div className="text-[11px] text-[#A5A58D]">
                              {evt.subjectName} {evt.chapterName ? `• ${evt.chapterName}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onStartTimerForTopic && (
                            <button
                              type="button"
                              onClick={() => {
                                onStartTimerForTopic(evt.subjectName, evt.chapterName || '', evt.topicName);
                                if (setActiveTab) setActiveTab('timer');
                              }}
                              className="px-2.5 py-1 bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                              title="Start study timer for this topic"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>Study</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(evt);
                              setEditDate(evt.date);
                              setEditStartTime(evt.startTime);
                              setEditDuration(evt.durationMinutes);
                            }}
                            className="px-2 py-1 bg-white hover:bg-[#F2EFE9] text-[#6B705C] border border-[#E0DBD0] text-[10px] font-bold rounded-lg transition cursor-pointer"
                            title="Reschedule / edit date & time (syncs to Google Calendar & Google Tasks)"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCalendarEvent(evt)}
                            className="p-1 text-[#A5A58D] hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                            title="Remove from in-app calendar and delete external Google records"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Schedule Time, Duration, Deadline, Priority Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E0DBD0] text-[#6B705C] font-mono text-[10px] font-bold">
                          <Clock className="w-3 h-3 text-[#6B705C]" />
                          <span>{evt.startTime}–{evt.endTime} ({evt.durationMinutes}m)</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px] font-bold">
                          <AlertCircle className="w-3 h-3 text-amber-700" />
                          <span>Deadline: {evt.deadline}</span>
                        </span>

                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          evt.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-stone-100 text-stone-700'
                        }`}>
                          {evt.priority}
                        </span>

                        <span className="font-mono text-[9px] text-[#A5A58D] bg-white px-1.5 py-0.5 rounded border border-[#E0DBD0]" title="Unique Internal Calendar Event ID">
                          ID: {evt.id}
                        </span>
                      </div>

                      {/* Synchronization Status Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E0DBD0]/60 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          ✓ Inbuilt App Calendar
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-mono ${
                          evt.googleCalendarEventId ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-stone-100 text-stone-600'
                        }`}>
                          Google Cal: {evt.googleCalendarEventId ? 'Synced ✓' : 'Ready'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-mono ${
                          evt.googleTaskId ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-stone-100 text-stone-600'
                        }`}>
                          Google Task: {evt.googleTaskId ? 'Synced ✓' : 'Ready'}
                        </span>
                      </div>

                      {evt.reason && (
                        <div className="text-[10px] text-[#6B705C] bg-white px-2 py-0.5 rounded-md border border-[#E0DBD0] italic">
                          {evt.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#A5A58D] italic">No study sessions scheduled for this day yet. Click "+ Schedule Session" to add one!</p>
              )
            )}
          </div>

          {/* Revision Topics Due Today */}
          {dayRevisions.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-[#E0DBD0]">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-widest flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                <span>Revision Topics Due ({dayRevisions.length}):</span>
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {dayRevisions.map((r) => (
                  <div key={r.id} className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#4A4E4D]">{r.topicName}</div>
                        <div className="text-[11px] text-[#A5A58D]">{r.subjectName} • {r.chapterName}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.priority}
                        </span>
                        {onStartTimerForTopic && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartTimerForTopic(r.subjectName, r.chapterName, r.topicName);
                              if (setActiveTab) setActiveTab('timer');
                            }}
                            className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Start revision session"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Review</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {r.reason && (
                      <div className="text-[10px] text-purple-900 bg-white/80 px-2 py-0.5 rounded border border-purple-100 italic">
                        {r.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignments Due on Selected Day */}
          {(() => {
            const dayAssignments = (assignments || []).filter(a => a.dueDate === selectedDayStr);
            if (dayAssignments.length === 0) return null;
            return (
              <div className="space-y-2 pt-3 border-t border-[#E0DBD0]">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-700" />
                  <span>Assignments Due ({dayAssignments.length}):</span>
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dayAssignments.map((a) => (
                    <div key={a.id} className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#4A4E4D]">{a.title}</div>
                          <div className="text-[11px] text-[#A5A58D]">{a.subjectName}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          a.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {a.completed ? 'Completed' : a.priority}
                        </span>
                      </div>
                      {a.description && (
                        <div className="text-[11px] text-[#4A4E4D] italic line-clamp-2">
                          {a.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Actually Accomplished Study Sessions */}
          <div className="space-y-2 pt-3 border-t border-[#E0DBD0]">
            <h4 className="text-xs font-bold text-[#6B705C] uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6B705C]" />
              <span>Accomplished Sessions:</span>
            </h4>
            {daySessions.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {daySessions.map((s) => (
                  <div key={s.id} className="p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#A5A58D]">
                      <span>{s.subjectName}</span>
                      <span>{s.startTime} - {s.endTime}</span>
                    </div>
                    <div className="font-bold text-[#4A4E4D]">{s.topicName}</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#6B705C] font-mono font-bold">{s.durationMinutes} mins</span>
                      <span className="font-bold text-[#4A4E4D]">{s.result}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#A5A58D] italic">No study sessions recorded on this day.</p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Export .ICS Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4A4E4D]/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl max-w-lg w-full p-6 shadow-xl relative text-[#4A4E4D] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6B705C]/10 text-[#6B705C] flex items-center justify-center font-bold">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif italic font-bold text-[#6B705C]">Export Calendar (.ICS)</h3>
                  <p className="text-[11px] text-[#A5A58D]">Sync study schedule with Google Calendar, Outlook, or Apple Calendar</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-[#A5A58D] hover:text-[#4A4E4D] p-1.5 rounded-full hover:bg-[#F9F7F2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success Banner */}
            {exportSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-2xl flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{exportSuccessMsg}</span>
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">1. Date Range Scope</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`p-3 rounded-2xl text-xs font-bold border transition text-center ${
                    exportScope === 'all'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  Full Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('month')}
                  className={`p-3 rounded-2xl text-xs font-bold border transition text-center ${
                    exportScope === 'month'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  {currentMonthDate.toLocaleString('en-US', { month: 'short' })} Only
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('day')}
                  className={`p-3 rounded-2xl text-xs font-bold border transition text-center ${
                    exportScope === 'day'
                      ? 'bg-[#6B705C] text-white border-[#6B705C]'
                      : 'bg-[#F9F7F2] border-[#E0DBD0] text-[#4A4E4D] hover:bg-[#F2EFE9]'
                  }`}
                >
                  Selected Day
                </button>
              </div>
            </div>

            {/* Event Types Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B705C] uppercase tracking-wider">2. Include Event Types</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incPlans}
                    onChange={(e) => setIncPlans(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Study Plans ({plans.length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incExams}
                    onChange={(e) => setIncExams(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Target Exams ({(userProfile?.examDates || []).length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incSessions}
                    onChange={(e) => setIncSessions(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Studied Sessions ({sessions.length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incRevisions}
                    onChange={(e) => setIncRevisions(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Revisions ({revisions.length})</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0] cursor-pointer hover:bg-[#F2EFE9]">
                  <input
                    type="checkbox"
                    checked={incTests}
                    onChange={(e) => setIncTests(e.target.checked)}
                    className="w-4 h-4 text-[#6B705C] rounded-md border-[#E0DBD0] focus:ring-[#6B705C]"
                  />
                  <span className="font-medium text-[#4A4E4D]">Tests & Mocks ({testResults.length})</span>
                </label>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3.5 bg-[#F9F7F2] border border-[#E0DBD0] rounded-2xl text-[11px] text-[#4A4E4D] space-y-1">
              <span className="font-bold text-[#6B705C] block uppercase tracking-wider">How to import into Calendar apps:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[#A5A58D]">
                <li><strong className="text-[#4A4E4D]">Google Calendar:</strong> Open Settings → Import & Export → Upload `.ics` file.</li>
                <li><strong className="text-[#4A4E4D]">Apple Calendar & Outlook:</strong> Double click the downloaded `.ics` file or drag it into your calendar window.</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E0DBD0]">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerExport}
                className="px-5 py-2.5 bg-[#6B705C] hover:bg-[#5a5f4e] text-white font-medium text-xs rounded-full shadow-xs flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ICS File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inbuilt Calendar to Google Calendar & Google Tasks Sync Modal */}
      <InbuiltCalendarGoogleSyncModal
        isOpen={isInbuiltSyncModalOpen}
        onClose={() => setIsInbuiltSyncModalOpen(false)}
        plans={plans}
        onBatchSavePlans={onBatchSavePlans}
      />

      {/* Two-Way Google Calendar & Google Tasks Sync Modal */}
      <TwoWaySyncModal
        isOpen={isTwoWaySyncOpen}
        onClose={() => setIsTwoWaySyncOpen(false)}
        plans={plans}
        sessions={sessions}
        revisions={revisions}
        examDates={userProfile?.examDates || []}
        setActiveTab={setActiveTab}
      />

      {/* Syllabus-to-Calendar Auto-Allocator Modal (200-300+ items across dates) */}
      <SyllabusAutoAllocatorModal
        isOpen={isAutoAllocatorOpen}
        onClose={() => setIsAutoAllocatorOpen(false)}
        subjects={subjects}
        plans={plans}
        userProfile={userProfile}
        onBatchSavePlans={onBatchSavePlans || (async (batch) => {
          for (const p of batch) {
            if ('id' in p && p.id) {
              onSavePlan?.(p as StudyPlan);
            } else {
              onSavePlan?.({ id: `plan-${p.date}-${Date.now()}`, ...p } as StudyPlan);
            }
          }
        })}
        onAddTo137Cycle={onAddTo137Cycle}
      />

      {/* Upload Schedule to Google Calendar Modal */}
      <UploadToGoogleCalendarModal
        isOpen={isUploadToGoogleCalOpen}
        onClose={() => setIsUploadToGoogleCalOpen(false)}
        plans={plans}
        revisions={revisions}
        examDates={userProfile?.examDates || []}
        testResults={testResults}
        assignments={assignments}
        onSavePlan={onSavePlan}
        onBatchSavePlans={onBatchSavePlans}
      />

      {/* Option E: Weekly Mentor Academic Report & Habit Box Modal */}
      <WeeklyMentorReportModal
        isOpen={isMentorReportOpen}
        onClose={() => setIsMentorReportOpen(false)}
        plans={plans}
        userEmail={userProfile?.email || 'Student'}
      />

      {/* Device 4: Dedicated Google Tasks Dependency & Sync Modal */}
      <GoogleTasksSyncModal
        isOpen={isGoogleTasksModalOpen}
        onClose={() => setIsGoogleTasksModalOpen(false)}
        plans={plans}
        revisions={revisions}
        sessions={sessions}
      />

      {/* Official SBBM Printable Answer Sheet & Target Stamps Modal */}
      <SbbmAnswerSheetModal
        isOpen={isAnswerSheetModalOpen}
        onClose={() => setIsAnswerSheetModalOpen(false)}
        subjects={subjects}
        userProfile={userProfile}
      />

      {/* Category B Option 1: Dynamic Conflict Resolver & Real-time Auto-Rescheduler Modal */}
      <SmartScheduleConflictResolverModal
        isOpen={isConflictResolverOpen}
        onClose={() => setIsConflictResolverOpen(false)}
        plans={plans}
        inAppEvents={allCalendarEvents}
        assignments={assignments}
        examDates={userProfile?.examDates || []}
        revisions={revisions}
        userProfile={userProfile}
        targetDate={selectedDayStr}
        onBatchSavePlans={onBatchSavePlans}
        onSavePlan={onSavePlan}
      />

      {/* 24-Hour Emergency Pre-Exam Triage & Cram Sheet Modal */}
      <EmergencyPreExamTriageModal
        isOpen={isTriageModalOpen}
        onClose={() => setIsTriageModalOpen(false)}
        subjects={subjects}
        userProfile={userProfile}
        mistakes={vaultMistakes}
        initialSubjectName={selectedTriageSubject}
      />
    </div>
  );
};
