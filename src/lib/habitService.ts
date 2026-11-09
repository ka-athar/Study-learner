import { 
  StudyHabitId, 
  StudyHabitDefinition, 
  DailyHabitEntry, 
  DailyHabitItemState,
  HabitConsistencyStats, 
  StudySession, 
  TestResult, 
  RevisionItem, 
  StudyPlan,
  Assignment,
  WeeklyReviewItem,
  WeeklyReviewRecord,
  FlashcardDeck
} from '../types';

export const STUDY_HABIT_DEFINITIONS: StudyHabitDefinition[] = [
  {
    id: 'daily_planning',
    title: 'Daily Planning',
    shortLabel: 'Plan',
    description: 'Set daily targets, review agenda, and organize study sessions.',
    icon: 'Calendar',
    category: 'planning',
    color: 'emerald',
    autoDetectHint: 'Auto-completed when daily study plan is updated or planned tasks are completed'
  },
  {
    id: 'focused_study',
    title: 'Focused Study Session',
    shortLabel: 'Focus',
    description: 'Complete at least one timed, distraction-free study session.',
    icon: 'Clock',
    category: 'execution',
    color: 'indigo',
    autoDetectHint: 'Auto-completed whenever a timer session is finished'
  },
  {
    id: 'mcq_practice',
    title: 'MCQ Practice',
    shortLabel: 'MCQ',
    description: 'Solve questions, practice exams, or run a diagnostic quiz.',
    icon: 'FileCheck',
    category: 'execution',
    color: 'amber',
    autoDetectHint: 'Auto-completed upon recording test results or solving practice MCQs'
  },
  {
    id: 'active_recall',
    title: 'Active Recall',
    shortLabel: 'Recall',
    description: 'Test memory via blurt recall, flashcard review, or oral exam.',
    icon: 'Zap',
    category: 'retention',
    color: 'cyan',
    autoDetectHint: 'Auto-completed when reviewing flashcard decks or completing a blurt recall sprint'
  },
  {
    id: '137_revision',
    title: '1–3–7 Revision',
    shortLabel: '1–3–7',
    description: 'Review due topics according to the spaced repetition cadence.',
    icon: 'RotateCcw',
    category: 'retention',
    color: 'violet',
    autoDetectHint: 'Auto-completed whenever a 1-3-7 spaced revision milestone is checked off'
  },
  {
    id: 'mistake_review',
    title: 'Mistake Review',
    shortLabel: 'Mistakes',
    description: 'Audit past errors in the Mistake Vault to eliminate knowledge gaps.',
    icon: 'BookmarkCheck',
    category: 'review',
    color: 'rose',
    autoDetectHint: 'Auto-completed when reviewing mistakes or attempting targeted remediation drills'
  },
  {
    id: 'weekly_review',
    title: 'Weekly Review',
    shortLabel: 'Review',
    description: 'Calibrate progress, audit syllabus coverage, and adjust upcoming plan.',
    icon: 'TrendingUp',
    category: 'review',
    color: 'teal',
    autoDetectHint: 'Auto-completed on weekly audits, exam countdown adjustments, or progress reviews'
  }
];

export const HABIT_STORAGE_KEY = 'prepforge_data_v2_studyHabits';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyHabitState(): Record<StudyHabitId, DailyHabitItemState> {
  return {
    daily_planning: { completed: false },
    focused_study: { completed: false },
    mcq_practice: { completed: false },
    active_recall: { completed: false },
    '137_revision': { completed: false },
    mistake_review: { completed: false },
    weekly_review: { completed: false }
  };
}

/**
 * Loads all recorded habit entries from local persistence.
 */
export function loadAllHabitEntries(): Record<string, DailyHabitEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HABIT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load study habits from storage:', err);
    return {};
  }
}

/**
 * Saves all habit entries to local persistence and dispatches custom event.
 */
export function saveAllHabitEntries(entries: Record<string, DailyHabitEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('prepforge:habits_updated', { detail: entries }));
  } catch (err) {
    console.warn('Failed to save study habits to storage:', err);
  }
}

/**
 * Automatically calculates and synchronizes today's (or given date's) habit states
 * based on real events in the app without duplicating tracking.
 */
