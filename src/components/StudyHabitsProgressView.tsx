import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Calendar, 
  Clock, 
  RotateCcw, 
  FileCheck, 
  Zap, 
  BookmarkCheck, 
  TrendingUp, 
  Sparkles, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Target, 
  Play, 
  RefreshCw, 
  Info, 
  Award,
  Layers,
  BarChart3,
  HelpCircle,
  ArrowUpRight,
  Plus,
  Trash2,
  BookOpen,
  Edit3,
  ExternalLink,
  MessageSquare,
  FileText,
  ListTodo,
  Shield
} from 'lucide-react';
import { 
  StudySession, 
  TestResult, 
  RevisionItem, 
  StudyPlan, 
  Assignment, 
  ActiveTab,
  StudyHabitId,
  DailyHabitEntry,
  WeeklyReviewItem,
  WeeklyReviewRecord,
  FlashcardDeck
} from '../types';
import { 
  STUDY_HABIT_DEFINITIONS, 
  loadAllHabitEntries, 
  syncHabitsWithAppData, 
  toggleHabitManual, 
  setAllHabitsState,
  getWeeklyBreakdown, 
  getMonthHeatmap, 
  computeConsistencyStats, 
  getTodayDateString,
  saveDailyReviewNotes,
  generateDailyStudySummary,
  loadAllWeeklyReviews,
  saveWeeklyReview,
  getOrCreateWeeklyReview,
  activateStreakFreeze,
  isStreakFreezeAvailable,
  getStreakFreezeDates
} from '../lib/habitService';

