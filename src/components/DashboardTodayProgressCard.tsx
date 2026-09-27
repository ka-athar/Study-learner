import React, { useMemo } from 'react';
import { CheckSquare, Clock, RotateCcw, ArrowRight, Sparkles } from 'lucide-react';
import { StudySession, StudyPlan, RevisionItem } from '../types';
import { loadAllHabitEntries, getTodayDateString, STUDY_HABIT_DEFINITIONS } from '../lib/habitService';

interface DashboardTodayProgressCardProps {
  sessions: StudySession[];
  todayPlan?: StudyPlan | null;
  revisions: RevisionItem[];
  targetStudyHours?: number;
  onOpenStudyHabits: () => void;
}

export const DashboardTodayProgressCard: React.FC<DashboardTodayProgressCardProps> = ({
  sessions = [],
  todayPlan,
  revisions = [],
  targetStudyHours = 3,
  onOpenStudyHabits
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);

  // Compute metrics
  const todaySessions = useMemo(() => {
    return sessions.filter(s => s.date === todayStr);
  }, [sessions, todayStr]);

  const studyMinutes = useMemo(() => {
    return todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [todaySessions]);

  const plannedMinutes = (targetStudyHours || 3) * 60;
  const timeProgress = Math.min(100, Math.round((studyMinutes / Math.max(1, plannedMinutes)) * 100));

  // Habits from habitService
  const allEntries = useMemo(() => loadAllHabitEntries(), []);
  const todayEntry = allEntries[todayStr];
  const habitsCount = todayEntry?.habits 
    ? Object.values(todayEntry.habits).filter((h: any) => Boolean(h?.completed)).length 
    : (studyMinutes > 0 ? 1 : 0);
  const totalHabits = STUDY_HABIT_DEFINITIONS.length; // 7

  // 1-3-7 Revision metrics
  const today137Due = useMemo(() => {
    return revisions.filter(r => r.dueDate === todayStr);
  }, [revisions, todayStr]);

  const today137Completed = useMemo(() => {
    return revisions.filter(r => 
      (r.lastStudied === todayStr && r.completedStages && r.completedStages.length > 0) ||
      (r.completedAt && r.completedAt.startsWith(todayStr))
    );
  }, [revisions, todayStr]);

  const dueCount137 = Math.max(today137Due.length, today137Completed.length);
  const doneCount137 = today137Completed.length;

  // Composite overall percentage (Habits 40%, Study Time 40%, Revisions/Plan 20%)
  const habitRatio = habitsCount / totalHabits;
  const timeRatio = Math.min(1, studyMinutes / plannedMinutes);
  const revRatio = dueCount137 > 0 ? (doneCount137 / dueCount137) : habitRatio;
  const overallPercentage = Math.round(((habitRatio * 0.4) + (timeRatio * 0.4) + (revRatio * 0.2)) * 100);

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <div 
      onClick={onOpenStudyHabits}
      className="p-5 rounded-3xl bg-theme-card border border-theme shadow-xs hover:border-primary/40 transition cursor-pointer group"
      title="Click to open Study Habits & Progress analytics"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-muted">
              Daily Consistency Summary
            </div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <span>TODAY'S PROGRESS</span>
              <span className="text-xs text-primary font-mono font-extrabold ml-1">
                {overallPercentage}%
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-primary font-semibold group-hover:translate-x-0.5 transition-transform self-end sm:self-auto">
          <span>Full Habits Analytics</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2.5 overflow-hidden mb-3.5">
        <div 
          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${Math.min(100, Math.max(5, overallPercentage))}%` }}
        />
      </div>

      {/* Summary Metrics Row: Study time, Habits, 1-3-7 */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="p-2.5 rounded-2xl bg-theme-surface border border-theme flex flex-col justify-between">
          <span className="text-[11px] text-muted flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-500" />
            <span>Study:</span>
          </span>
          <span className="font-mono font-bold text-primary mt-1 text-xs sm:text-sm">
            {formatMins(studyMinutes)} / {formatMins(plannedMinutes)}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-theme-surface border border-theme flex flex-col justify-between">
          <span className="text-[11px] text-muted flex items-center gap-1">
            <CheckSquare className="w-3 h-3 text-emerald-500" />
            <span>Habits:</span>
          </span>
          <span className="font-mono font-bold text-primary mt-1 text-xs sm:text-sm">
            {habitsCount} / {totalHabits}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-theme-surface border border-theme flex flex-col justify-between">
          <span className="text-[11px] text-muted flex items-center gap-1">
            <RotateCcw className="w-3 h-3 text-violet-500" />
            <span>1–3–7:</span>
          </span>
          <span className="font-mono font-bold text-primary mt-1 text-xs sm:text-sm">
            {dueCount137 > 0 ? `${doneCount137} / ${dueCount137}` : `${doneCount137} done`}
          </span>
        </div>
      </div>
    </div>
  );
};