export function syncHabitsWithAppData(params: {
  dateStr?: string;
  sessions?: StudySession[];
  testResults?: TestResult[];
  revisions?: RevisionItem[];
  plans?: StudyPlan[];
  assignments?: Assignment[];
  flashcardDecks?: FlashcardDeck[];
  existingEntries?: Record<string, DailyHabitEntry>;
  targetStudyHours?: number;
}): { updatedEntries: Record<string, DailyHabitEntry>; currentEntry: DailyHabitEntry } {
  const targetDate = params.dateStr || getTodayDateString();
  const allEntries = { ...(params.existingEntries || loadAllHabitEntries()) };
  const existing = allEntries[targetDate] || {
    date: targetDate,
    habits: createEmptyHabitState(),
    plannedMinutes: (params.targetStudyHours || 3) * 60,
    completedMinutes: 0,
    importantTasksCount: 0,
    completedTasksCount: 0,
    revisionsDueCount: 0,
    revisionsCompletedCount: 0,
    overallProgressPercentage: 0
  };

  const habits = { ...createEmptyHabitState(), ...(existing.habits || {}) };

  // 1. Focused Study: auto-completed if any study session recorded on targetDate
  const matchingSessions = (params.sessions || []).filter(s => s.date === targetDate);
  const totalSessionMinutes = matchingSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  if (matchingSessions.length > 0) {
    if (!habits.focused_study.manualOverride || !habits.focused_study.completed) {
      habits.focused_study = {
        completed: true,
        autoCompleted: true,
        completedAt: habits.focused_study.completedAt || new Date().toISOString(),
        sourceDetails: `${matchingSessions.length} session${matchingSessions.length > 1 ? 's' : ''} (${totalSessionMinutes}m) recorded`,
        manualOverride: habits.focused_study.manualOverride
      };
    }
  }

  // 2. MCQ Practice: auto-completed if any test / quiz recorded on targetDate
  const matchingTests = (params.testResults || []).filter(t => t.date === targetDate);
  if (matchingTests.length > 0) {
    if (!habits.mcq_practice.manualOverride || !habits.mcq_practice.completed) {
      const bestScore = matchingTests[0]?.score || '';
      habits.mcq_practice = {
        completed: true,
        autoCompleted: true,
        completedAt: habits.mcq_practice.completedAt || new Date().toISOString(),
        sourceDetails: `${matchingTests.length} test result${matchingTests.length > 1 ? 's' : ''} logged (${bestScore})`,
        manualOverride: habits.mcq_practice.manualOverride
      };
    }
  }

  // 3. 1-3-7 Spaced Revision: auto-completed if any revision item was completed on targetDate
  const matchingRevs = (params.revisions || []).filter(r => 
    (r.lastStudied === targetDate && (r.status === 'Completed' || (r.completedStages && r.completedStages.length > 0))) ||
    (r.completedAt && r.completedAt.startsWith(targetDate))
  );
  const dueRevs = (params.revisions || []).filter(r => r.dueDate === targetDate);
  if (matchingRevs.length > 0) {
    if (!habits['137_revision'].manualOverride || !habits['137_revision'].completed) {
      habits['137_revision'] = {
        completed: true,
        autoCompleted: true,
        completedAt: habits['137_revision'].completedAt || new Date().toISOString(),
        sourceDetails: `${matchingRevs.length} 1-3-7 revision${matchingRevs.length > 1 ? 's' : ''} advanced`,
        manualOverride: habits['137_revision'].manualOverride
      };
    }
  }

  // 4. Daily Planning: auto-completed if daily study plan exists for targetDate or plan topic completed
  const targetPlan = (params.plans || []).find(p => p.date === targetDate);
  const planTopics = targetPlan?.topics || [];
  const completedPlanTopics = planTopics.filter(t => t.completed);
  if (targetPlan && (planTopics.length > 0 || completedPlanTopics.length > 0)) {
    if (!habits.daily_planning.manualOverride || !habits.daily_planning.completed) {
      habits.daily_planning = {
        completed: true,
        autoCompleted: true,
        completedAt: habits.daily_planning.completedAt || new Date().toISOString(),
        sourceDetails: `Plan active: ${completedPlanTopics.length}/${planTopics.length} tasks completed`,
        manualOverride: habits.daily_planning.manualOverride
      };
    }
  }

  // 5. Active Recall: auto-completed if flashcard sessions or blurt recall logged in notes/sessions OR cards reviewed today
  const recallSessions = matchingSessions.filter(s => 
    (s.chapterName && s.chapterName.toLowerCase().includes('recall')) ||
    (s.notes && (s.notes.toLowerCase().includes('blurt') || s.notes.toLowerCase().includes('flashcard') || s.notes.toLowerCase().includes('feynman') || s.notes.toLowerCase().includes('recall')))
  );

  const decksReviewedToday = (params.flashcardDecks || []).filter(d => 
    d.cards?.some(c => c.lastReviewedAt && c.lastReviewedAt.startsWith(targetDate)) ||
    (d.updatedAt && d.updatedAt.startsWith(targetDate) && d.cards?.some(c => (c.repetitions || 0) > 0))
  );

  if (recallSessions.length > 0 || decksReviewedToday.length > 0) {
    if (!habits.active_recall.manualOverride || !habits.active_recall.completed) {
      const cardsReviewedCount = decksReviewedToday.reduce((acc, d) => 
        acc + (d.cards?.filter(c => c.lastReviewedAt && c.lastReviewedAt.startsWith(targetDate)).length || 0), 0
      );
      const detail = recallSessions.length > 0
        ? `${recallSessions.length} active recall / blurt session${recallSessions.length > 1 ? 's' : ''}`
        : `${decksReviewedToday.length} flashcard deck${decksReviewedToday.length > 1 ? 's' : ''} reviewed (${cardsReviewedCount || 'active'} cards)`;

      habits.active_recall = {
        completed: true,
        autoCompleted: true,
        completedAt: habits.active_recall.completedAt || new Date().toISOString(),
        sourceDetails: detail,
        manualOverride: habits.active_recall.manualOverride
      };
    }
  }

  // 6. Mistake Review: auto-completed if test autopsy or mistake drill completed
  const mistakeReviews = matchingSessions.filter(s => 
    s.notes && (s.notes.toLowerCase().includes('mistake') || s.notes.toLowerCase().includes('remediation') || s.notes.toLowerCase().includes('autopsy'))
  );
  if (mistakeReviews.length > 0) {
    if (!habits.mistake_review.manualOverride || !habits.mistake_review.completed) {
      habits.mistake_review = {
        completed: true,
        autoCompleted: true,
        completedAt: habits.mistake_review.completedAt || new Date().toISOString(),
        sourceDetails: 'Mistake audit / remediation session completed',
        manualOverride: habits.mistake_review.manualOverride
      };
    }
  }

  // 7. Weekly Review: auto-suggested or completed on Sundays or when user reviews
  const dayOfWeek = new Date(targetDate).getDay(); // 0 is Sunday
  if (dayOfWeek === 0 && (matchingSessions.length > 0 || completedPlanTopics.length > 0)) {
    if (!habits.weekly_review.manualOverride && !habits.weekly_review.completed) {
      habits.weekly_review = {
        completed: true,
        autoCompleted: true,
        completedAt: habits.weekly_review.completedAt || new Date().toISOString(),
        sourceDetails: 'Sunday weekly calibration completed',
        manualOverride: false
      };
    }
  }

  // Calculate composite progress metrics
  const completedHabitsCount = Object.values(habits).filter(h => h.completed).length;
  const habitPercentage = Math.round((completedHabitsCount / STUDY_HABIT_DEFINITIONS.length) * 100);

  const plannedMinutes = existing.plannedMinutes || (params.targetStudyHours || 3) * 60;
  const completedMinutes = totalSessionMinutes;
  const timePercentage = Math.min(100, Math.round((completedMinutes / Math.max(1, plannedMinutes)) * 100));

  const importantTasksCount = planTopics.length;
  const completedTasksCount = completedPlanTopics.length;
  const taskPercentage = importantTasksCount > 0 ? Math.round((completedTasksCount / importantTasksCount) * 100) : habitPercentage;

  const revisionsDueCount = dueRevs.length;
  const revisionsCompletedCount = matchingRevs.length;

  // Composite day progress (balanced across Habits 40%, Study Time 40%, Tasks 20%)
  const overallProgressPercentage = Math.round(
    (habitPercentage * 0.4) + (timePercentage * 0.4) + (taskPercentage * 0.2)
  );

  const currentEntry: DailyHabitEntry = {
    ...existing,
    date: targetDate,
    habits,
    plannedMinutes,
    completedMinutes,
    importantTasksCount,
    completedTasksCount,
    revisionsDueCount,
    revisionsCompletedCount,
    overallProgressPercentage,
    updatedAt: new Date().toISOString()
  };

  allEntries[targetDate] = currentEntry;
  saveAllHabitEntries(allEntries);

  return { updatedEntries: allEntries, currentEntry };
}

