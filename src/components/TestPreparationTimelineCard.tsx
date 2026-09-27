import React, { useState } from 'react';
import { 
  Target, 
  Calendar, 
  Clock, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  BookOpen, 
  Play, 
  ChevronRight, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCcw
} from 'lucide-react';
import { TestPreparationTimeline, Subject, ActiveTab } from '../types';

interface TestPreparationTimelineCardProps {
  timeline: TestPreparationTimeline;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenCheatSheetForTopic?: (subjectName: string, topicName: string) => void;
}

export const TestPreparationTimelineCard: React.FC<TestPreparationTimelineCardProps> = ({
  timeline,
  onStartTimerForTopic,
  onNavigateTab,
  onOpenCheatSheetForTopic
}) => {
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState<number>(() => {
    const activeIdx = timeline.preparationPhases.findIndex(p => p.isCurrentPhase);
    return activeIdx >= 0 ? activeIdx : 0;
  });

  const isUrgent = timeline.daysRemaining <= 3;
  const isCritical = timeline.daysRemaining <= 1;

  return (
    <div className={`p-6 rounded-3xl border transition duration-200 shadow-md relative overflow-hidden space-y-5 ${
      isCritical
        ? 'bg-rose-500/5 border-rose-500/30'
        : isUrgent
        ? 'bg-amber-500/5 border-amber-500/30'
        : 'bg-surface border-theme'
    }`}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
              Exam Countdown Engine
            </span>
            <span className="text-[10px] font-bold text-muted uppercase">
              {timeline.subjectName}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-primary flex items-center gap-2">
            <span>{timeline.testTitle}</span>
          </h3>
        </div>

        {/* Days Remaining Pill */}
        <div className="flex items-center gap-2">
          <div className={`px-4 py-2 rounded-2xl border text-center ${
            isCritical
              ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
              : isUrgent
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-surface-raised border-theme text-primary'
          }`}>
            <span className="text-[10px] font-bold uppercase block opacity-80">Exam In</span>
            <span className="text-lg font-black font-mono leading-none">
              {timeline.daysRemaining} {timeline.daysRemaining === 1 ? 'Day' : 'Days'}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Quota Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-2xl bg-surface-raised border border-theme/60 text-center">
          <span className="text-[10px] font-bold uppercase text-muted block">Recommended Daily Study</span>
          <span className="text-base font-extrabold font-mono text-primary">
            {timeline.dailyTargetQuota.recommendedHoursPerDay} hrs / day
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-surface-raised border border-theme/60 text-center">
          <span className="text-[10px] font-bold uppercase text-muted block">Targeted SLOs Quota</span>
          <span className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
            {timeline.dailyTargetQuota.slosPerDay} Objectives / day
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-surface-raised border border-theme/60 text-center">
          <span className="text-[10px] font-bold uppercase text-rose-500 block">Mistake Autopsy Drills</span>
          <span className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
            {timeline.dailyTargetQuota.mistakeDrillsPerDay} Drills / day
          </span>
        </div>
      </div>

      {/* 4-Phase Interactive Timeline Strip */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-primary block">
          Strategic Preparation Phases
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {timeline.preparationPhases.map((phase, idx) => {
            const isSelected = selectedPhaseIdx === idx;
            return (
              <button
                key={phase.phaseName}
                onClick={() => setSelectedPhaseIdx(idx)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer relative ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : phase.isCurrentPhase
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-900 dark:text-purple-200'
                    : 'bg-surface-raised border-theme text-muted hover:text-primary'
                }`}
              >
                {phase.isCurrentPhase && !isSelected && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                )}
                <span className="text-[9px] font-mono block opacity-80">{phase.dateRange}</span>
                <span className="text-xs font-bold block mt-0.5 leading-snug">{phase.phaseName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Phase Action Items */}
      {timeline.preparationPhases[selectedPhaseIdx] && (
        <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-2.5">
          <span className="text-xs font-extrabold text-primary flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Action Checklist for {timeline.preparationPhases[selectedPhaseIdx].phaseName}</span>
          </span>
          <div className="space-y-1.5">
            {timeline.preparationPhases[selectedPhaseIdx].actionableTasks.map((task, tidx) => (
              <div key={tidx} className="flex items-start gap-2 text-xs text-primary">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>{task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audited SLOs & Weak Mistake Highlights */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-primary">
            Syllabus SLOs & Examiner Traps to Cover ({timeline.auditedSlos.length})
          </span>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('137_revision')}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View 1-3-7 Schedule</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {timeline.auditedSlos.slice(0, 6).map((slo) => (
            <div
              key={slo.sloId}
              className="p-3 rounded-2xl bg-surface border border-theme flex items-center justify-between gap-2"
            >
              <div className="space-y-0.5 truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold font-mono text-indigo-500">
                    {slo.chapterName}
                  </span>
                  {slo.hasUncuredMistakes && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      {slo.mistakesCount} Traps
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-primary truncate">
                  {slo.topicName}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onStartTimerForTopic(slo.subjectName, slo.chapterName, slo.topicName)}
                  title="Launch prep drill"
                  className="p-1.5 rounded-lg bg-primary text-white text-xs hover:opacity-90 transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
                {onOpenCheatSheetForTopic && (
                  <button
                    onClick={() => onOpenCheatSheetForTopic(slo.subjectName, slo.topicName)}
                    title="Cheat Sheet"
                    className="p-1.5 rounded-lg bg-surface-raised border border-theme text-muted hover:text-primary transition cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