interface StudyHabitsProgressViewProps {
  sessions: StudySession[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  plans: StudyPlan[];
  assignments: Assignment[];
  flashcardDecks?: FlashcardDeck[];
  targetStudyHours?: number;
  onNavigateTab: (tab: ActiveTab) => void;
  onStartTimer?: () => void;
  onOpen137Revision?: () => void;
  onOpenMistakeVault?: () => void;
  onOpenTests?: () => void;
  onOpenAIWeeklyReport?: () => void;
}

export const StudyHabitsProgressView: React.FC<StudyHabitsProgressViewProps> = ({
  sessions = [],
  testResults = [],
  revisions = [],
  plans = [],
  assignments = [],
  flashcardDecks = [],
  targetStudyHours = 3,
  onNavigateTab,
  onStartTimer,
  onOpen137Revision,
  onOpenMistakeVault,
  onOpenTests,
  onOpenAIWeeklyReport
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [allEntries, setAllEntries] = useState<Record<string, DailyHabitEntry>>(() => loadAllHabitEntries());
  const [activeViewMode, setActiveViewMode] = useState<'today' | 'weekly' | 'monthly'>('today');

  // Daily Review & Reflection Notes state
  const [dailyReviewNotes, setDailyReviewNotes] = useState<string>('');
  const [isSavedDailyReview, setIsSavedDailyReview] = useState<boolean>(false);
  const [expandedHabitNote, setExpandedHabitNote] = useState<StudyHabitId | null>(null);
  const [habitNoteInput, setHabitNoteInput] = useState<Record<string, string>>({});

  // Weekly Review State
  const [weeklyReviews, setWeeklyReviews] = useState<Record<string, WeeklyReviewRecord>>(() => loadAllWeeklyReviews());
  const [newWeeklyItemText, setNewWeeklyItemText] = useState<Record<string, string>>({});
  const [weeklyNotesDraft, setWeeklyNotesDraft] = useState<Record<string, string>>({});
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);

  // Streak Freeze state (Option 3)
  const [freezeNotice, setFreezeNotice] = useState<string | null>(null);
  const [isFreezeAvail, setIsFreezeAvail] = useState<boolean>(() => isStreakFreezeAvailable());

  const handleActivateFreeze = () => {
    const res = activateStreakFreeze(selectedDate);
    setFreezeNotice(res.message);
    setIsFreezeAvail(isStreakFreezeAvailable());
    setTimeout(() => setFreezeNotice(null), 6000);
  };

  // Synchronize on mount and whenever related records update
  useEffect(() => {
    const { updatedEntries } = syncHabitsWithAppData({
      dateStr: todayStr,
      sessions,
      testResults,
      revisions,
      plans,
      assignments,
      flashcardDecks,
      targetStudyHours
    });
    setAllEntries(updatedEntries);
  }, [sessions, testResults, revisions, plans, assignments, flashcardDecks, todayStr, targetStudyHours]);

  // Listen to cross-component habit and weekly review updates
  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e.detail) {
        setAllEntries(e.detail);
      }
    };
    const handleWeeklyUpdated = (e: any) => {
      if (e.detail) {
        setWeeklyReviews(e.detail);
      }
    };
    window.addEventListener('prepforge:habits_updated', handleUpdated);
    window.addEventListener('prepforge:weekly_reviews_updated', handleWeeklyUpdated);
    return () => {
      window.removeEventListener('prepforge:habits_updated', handleUpdated);
      window.removeEventListener('prepforge:weekly_reviews_updated', handleWeeklyUpdated);
    };
  }, []);

  const currentEntry = useMemo(() => {
    return allEntries[selectedDate] || {
      date: selectedDate,
      habits: {
        daily_planning: { completed: false },
        focused_study: { completed: false },
        mcq_practice: { completed: false },
        active_recall: { completed: false },
        '137_revision': { completed: false },
        mistake_review: { completed: false },
        weekly_review: { completed: false }
      },
      plannedMinutes: targetStudyHours * 60,
      completedMinutes: sessions
        .filter(s => s.date === selectedDate)
        .reduce((a, s) => a + (s.durationMinutes || 0), 0)
    };
  }, [allEntries, selectedDate, sessions, targetStudyHours]);

  // Sync daily review notes when date changes
  useEffect(() => {
    setDailyReviewNotes(currentEntry.reviewNotes || currentEntry.reflectionNote || '');
    setIsSavedDailyReview(false);
  }, [selectedDate, currentEntry.reviewNotes, currentEntry.reflectionNote]);

  const handleToggleHabit = (habitId: StudyHabitId) => {
    const updated = toggleHabitManual(selectedDate, habitId);
    setAllEntries(prev => ({ ...prev, [selectedDate]: updated }));
  };

  const handleToggleAllHabits = (completed: boolean) => {
    const updated = setAllHabitsState(selectedDate, completed);
    setAllEntries(prev => ({ ...prev, [selectedDate]: updated }));
  };

  const handleSaveDailyReview = () => {
    const updated = saveDailyReviewNotes(selectedDate, dailyReviewNotes);
    setAllEntries(prev => ({ ...prev, [selectedDate]: updated }));
    setIsSavedDailyReview(true);
    setTimeout(() => setIsSavedDailyReview(false), 2500);
  };

  const handleAutoPopulateSummary = () => {
    const summary = generateDailyStudySummary({
      dateStr: selectedDate,
      sessions,
      testResults,
      revisions,
      plans
    });

    const prefix = dailyReviewNotes.trim() ? `${dailyReviewNotes.trim()}\n\n---\n` : '';
    const newContent = `${prefix}${summary}`;
    setDailyReviewNotes(newContent);
    saveDailyReviewNotes(selectedDate, newContent, summary);
    setIsSavedDailyReview(true);
    setTimeout(() => setIsSavedDailyReview(false), 2500);
  };

  // Weekly breakdown data
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const weeklyBreakdowns = useMemo(() => {
    return getWeeklyBreakdown(allEntries, sessions, currentYear, currentMonth);
  }, [allEntries, sessions, currentYear, currentMonth]);

  // Monthly heatmap data
  const monthHeatmap = useMemo(() => {
    return getMonthHeatmap(allEntries, sessions, currentYear, currentMonth);
  }, [allEntries, sessions, currentYear, currentMonth]);

  // Overall consistency stats
  const consistencyStats = useMemo(() => {
    return computeConsistencyStats(allEntries, sessions);
  }, [allEntries, sessions]);

  // Quick navigation day change
  const handleChangeDay = (offsetDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const isSelectedDateToday = selectedDate === todayStr;

  // Format hours and minutes
  const formatMins = (mins: number = 0) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const completedHabitsCount = Object.values(currentEntry.habits || {}).filter((h: any) => Boolean(h?.completed)).length;
  const habitPercentage = Math.round((completedHabitsCount / STUDY_HABIT_DEFINITIONS.length) * 100);
  const plannedMins = currentEntry.plannedMinutes || (targetStudyHours * 60);
  const completedMins = currentEntry.completedMinutes || 0;
  const timePercentage = Math.min(100, Math.round((completedMins / Math.max(1, plannedMins)) * 100));

  // Habit icon renderer helper
  const renderHabitIcon = (id: StudyHabitId) => {
    switch (id) {
      case 'daily_planning': return <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'focused_study': return <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'mcq_practice': return <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'active_recall': return <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case '137_revision': return <RotateCcw className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case 'mistake_review': return <BookmarkCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'weekly_review': return <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
    }
  };

  // Dedicated action trigger for each of the 7 habits
  const handleHabitAction = (id: StudyHabitId, e: React.MouseEvent) => {
    e.stopPropagation();
    switch (id) {
      case 'daily_planning':
        onNavigateTab('planner');
        break;
      case 'focused_study':
        if (onStartTimer) onStartTimer();
        else onNavigateTab('timer');
        break;
      case 'mcq_practice':
        if (onOpenTests) onOpenTests();
        else onNavigateTab('tests');
        break;
      case 'active_recall':
        onNavigateTab('flashcards');
        break;
      case '137_revision':
        if (onOpen137Revision) onOpen137Revision();
        else onNavigateTab('137_revision');
        break;
      case 'mistake_review':
        if (onOpenMistakeVault) onOpenMistakeVault();
        else onNavigateTab('mistake_vault');
        break;
      case 'weekly_review':
        setActiveViewMode('weekly');
        break;
    }
  };

  // Weekly Review Handlers
  const handleAddWeeklyItem = (weekKey: string, weekNumber: number, startDate: string, endDate: string) => {
    const text = (newWeeklyItemText[weekKey] || '').trim();
    if (!text) return;

    const currentReview = weeklyReviews[weekKey] || getOrCreateWeeklyReview(weekKey, weekNumber, startDate, endDate);
    const newItem: WeeklyReviewItem = {
      id: `wri-${Date.now()}`,
      text,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const updated: WeeklyReviewRecord = {
      ...currentReview,
      reviewItems: [...(currentReview.reviewItems || []), newItem]
    };

    saveWeeklyReview(updated);
    setWeeklyReviews(prev => ({ ...prev, [weekKey]: updated }));
    setNewWeeklyItemText(prev => ({ ...prev, [weekKey]: '' }));
  };

  const handleToggleWeeklyItem = (weekKey: string, itemId: string) => {
    const currentReview = weeklyReviews[weekKey];
    if (!currentReview) return;

    const updatedItems = (currentReview.reviewItems || []).map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    const updated: WeeklyReviewRecord = {
      ...currentReview,
      reviewItems: updatedItems
    };

    saveWeeklyReview(updated);
    setWeeklyReviews(prev => ({ ...prev, [weekKey]: updated }));
  };

  const handleDeleteWeeklyItem = (weekKey: string, itemId: string) => {
    const currentReview = weeklyReviews[weekKey];
    if (!currentReview) return;

    const updatedItems = (currentReview.reviewItems || []).filter(item => item.id !== itemId);
    const updated: WeeklyReviewRecord = {
      ...currentReview,
      reviewItems: updatedItems
    };

    saveWeeklyReview(updated);
    setWeeklyReviews(prev => ({ ...prev, [weekKey]: updated }));
  };

  const handleSaveWeeklyNotes = (weekKey: string, weekNumber: number, startDate: string, endDate: string) => {
    const currentReview = weeklyReviews[weekKey] || getOrCreateWeeklyReview(weekKey, weekNumber, startDate, endDate);
    const notes = weeklyNotesDraft[weekKey] !== undefined ? weeklyNotesDraft[weekKey] : currentReview.summaryNotes;

    const updated: WeeklyReviewRecord = {
      ...currentReview,
      summaryNotes: notes.trim(),
      completed: true,
      completedAt: new Date().toISOString()
    };

    saveWeeklyReview(updated);
    setWeeklyReviews(prev => ({ ...prev, [weekKey]: updated }));

    // Also auto-complete weekly_review habit for today
    toggleHabitManual(todayStr, 'weekly_review', true);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner / Breadcrumb & View Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-theme-card border border-theme shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              <span>Consistency & Discipline</span>
            </span>
            <span className="text-xs text-muted font-medium">• 3 Simple Questions: Plan, Action, Consistency</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-serif italic font-bold tracking-tight text-primary">
            Study Habits & Daily Progress
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            A clean, lightweight tracking grid connected to your real study timers, tests, and 1–3–7 revisions.
          </p>
        </div>

        {/* View Mode Tabs (Today, Weekly, Monthly) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-theme-surface border border-theme self-start sm:self-auto shrink-0">
          <button
            onClick={() => setActiveViewMode('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeViewMode === 'today'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            Today's Progress
          </button>
          <button
            onClick={() => setActiveViewMode('weekly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeViewMode === 'weekly'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            Weekly Review & Plan
          </button>
          <button
            onClick={() => setActiveViewMode('monthly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeViewMode === 'monthly'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            Monthly Heatmap
          </button>
        </div>
      </div>

      {/* TODAY'S PROGRESS HEADER SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Planned vs Completed Study Time */}
        <div className="p-4 sm:p-5 rounded-3xl bg-theme-card border border-theme shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">1. Planned vs Done</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-primary flex items-baseline gap-2">
              <span>{formatMins(completedMins)}</span>
              <span className="text-xs text-muted font-normal font-sans">/ {formatMins(plannedMins)} planned</span>
            </div>
            <div className="mt-3">
              <div className="w-full bg-theme-surface rounded-full h-2 overflow-hidden border border-theme/30">
                <div 
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, timePercentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted font-mono mt-1">
                <span>{timePercentage}% target reached</span>
                <span>{completedMins >= plannedMins ? '🎯 Met goal' : `${formatMins(Math.max(0, plannedMins - completedMins))} left`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Habits Ticked */}
        <div className="p-4 sm:p-5 rounded-3xl bg-theme-card border border-theme shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">2. Study Habits</span>
            <CheckSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-primary flex items-baseline gap-2">
              <span>{completedHabitsCount} / {STUDY_HABIT_DEFINITIONS.length}</span>
              <span className="text-xs text-muted font-normal font-sans">habits complete</span>
            </div>
            <div className="mt-3">
              <div className="w-full bg-theme-surface rounded-full h-2 overflow-hidden border border-theme/30">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${habitPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted font-mono mt-1">
                <span>{habitPercentage}% completed</span>
                <span>{completedHabitsCount >= 5 ? '🔥 Strong Day' : `${STUDY_HABIT_DEFINITIONS.length - completedHabitsCount} pending`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Streak & Consistency */}
        <div className="p-4 sm:p-5 rounded-3xl bg-theme-card border border-theme shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">3. Study Consistency</span>
            <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-primary flex items-baseline gap-2">
              <span>{consistencyStats.currentStreakDays} Days</span>
              <span className="text-xs text-muted font-normal font-sans">active streak</span>
            </div>
            <div className="mt-2 text-xs text-muted flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{consistencyStats.monthlyCompletionRate}% monthly habit completion</span>
            </div>
            <div className="text-[11px] text-muted mt-1 font-sans">
              Top habit: <span className="font-semibold text-primary">{consistencyStats.mostConsistentHabit}</span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-theme/50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleActivateFreeze}
                disabled={!isFreezeAvail}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Protect your streak if you need a rest day (1 freeze per 7 days)"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isFreezeAvail ? 'Streak Freeze (1 Avail)' : 'Freeze Used (Protected)'}</span>
              </button>
            </div>
            {freezeNotice && (
              <div className="text-[10px] text-cyan-700 dark:text-cyan-300 font-mono mt-1">
                {freezeNotice}
              </div>
            )}
          </div>
        </div>

        {/* Metric 4: Quick Action Launchpad */}
        <div className="p-4 sm:p-5 rounded-3xl bg-primary/5 dark:bg-primary/10 border border-primary/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-primary mb-1">
            <span className="font-bold uppercase tracking-wider text-[11px]">Instant Actions</span>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs text-muted">Trigger habits automatically through real study sessions:</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => onStartTimer ? onStartTimer() : onNavigateTab('timer')}
              className="px-2.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Focus Timer</span>
            </button>
            <button
              onClick={() => onOpen137Revision ? onOpen137Revision() : onNavigateTab('137_revision')}
              className="px-2.5 py-1.5 rounded-xl bg-theme-card border border-theme text-primary text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-violet-500" />
              <span>1–3–7 Revise</span>
            </button>
          </div>
          {onOpenAIWeeklyReport && (
            <button
              onClick={onOpenAIWeeklyReport}
              className="w-full mt-2 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Weekly Summary & Prompts</span>
            </button>
          )}
        </div>
      </div>

      {/* DATE SELECTOR BAR */}
      <div className="flex items-center justify-between bg-theme-card border border-theme px-4 py-3 rounded-2xl shadow-xs">
        <button
          onClick={() => handleChangeDay(-1)}
          className="p-1.5 rounded-xl hover:bg-theme-surface border border-theme text-primary transition cursor-pointer flex items-center gap-1 text-xs font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous Day</span>
        </button>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold font-mono text-primary">{selectedDate}</span>
          {isSelectedDateToday && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white uppercase tracking-wider">
              Today
            </span>
          )}
          {!isSelectedDateToday && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs text-primary underline font-medium hover:opacity-80 ml-1 cursor-pointer"
            >
              Jump to Today
            </button>
          )}
        </div>

        <button
          onClick={() => handleChangeDay(1)}
          className="p-1.5 rounded-xl hover:bg-theme-surface border border-theme text-primary transition cursor-pointer flex items-center gap-1 text-xs font-medium"
        >
          <span className="hidden sm:inline">Next Day</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* VIEW MODE 1: TODAY'S PROGRESS & STUDY HABITS GRID */}
      {activeViewMode === 'today' && (
        <div className="space-y-4">
          {/* Smart Habit Reminder & Performance Correlation Banner */}
          {completedHabitsCount < 7 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold">Smart Habit Alert: </span>
                  <span>{7 - completedHabitsCount} habit{7 - completedHabitsCount === 1 ? '' : 's'} remaining for {selectedDate}. Clearing them takes under 5 minutes.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-amber-800 dark:text-amber-300">
                <span>📈 Insight: Students completing Active Recall score +22% higher on mock exams.</span>
              </div>
            </div>
          )}

          {/* Habits Grid with Interactive Action Buttons */}
          <div className="rounded-3xl bg-theme-card border border-theme overflow-hidden shadow-xs">
            <div className="p-5 border-b border-theme bg-theme-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-serif italic font-bold text-primary flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Daily Study Habits Checklist (All 7 Habits Connected)</span>
                </h2>
                <p className="text-xs text-muted">
                  Click any action button to launch the linked study tool, or check off manually to keep note of your consistency.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => handleToggleAllHabits(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Mark all daily habits as complete for today"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Select All Done</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllHabits(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-accent text-muted hover:text-primary border border-theme text-xs font-semibold transition cursor-pointer"
                  title="Reset habits for today"
                >
                  <span>Reset</span>
                </button>
                <div className="text-xs font-mono font-semibold text-primary bg-theme-card px-3 py-1.5 rounded-xl border border-theme">
                  {completedHabitsCount} of {STUDY_HABIT_DEFINITIONS.length} Completed ({habitPercentage}%)
                </div>
              </div>
            </div>

            <div className="divide-y divide-theme">
              {STUDY_HABIT_DEFINITIONS.map(def => {
                const habitState = currentEntry.habits?.[def.id] || { completed: false };
                const isCompleted = habitState.completed;
                const isNoteExpanded = expandedHabitNote === def.id;

                const getActionLabel = (id: StudyHabitId) => {
                  switch (id) {
                    case 'daily_planning': return 'Open Planner';
                    case 'focused_study': return 'Start Timer';
                    case 'mcq_practice': return 'Launch Tests';
                    case 'active_recall': return 'Active Recall';
                    case '137_revision': return '1-3-7 Revision';
                    case 'mistake_review': return 'Mistake Vault';
                    case 'weekly_review': return 'Weekly Review';
                  }
                };

                return (
                  <div key={def.id} className="transition hover:bg-theme-surface/40">
                    <div
                      onClick={() => handleToggleHabit(def.id)}
                      className={`p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 cursor-pointer ${
                        isCompleted ? 'bg-emerald-500/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleHabit(def.id);
                          }}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                            isCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                              : 'border-theme bg-surface hover:border-primary text-transparent'
                          }`}
                        >
                          {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="w-8 h-8 rounded-xl bg-theme-surface border border-theme flex items-center justify-center shrink-0">
                          {renderHabitIcon(def.id)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-primary">
                              {def.title}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-theme-surface border border-theme text-muted">
                              {def.shortLabel}
                            </span>
                            {habitState.autoCompleted && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Auto-Detected</span>
                              </span>
                            )}
                            {habitState.manualOverride && !habitState.autoCompleted && isCompleted && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-theme-surface text-muted border border-theme">
                                Manual Check
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {def.description}
                          </p>
                          {habitState.sourceDetails && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                              ↳ {habitState.sourceDetails}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right action button & status badge */}
                      <div className="flex items-center gap-2 shrink-0 self-center">
                        <button
                          type="button"
                          onClick={(e) => handleHabitAction(def.id, e)}
                          className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-accent border border-theme text-xs font-semibold text-primary transition cursor-pointer"
                          title={`Launch tool for ${def.title}`}
                        >
                          <span>{getActionLabel(def.id)}</span>
                          <ArrowUpRight className="w-3 h-3 text-muted" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedHabitNote(isNoteExpanded ? null : def.id);
                          }}
                          className={`p-1.5 rounded-xl border border-theme text-xs transition cursor-pointer ${
                            isNoteExpanded || habitState.customNotes
                              ? 'bg-primary text-white'
                              : 'bg-theme-surface text-muted hover:text-primary'
                          }`}
                          title="Add / view notes for this habit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                          isCompleted
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}>
                          {isCompleted ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                              <span>Done</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Habit-Specific Note Drawer */}
                    {isNoteExpanded && (
                      <div className="px-5 pb-4 pt-1 bg-theme-surface/50 border-t border-theme/60 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={habitNoteInput[def.id] !== undefined ? habitNoteInput[def.id] : (habitState.customNotes || '')}
                          onChange={(e) => setHabitNoteInput(prev => ({ ...prev, [def.id]: e.target.value }))}
                          placeholder={`Add specific note for ${def.title} (e.g. 25 questions solved, score 22/25...)`}
                          className="flex-1 px-3 py-2 rounded-xl border border-theme bg-theme-card text-primary text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const noteText = habitNoteInput[def.id] !== undefined ? habitNoteInput[def.id] : (habitState.customNotes || '');
                            const existing = allEntries[selectedDate] || currentEntry;
                            const curHabits = existing.habits || {};
                            const updatedHabits = {
                              ...curHabits,
                              [def.id]: {
                                ...(curHabits[def.id] || { completed: true }),
                                customNotes: noteText.trim()
                              }
                            };
                            const updatedEntry = {
                              ...existing,
                              habits: updatedHabits,
                              updatedAt: new Date().toISOString()
                            };
                            const next = { ...allEntries, [selectedDate]: updatedEntry };
                            setAllEntries(next);
                            localStorage.setItem('prepforge_data_v2_studyHabits', JSON.stringify(next));
                            setExpandedHabitNote(null);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition shrink-0 cursor-pointer"
                        >
                          Save Note
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TODAY'S STUDY REVIEW & LEARNING JOURNAL (Where student types what they've done today) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-theme-card border border-theme shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
              <div>
                <h3 className="text-base font-bold font-serif italic text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>Today's Study Review & Learning Journal</span>
                </h3>
                <p className="text-xs text-muted">
                  Type what you studied today to keep note of it, capture key takeaways, or auto-fill your timer & test data.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleAutoPopulateSummary}
                  className="px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Auto-fill bulleted summary of all timer sessions, tests, and revisions completed today"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ Auto-fill Today's Study Data</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveDailyReview}
                  className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSavedDailyReview ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Save Daily Review</span>
                  )}
                </button>
              </div>
            </div>

            {/* Rich Review Notes Textarea */}
            <textarea
              rows={5}
              value={dailyReviewNotes}
              onChange={(e) => setDailyReviewNotes(e.target.value)}
              placeholder="Type your study notes for today... What topics did you conquer? What formulas need repetition? Any difficulties or plan adjustments for tomorrow?"
              className="w-full p-4 rounded-2xl border border-theme bg-theme-surface text-primary text-xs sm:text-sm font-sans leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted font-mono">
              <span>
                {currentEntry.updatedAt ? `Last modified: ${new Date(currentEntry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready to record'}
              </span>
              <span>All daily notes sync across paired devices and local backup storage.</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: WEEKLY VIEW (Week 1, Week 2, Week 3, Week 4 etc.) WITH INTERACTIVE WEEKLY REVIEW */}
      {activeViewMode === 'weekly' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted">
            <span className="font-semibold">Weekly Breakdown & Retrospective for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <div className="flex items-center gap-3">
              <span>Target: 21h study & habit coverage</span>
              {onOpenAIWeeklyReport && (
                <button
                  type="button"
                  onClick={onOpenAIWeeklyReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Weekly Summary (A, B, D)</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {weeklyBreakdowns.map((week) => {
              const weekKey = week.weekKey;
              const reviewRecord = weeklyReviews[weekKey] || week.review || getOrCreateWeeklyReview(weekKey, week.weekNumber, week.startDate, week.endDate);
              const isExpanded = expandedWeekKey === weekKey;
              const reviewItems = reviewRecord.reviewItems || [];
              const completedReviewItems = reviewItems.filter(i => i.completed).length;

              return (
                <div 
                  key={week.weekNumber} 
                  className="p-5 sm:p-6 rounded-3xl bg-theme-card border border-theme shadow-xs space-y-5"
                >
                  {/* Week Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme pb-3">
                    <div>
                      <h3 className="text-base font-bold font-serif italic text-primary flex items-center gap-2">
                        <span>{week.label}</span>
                        <span className="text-xs font-sans font-mono text-muted">
                          ({week.startDate} to {week.endDate})
                        </span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <div className="text-primary font-bold">
                        {formatMins(week.actualStudyMinutes)} / {formatMins(week.goalStudyMinutes)}
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                        {week.weeklyPercentage}% Habits Ticked
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedWeekKey(isExpanded ? null : weekKey)}
                        className={`px-3 py-1 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                          isExpanded
                            ? 'bg-primary text-white border-primary'
                            : 'bg-theme-surface border-theme text-primary hover:bg-stone-200 dark:hover:bg-stone-800'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isExpanded ? 'Close Review' : 'Weekly Review & Notes'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Daily Checkbox Grid for the Week */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    {week.days.map((day) => (
                      <div
                        key={day.date}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setActiveViewMode('today');
                        }}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                          day.isToday
                            ? 'border-primary bg-primary/5 shadow-xs'
                            : 'border-theme bg-theme-surface/50 hover:bg-theme-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-primary">{day.dayOfWeekShort}</span>
                          <span className="text-[11px] font-mono text-muted">{day.date.split('-')[2]}</span>
                        </div>

                        {/* Mini checklist dots */}
                        <div className="grid grid-cols-7 gap-1 my-2">
                          {STUDY_HABIT_DEFINITIONS.map(def => {
                            const done = day.habits[def.id];
                            return (
                              <div
                                key={def.id}
                                title={`${def.title}: ${done ? 'Complete' : 'Pending'}`}
                                className={`h-2 rounded-full transition-all ${
                                  done
                                    ? 'bg-emerald-500'
                                    : 'bg-theme-surface border border-theme/40'
                                }`}
                              />
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-muted mt-1">
                          <span>{day.completedHabitsCount}/7</span>
                          <span>{formatMins(day.studyMinutes)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* INTERACTIVE WEEKLY REVIEW & ACTION CHECKLIST PANEL */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-theme-surface border border-theme space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme/60 pb-3">
                        <div>
                          <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span>Weekly Review & Retrospective ({week.label})</span>
                          </h4>
                          <p className="text-xs text-muted">
                            Add review action items, check off audits, and type your weekly accomplishments to keep notes of your progress.
                          </p>
                        </div>
                        <div className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {completedReviewItems} of {reviewItems.length} review items done
                        </div>
                      </div>

                      {/* Action Items Checklist */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-primary block">
                          Weekly Action Items & Audits:
                        </label>
                        <div className="space-y-1.5">
                          {reviewItems.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-theme-card border border-theme"
                            >
                              <div 
                                onClick={() => handleToggleWeeklyItem(weekKey, item.id)}
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <button
                                  type="button"
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                    item.completed
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'border-theme bg-theme-surface text-transparent'
                                  }`}
                                >
                                  {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>
                                <span className={`text-xs ${item.completed ? 'line-through text-muted' : 'text-primary font-medium'}`}>
                                  {item.text}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteWeeklyItem(weekKey, item.id)}
                                className="text-muted hover:text-rose-500 p-1 rounded-lg transition cursor-pointer"
                                title="Delete item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Input to add a new review item */}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={newWeeklyItemText[weekKey] || ''}
                            onChange={(e) => setNewWeeklyItemText(prev => ({ ...prev, [weekKey]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddWeeklyItem(weekKey, week.weekNumber, week.startDate, week.endDate);
                              }
                            }}
                            placeholder="Add a review task (e.g. Audit Kinematics formulas, retake Chemistry quiz 2...)"
                            className="flex-1 px-3 py-2 rounded-xl border border-theme bg-theme-card text-primary text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddWeeklyItem(weekKey, week.weekNumber, week.startDate, week.endDate)}
                            className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Item</span>
                          </button>
                        </div>
                      </div>

                      {/* Weekly Summary & Retrospective Notes Textarea */}
                      <div className="space-y-1.5 pt-2">
                        <label className="text-xs font-bold text-primary flex items-center justify-between">
                          <span>Weekly Summary & Retrospective Notes:</span>
                          <span className="text-[11px] font-normal text-muted">What went well? What needs calibration next week?</span>
                        </label>
                        <textarea
                          rows={4}
                          value={weeklyNotesDraft[weekKey] !== undefined ? weeklyNotesDraft[weekKey] : (reviewRecord.summaryNotes || '')}
                          onChange={(e) => setWeeklyNotesDraft(prev => ({ ...prev, [weekKey]: e.target.value }))}
                          placeholder={`Write your retrospective notes for ${week.label}... (e.g. Cleared 15 hours of focused study, completed Optics chapter, struggled with trigonometry integrals so scheduling extra practice next week)`}
                          className="w-full p-3.5 rounded-xl border border-theme bg-theme-card text-primary text-xs sm:text-sm font-sans leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Complete Weekly Review Button */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted font-mono">
                          {reviewRecord.completed ? `✓ Reviewed on ${new Date(reviewRecord.completedAt || '').toLocaleDateString()}` : 'Review pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSaveWeeklyNotes(weekKey, week.weekNumber, week.startDate, week.endDate)}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Save & Complete Weekly Review</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: MONTHLY HABIT HEATMAP & CONSISTENCY ANALYTICS */}
      {activeViewMode === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly Heatmap Grid */}
          <div className="p-5 sm:p-6 rounded-3xl bg-theme-card border border-theme shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-serif italic font-bold text-primary flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span>Monthly Habit Heatmap ({new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})</span>
                </h3>
                <p className="text-xs text-muted">
                  Visual intensity reflects completed habits and active study session hours.
                </p>
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-2 text-xs text-muted font-mono self-start sm:self-auto">
                <span>Less</span>
                <span className="w-3.5 h-3.5 rounded-md bg-theme-surface border border-theme" />
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-200 dark:bg-emerald-950/70" />
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-400 dark:bg-emerald-800" />
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 dark:bg-emerald-600" />
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 dark:bg-emerald-500" />
                <span>More</span>
              </div>
            </div>

            {/* Weekday Labels (Mon to Sun) */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-bold text-muted uppercase tracking-wider">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-2">
              {monthHeatmap.map((cell, idx) => {
                const getIntensityClass = () => {
                  if (!cell.isCurrentMonth) return 'opacity-20 border-transparent bg-transparent';
                  switch (cell.intensity) {
                    case 4: return 'bg-emerald-600 text-white dark:bg-emerald-500';
                    case 3: return 'bg-emerald-500 text-white dark:bg-emerald-600';
                    case 2: return 'bg-emerald-300 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-100';
                    case 1: return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200';
                    default: return 'bg-theme-surface text-muted';
                  }
                };

                return (
                  <button
                    key={`${cell.date}-${idx}`}
                    onClick={() => {
                      if (cell.isCurrentMonth) {
                        setSelectedDate(cell.date);
                        setActiveViewMode('today');
                      }
                    }}
                    title={`${cell.date}: ${cell.completedHabitsCount}/7 habits, ${formatMins(cell.studyMinutes)}`}
                    className={`h-14 sm:h-16 p-1.5 rounded-2xl border border-theme transition flex flex-col justify-between text-left cursor-pointer hover:scale-[1.02] ${getIntensityClass()} ${
                      cell.isToday ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-stone-900' : ''
                    }`}
                  >
                    <span className="text-xs font-mono font-bold leading-none">{cell.dayNumber}</span>
                    {cell.isCurrentMonth && (
                      <div className="text-[10px] font-mono leading-tight flex justify-between w-full opacity-90">
                        <span>{cell.completedHabitsCount > 0 ? `${cell.completedHabitsCount}h` : ''}</span>
                        <span>{cell.studyMinutes > 0 ? formatMins(cell.studyMinutes) : ''}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Consistency Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-theme-card border border-theme shadow-xs">
              <div className="text-xs text-muted uppercase font-semibold mb-1">Total Monthly Study</div>
              <div className="text-2xl font-bold font-mono text-primary">
                {formatMins(consistencyStats.totalStudyMinutesThisMonth)}
              </div>
              <p className="text-xs text-muted mt-1">
                Across {consistencyStats.completedHabitDaysThisMonth} active study days this month.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-theme-card border border-theme shadow-xs">
              <div className="text-xs text-muted uppercase font-semibold mb-1">Most Productive Day</div>
              <div className="text-2xl font-bold text-primary">
                {consistencyStats.topProductiveDayOfWeek}
              </div>
              <p className="text-xs text-muted mt-1">
                Highest concentration of completed study sessions and habits.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-theme-card border border-theme shadow-xs">
              <div className="text-xs text-muted uppercase font-semibold mb-1">Top Maintained Habit</div>
              <div className="text-lg font-bold text-primary truncate">
                {consistencyStats.mostConsistentHabit}
              </div>
              <p className="text-xs text-muted mt-1">
                Your anchor study habit with highest daily compliance rate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