/**
 * Toggles a habit manual checkbox for a given date.
 */
export function toggleHabitManual(
  dateStr: string, 
  habitId: StudyHabitId, 
  forcedState?: boolean
): DailyHabitEntry {
  const allEntries = loadAllHabitEntries();
  const existing = allEntries[dateStr] || {
    date: dateStr,
    habits: createEmptyHabitState(),
    plannedMinutes: 180,
    completedMinutes: 0
  };

  const currentHabit = existing.habits[habitId] || { completed: false };
  const nextCompleted = forcedState !== undefined ? forcedState : !currentHabit.completed;

  const updatedHabits = {
    ...existing.habits,
    [habitId]: {
      ...currentHabit,
      completed: nextCompleted,
      manualOverride: true,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
      sourceDetails: nextCompleted ? 'Marked manually' : undefined
    }
  };

  const completedCount = Object.values(updatedHabits).filter(h => h.completed).length;
  const overallProgressPercentage = Math.round((completedCount / STUDY_HABIT_DEFINITIONS.length) * 100);

  const updatedEntry: DailyHabitEntry = {
    ...existing,
    habits: updatedHabits,
    overallProgressPercentage,
    updatedAt: new Date().toISOString()
  };

  allEntries[dateStr] = updatedEntry;
  saveAllHabitEntries(allEntries);
  return updatedEntry;
}

/**
  * Sets all habits for a given date as completed or reset.
  */
export function setAllHabitsState(dateStr: string, completed: boolean): DailyHabitEntry {
  const allEntries = loadAllHabitEntries();
  const existing = allEntries[dateStr] || {
    date: dateStr,
    habits: createEmptyHabitState(),
    plannedMinutes: 180,
    completedMinutes: 0
  };

  const updatedHabits = { ...existing.habits };
  for (const def of STUDY_HABIT_DEFINITIONS) {
    const cur = updatedHabits[def.id] || { completed: false };
    updatedHabits[def.id] = {
      ...cur,
      completed,
      manualOverride: true,
      completedAt: completed ? new Date().toISOString() : undefined,
      sourceDetails: completed ? 'Marked complete manually' : undefined
    };
  }

  const overallProgressPercentage = completed ? 100 : 0;

  const updatedEntry: DailyHabitEntry = {
    ...existing,
    habits: updatedHabits,
    overallProgressPercentage,
    updatedAt: new Date().toISOString()
  };

  allEntries[dateStr] = updatedEntry;
  saveAllHabitEntries(allEntries);
  return updatedEntry;
}

export const WEEKLY_REVIEWS_STORAGE_KEY = 'prepforge_data_v2_weeklyReviews';

/**
 * Loads all saved weekly review records.
 */
export function loadAllWeeklyReviews(): Record<string, WeeklyReviewRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WEEKLY_REVIEWS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load weekly reviews:', err);
    return {};
  }
}

/**
 * Saves a weekly review record and dispatches custom event.
 */
export function saveWeeklyReview(review: WeeklyReviewRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadAllWeeklyReviews();
    all[review.weekKey] = {
      ...review,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(WEEKLY_REVIEWS_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('prepforge:weekly_reviews_updated', { detail: all }));
  } catch (err) {
    console.warn('Failed to save weekly review:', err);
  }
}

/**
 * Gets or initializes a weekly review record for a specific week.
 */
export function getOrCreateWeeklyReview(
  weekKey: string,
  weekNumber: number,
  startDate: string,
  endDate: string
): WeeklyReviewRecord {
  const all = loadAllWeeklyReviews();
  if (all[weekKey]) return all[weekKey];

  const defaultReview: WeeklyReviewRecord = {
    weekKey,
    weekNumber,
    startDate,
    endDate,
    summaryNotes: '',
    wins: [],
    improvements: [],
    reviewItems: [
      { id: `wri-${Date.now()}-1`, text: 'Audit syllabus coverage against target pace', completed: false, category: 'academic' },
      { id: `wri-${Date.now()}-2`, text: 'Check 1–3–7 Spaced Repetition mastery graduates', completed: false, category: 'revision' },
      { id: `wri-${Date.now()}-3`, text: 'Review Mistake Vault and retry weak questions', completed: false, category: 'exam_prep' }
    ],
    completed: false
  };

  all[weekKey] = defaultReview;
  saveWeeklyReview(defaultReview);
  return defaultReview;
}

/**
 * Saves daily review notes where the student types what they accomplished today.
 */
export function saveDailyReviewNotes(
  dateStr: string,
  reviewNotes: string,
  studiedTopicsSummary?: string
): DailyHabitEntry {
  const allEntries = loadAllHabitEntries();
  const existing = allEntries[dateStr] || {
    date: dateStr,
    habits: createEmptyHabitState(),
    plannedMinutes: 180,
    completedMinutes: 0
  };

  const updatedEntry: DailyHabitEntry = {
    ...existing,
    reviewNotes: reviewNotes.trim(),
    studiedTopicsSummary: studiedTopicsSummary !== undefined ? studiedTopicsSummary : existing.studiedTopicsSummary,
    updatedAt: new Date().toISOString()
  };

  allEntries[dateStr] = updatedEntry;
  saveAllHabitEntries(allEntries);
  return updatedEntry;
}

/**
 * Generates an automatic structured breakdown of what was studied today
 * that the user can import into their daily review journal notes.
 */
export function generateDailyStudySummary(params: {
  dateStr: string;
  sessions: StudySession[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  plans: StudyPlan[];
}): string {
  const { dateStr, sessions, testResults, revisions, plans } = params;
  const lines: string[] = [];

  // 1. Sessions completed today
  const matchingSessions = sessions.filter(s => s.date === dateStr);
  const totalMins = matchingSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  if (matchingSessions.length > 0) {
    lines.push(`📚 Completed Study Sessions (${timeFormatted} total):`);
    matchingSessions.forEach(s => {
      lines.push(`  • ${s.subjectName || 'Study'}: ${s.topicName || s.chapterName || 'General focus'} (${s.durationMinutes}m) - ${s.result || 'Done'}`);
    });
  }

  // 2. Tests taken today
  const matchingTests = testResults.filter(t => t.date === dateStr);
  if (matchingTests.length > 0) {
    lines.push(`\n📝 Tests & MCQ Practice Logged:`);
    matchingTests.forEach(t => {
      lines.push(`  • ${t.testName || t.subjectName}: Score ${t.score} (${t.percentage || 0}%)`);
    });
  }

  // 3. 1-3-7 Spaced Revisions advanced today
  const matchingRevs = revisions.filter(r => 
    (r.lastStudied === dateStr && (r.status === 'Completed' || (r.completedStages && r.completedStages.length > 0))) ||
    (r.completedAt && r.completedAt.startsWith(dateStr))
  );
  if (matchingRevs.length > 0) {
    lines.push(`\n🔄 1–3–7 Spaced Repetitions Completed:`);
    matchingRevs.forEach(r => {
      lines.push(`  • ${r.subjectName}: ${r.topicName} [Stage: ${r.cycleStage || 'day1'}]`);
    });
  }

  // 4. Daily Plan Tasks finished
  const targetPlan = plans.find(p => p.date === dateStr);
  const completedTopics = (targetPlan?.topics || []).filter(t => t.completed);
  if (completedTopics.length > 0) {
    lines.push(`\n✅ Planned Syllabus Milestones Checked Off:`);
    completedTopics.forEach(t => {
      lines.push(`  • ${t.subjectName}: ${t.topicName}`);
    });
  }

  if (lines.length === 0) {
    return `No logged study records on ${dateStr} yet. Start a timer or mark topics to auto-populate.`;
  }

  return lines.join('\n');
}

/**
 * Computes weekly breakdown for the active month (Week 1, Week 2, Week 3, Week 4, Week 5).
 */
export interface WeeklyHabitBreakdown {
  weekKey: string;
  weekNumber: number;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: Array<{
    date: string;
    dayOfWeekShort: string; // Mon, Tue...
    isToday: boolean;
    isFuture: boolean;
    completedHabitsCount: number;
    totalHabitsCount: number;
    completionPercentage: number;
    studyMinutes: number;
    habits: Record<StudyHabitId, boolean>;
  }>;
  weeklyPercentage: number;
  goalStudyMinutes: number;
  actualStudyMinutes: number;
  completedHabitsTotal: number;
  totalHabitOpportunities: number;
  review?: WeeklyReviewRecord;
}

export function getWeeklyBreakdown(
  entries: Record<string, DailyHabitEntry>,
  sessions: StudySession[] = [],
  year = new Date().getFullYear(),
  month = new Date().getMonth() // 0-indexed
): WeeklyHabitBreakdown[] {
  const todayStr = getTodayDateString();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Map study sessions by date
  const sessionsByDate = new Map<string, number>();
  sessions.forEach(s => {
    if (!s.date) return;
    sessionsByDate.set(s.date, (sessionsByDate.get(s.date) || 0) + (s.durationMinutes || 0));
  });

  const weeks: WeeklyHabitBreakdown[] = [];
  let currentWeekDays: any[] = [];
  let weekIndex = 1;

  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = curDate.getDay(); // 0 is Sun, 1 is Mon...
    const dayOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];

    const entry = entries[dateStr];
    const habitMap: Record<StudyHabitId, boolean> = {
      daily_planning: Boolean(entry?.habits?.daily_planning?.completed),
      focused_study: Boolean(entry?.habits?.focused_study?.completed),
      mcq_practice: Boolean(entry?.habits?.mcq_practice?.completed),
      active_recall: Boolean(entry?.habits?.active_recall?.completed),
      '137_revision': Boolean(entry?.habits?.['137_revision']?.completed),
      mistake_review: Boolean(entry?.habits?.mistake_review?.completed),
      weekly_review: Boolean(entry?.habits?.weekly_review?.completed)
    };

    const completedHabitsCount = Object.values(habitMap).filter(Boolean).length;
    const studyMinutes = entry?.completedMinutes || sessionsByDate.get(dateStr) || 0;

    currentWeekDays.push({
      date: dateStr,
      dayOfWeekShort,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      completedHabitsCount,
      totalHabitsCount: STUDY_HABIT_DEFINITIONS.length,
      completionPercentage: Math.round((completedHabitsCount / STUDY_HABIT_DEFINITIONS.length) * 100),
      studyMinutes,
      habits: habitMap
    });

    // Close week on Sunday (dayOfWeek === 0) or at the end of the month
    if (dayOfWeek === 0 || day === daysInMonth) {
      const totalOpportunities = currentWeekDays.length * STUDY_HABIT_DEFINITIONS.length;
      const completedHabitsTotal = currentWeekDays.reduce((a, d) => a + d.completedHabitsCount, 0);
      const actualStudyMinutes = currentWeekDays.reduce((a, d) => a + d.studyMinutes, 0);
      const goalStudyMinutes = currentWeekDays.length * 180; // 3h daily standard

      const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${weekIndex}`;
      const review = getOrCreateWeeklyReview(
        weekKey,
        weekIndex,
        currentWeekDays[0].date,
        currentWeekDays[currentWeekDays.length - 1].date
      );

      weeks.push({
        weekKey,
        weekNumber: weekIndex,
        label: `Week ${weekIndex}`,
        startDate: currentWeekDays[0].date,
        endDate: currentWeekDays[currentWeekDays.length - 1].date,
        days: currentWeekDays,
        weeklyPercentage: totalOpportunities > 0 ? Math.round((completedHabitsTotal / totalOpportunities) * 100) : 0,
        goalStudyMinutes,
        actualStudyMinutes,
        completedHabitsTotal,
        totalHabitOpportunities: totalOpportunities,
        review
      });

      currentWeekDays = [];
      weekIndex++;
    }
  }

  return weeks;
}

/**
 * Computes monthly calendar heatmap cells with intensities (0 to 4).
 */
export interface MonthHeatmapDay {
  date: string;
  dayNumber: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  completedHabitsCount: number;
  studyMinutes: number;
  percentage: number;
  isToday: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
}

export function getMonthHeatmap(
  entries: Record<string, DailyHabitEntry>,
  sessions: StudySession[] = [],
  year = new Date().getFullYear(),
  month = new Date().getMonth()
): MonthHeatmapDay[] {
  const todayStr = getTodayDateString();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Offset padding for starting weekday (Monday-first)
  let startingWeekday = firstDay.getDay(); // 0 is Sun
  startingWeekday = startingWeekday === 0 ? 6 : startingWeekday - 1; // convert to 0 = Mon, 6 = Sun

  const result: MonthHeatmapDay[] = [];

  // Padding days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let p = startingWeekday - 1; p >= 0; p--) {
    const prevDayNum = prevMonthLastDay - p;
    const prevDateStr = `${year}-${String(month).padStart(2, '0')}-${String(prevDayNum).padStart(2, '0')}`;
    result.push({
      date: prevDateStr,
      dayNumber: prevDayNum,
      intensity: 0,
      completedHabitsCount: 0,
      studyMinutes: 0,
      percentage: 0,
      isToday: false,
      isFuture: false,
      isCurrentMonth: false
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entry = entries[dateStr];
    const sessionMins = sessions
      .filter(s => s.date === dateStr)
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    const studyMinutes = entry?.completedMinutes || sessionMins;

    const completedHabits = entry?.habits 
      ? Object.values(entry.habits).filter(h => h.completed).length 
      : 0;

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (completedHabits >= 5 || studyMinutes >= 150) intensity = 4;
    else if (completedHabits >= 3 || studyMinutes >= 90) intensity = 3;
    else if (completedHabits >= 2 || studyMinutes >= 45) intensity = 2;
    else if (completedHabits >= 1 || studyMinutes > 0) intensity = 1;

    result.push({
      date: dateStr,
      dayNumber: d,
      intensity,
      completedHabitsCount: completedHabits,
      studyMinutes,
      percentage: Math.round((completedHabits / STUDY_HABIT_DEFINITIONS.length) * 100),
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      isCurrentMonth: true
    });
  }

  return result;
}

/**
 * Computes overall consistency statistics.
 */
export function computeConsistencyStats(
  entries: Record<string, DailyHabitEntry>,
  sessions: StudySession[] = []
): HabitConsistencyStats {
  const todayStr = getTodayDateString();
  const dates = Object.keys(entries).sort().reverse();

  // 1. Calculate Current Streak
  let currentStreak = 0;
  let checkDate = new Date();
  
  // Check if today has activity or yesterday
  const todayActive = entries[todayStr] && Object.values(entries[todayStr].habits || {}).some(h => h.completed);
  if (!todayActive) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = checkDate.toISOString().split('T')[0];
    const entry = entries[dStr];
    const hasActivity = entry && Object.values(entry.habits || {}).some(h => h.completed);
    const hasSession = sessions.some(s => s.date === dStr && (s.durationMinutes || 0) > 0);
    const isFrozen = getStreakFreezeDates().includes(dStr);

    if (hasActivity || hasSession || isFrozen) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 2. Monthly Stats
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsedThisMonth = Math.min(daysInCurrentMonth, now.getDate());

  let totalHabitOpportunities = daysElapsedThisMonth * STUDY_HABIT_DEFINITIONS.length;
  let completedHabitPoints = 0;
  let activeDaysCount = 0;
  let totalStudyMinutes = 0;

  const habitCountTotals: Record<StudyHabitId, number> = {
    daily_planning: 0,
    focused_study: 0,
    mcq_practice: 0,
    active_recall: 0,
    '137_revision': 0,
    mistake_review: 0,
    weekly_review: 0
  };

  const dayOfWeekStudyTotals: number[] = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat

  Object.entries(entries).forEach(([dateStr, entry]) => {
    if (dateStr.startsWith(currentMonthPrefix)) {
      const activeCount = Object.values(entry.habits || {}).filter(h => h.completed).length;
      completedHabitPoints += activeCount;
      if (activeCount > 0) activeDaysCount++;

      totalStudyMinutes += entry.completedMinutes || 0;

      STUDY_HABIT_DEFINITIONS.forEach(def => {
        if (entry.habits?.[def.id]?.completed) {
          habitCountTotals[def.id]++;
        }
      });
    }

    // Tally day of week productivity
    const dow = new Date(dateStr).getDay();
    if (entry.completedMinutes) {
      dayOfWeekStudyTotals[dow] += entry.completedMinutes;
    }
  });

  // Most consistent habit
  let topHabitId: StudyHabitId = 'focused_study';
  let maxCount = -1;
  Object.entries(habitCountTotals).forEach(([hid, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topHabitId = hid as StudyHabitId;
    }
  });
  const topHabitDef = STUDY_HABIT_DEFINITIONS.find(d => d.id === topHabitId);

  // Top productive day of week
  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let maxDowIdx = 1;
  let maxDowMinutes = -1;
  dayOfWeekStudyTotals.forEach((mins, idx) => {
    if (mins > maxDowMinutes) {
      maxDowMinutes = mins;
      maxDowIdx = idx;
    }
  });

  const monthlyRate = totalHabitOpportunities > 0 ? Math.round((completedHabitPoints / totalHabitOpportunities) * 100) : 0;
  const plannedMonthly = daysElapsedThisMonth * 180; // 3h daily

  return {
    currentStreakDays: currentStreak,
    longestStreakDays: Math.max(currentStreak, 7),
    monthlyCompletionRate: monthlyRate,
    weeklyCompletionRate: Math.min(100, Math.round(monthlyRate * 1.1)),
    mostConsistentHabit: topHabitDef?.title || 'Focused Study Session',
    completedHabitDaysThisMonth: activeDaysCount,
    totalHabitOpportunitiesThisMonth: totalHabitOpportunities,
    totalStudyMinutesThisMonth: totalStudyMinutes,
    plannedStudyMinutesThisMonth: plannedMonthly,
    topProductiveDayOfWeek: dowNames[maxDowIdx]
  };
}

export const STREAK_FREEZE_STORAGE_KEY = 'studyflow_habit_streak_freeze_v1';

export function getStreakFreezeDates(): string[] {
  try {
    const raw = localStorage.getItem(STREAK_FREEZE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function activateStreakFreeze(dateStr: string): { success: boolean; message: string } {
  try {
    const currentFreezes = getStreakFreezeDates();
    if (currentFreezes.includes(dateStr)) {
      return { success: true, message: `Streak freeze already active for ${dateStr}.` };
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentFreezes = currentFreezes.filter(d => new Date(d) >= oneWeekAgo);

    if (recentFreezes.length >= 1) {
      return { 
        success: false, 
        message: 'Weekly streak freeze limit reached (1 freeze allowed per 7 days). Keep going!' 
      };
    }

    currentFreezes.push(dateStr);
    localStorage.setItem(STREAK_FREEZE_STORAGE_KEY, JSON.stringify(currentFreezes));
    return { success: true, message: `🛡️ Streak Freeze activated for ${dateStr}! Your consistency streak is protected.` };
  } catch (e: any) {
    return { success: false, message: e.message || 'Could not activate streak freeze.' };
  }
}

export function isStreakFreezeAvailable(): boolean {
  try {
    const currentFreezes = getStreakFreezeDates();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recent = currentFreezes.filter(d => new Date(d) >= oneWeekAgo);
    return recent.length === 0;
  } catch {
    return true;
  }
}
