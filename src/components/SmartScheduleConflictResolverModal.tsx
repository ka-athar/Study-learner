/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Layers, 
  Zap, 
  ShieldCheck, 
  Check, 
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { 
  StudyPlan, 
  InAppCalendarEvent, 
  Assignment, 
  ExamDate, 
  RevisionItem, 
  UserProfile, 
  ScheduleRescheduleProposal 
} from '../types';
import { 
  diagnoseScheduleConflicts, 
  applyAutoRescheduleProposals 
} from '../lib/scheduleConflictEngine';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface SmartScheduleConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StudyPlan[];
  inAppEvents?: InAppCalendarEvent[];
  assignments?: Assignment[];
  examDates?: ExamDate[];
  revisions?: RevisionItem[];
  userProfile?: UserProfile | null;
  targetDate?: string;
  onBatchSavePlans?: (plans: StudyPlan[]) => Promise<void> | void;
  onSavePlan?: (plan: StudyPlan) => void;
}

export const SmartScheduleConflictResolverModal: React.FC<SmartScheduleConflictResolverModalProps> = ({
  isOpen,
  onClose,
  plans,
  inAppEvents = [],
  assignments = [],
  examDates = [],
  revisions = [],
  userProfile,
  targetDate,
  onBatchSavePlans,
  onSavePlan
}) => {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'proposals' | 'manual'>('proposals');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Run diagnosis
  const diagnosis = useMemo(() => {
    return diagnoseScheduleConflicts({
      plans,
      inAppEvents,
      assignments,
      examDates,
      revisions,
      userProfile,
      targetDate,
      capacityHoursPerDay: userProfile?.dailyStudyGoalHours || 3.5
    });
  }, [plans, inAppEvents, assignments, examDates, revisions, userProfile, targetDate]);

  // Manage proposal selection state
  const [proposals, setProposals] = useState<ScheduleRescheduleProposal[]>([]);

  // Sync state whenever diagnosis changes
  React.useEffect(() => {
    setProposals(diagnosis.proposals);
  }, [diagnosis]);

  if (!isOpen) return null;

  const toggleProposal = (taskId: string) => {
    setProposals(prev => prev.map(p => 
      p.taskId === taskId ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAllProposals = (selected: boolean) => {
    setProposals(prev => prev.map(p => ({ ...p, selected })));
  };

  const handleApplyAutoReschedule = async () => {
    setIsApplying(true);
    try {
      const { updatedPlans, appliedCount } = applyAutoRescheduleProposals(plans, proposals);

      if (onBatchSavePlans) {
        await onBatchSavePlans(updatedPlans);
      } else if (onSavePlan && updatedPlans.length > 0) {
        updatedPlans.forEach(p => onSavePlan(p));
      }

      triggerStudyGoalConfetti();
      setSuccessNotice(`✓ Successfully auto-rescheduled ${appliedCount} tasks! Timetable conflicts eliminated.`);
      setTimeout(() => {
        setSuccessNotice(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to apply auto-reschedule', err);
    } finally {
      setIsApplying(false);
    }
  };

  const selectedCount = proposals.filter(p => p.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div 
        className="bg-card border border-theme rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-theme flex items-center justify-between gap-4 bg-surface/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-serif text-primary">
                  Smart Schedule Conflict Resolver
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  AI Dynamic Engine
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Detects timetable clashes, overcapacity days, exam overlaps, and redistributes sessions intelligently.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-surface hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Highlights Banner */}
        <div className="px-6 py-3 bg-surface/80 border-b border-theme flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#6B705C]" />
              <span>Timetable Health:</span>
            </span>
            {diagnosis.criticalCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{diagnosis.criticalCount} Critical Clashes</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>No Critical Clashes</span>
              </span>
            )}

            {diagnosis.warningCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{diagnosis.warningCount} Warnings & Overdues</span>
              </span>
            )}

            {diagnosis.overloadedDays.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30">
                {diagnosis.overloadedDays.length} Overcapacity Days
              </span>
            )}
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-theme text-xs">
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'proposals' 
                  ? 'bg-[#6B705C] text-white shadow-2xs' 
                  : 'text-muted hover:text-primary'
              }`}
            >
              <span>Auto-Reschedule ({proposals.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'diagnostics' 
                  ? 'bg-[#6B705C] text-white shadow-2xs' 
                  : 'text-muted hover:text-primary'
              }`}
            >
              <span>Clashes Audit ({diagnosis.conflicts.length})</span>
            </button>
          </div>
        </div>

        {/* Success Notice if saved */}
        {successNotice && (
          <div className="m-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: PROPOSALS (PREVIEW & APPLY) */}
          {activeTab === 'proposals' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>AI-Optimized Timetable Rebalancing</span>
                  </h4>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                    The engine calculated non-overlapping windows with 15-minute mental breaks, keeping daily load under your threshold.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => selectAllProposals(true)}
                    className="text-[11px] font-bold text-primary hover:underline px-2 py-1 cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => selectAllProposals(false)}
                    className="text-[11px] font-bold text-muted hover:underline px-2 py-1 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {proposals.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3 bg-surface/50 rounded-2xl border border-theme">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-primary">Your Timetable is Fully Balanced!</h4>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    No time overlaps, overcapacity days, or exam day clashes were detected in your current study schedule.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {proposals.map((prop, idx) => (
                    <div
                      key={prop.taskId || idx}
                      onClick={() => toggleProposal(prop.taskId)}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                        prop.selected 
                          ? 'bg-amber-500/5 border-amber-500/40 shadow-2xs' 
                          : 'bg-surface/60 border-theme opacity-65 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={prop.selected}
                          onChange={() => toggleProposal(prop.taskId)}
                          className="mt-1 w-4 h-4 rounded text-[#6B705C] accent-[#6B705C] cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-surface border border-theme text-primary">
                              {prop.subjectName}
                            </span>
                            <span className="text-xs font-bold text-primary">
                              {prop.taskName}
                            </span>
                            <span className="text-[10px] font-mono text-muted">
                              ~{prop.durationMinutes}m
                            </span>
                          </div>
                          <p className="text-[11px] text-muted italic">
                            {prop.reason}
                          </p>
                        </div>
                      </div>

                      {/* Time Change Preview Badge */}
                      <div className="flex items-center gap-2 text-xs shrink-0 pl-7 sm:pl-0">
                        <div className="text-right">
                          <div className="text-[10px] text-muted line-through font-mono">
                            {prop.originalDate} ({prop.originalStartTime || 'Unscheduled'})
                          </div>
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1 justify-end">
                            <span>{prop.proposedDate}</span>
                            <span>({prop.proposedStartTime}–{prop.proposedEndTime})</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLASH DIAGNOSTICS & AUDIT */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-3">
              {diagnosis.conflicts.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2 bg-surface/50 rounded-2xl border border-theme">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-primary">Zero Conflicts Detected</h4>
                  <p className="text-xs text-muted">All scheduled events and tasks have clean buffers.</p>
                </div>
              ) : (
                diagnosis.conflicts.map(conf => (
                  <div
                    key={conf.id}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      conf.severity === 'critical'
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-amber-500/10 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {conf.severity === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <h4 className="text-xs sm:text-sm font-bold text-primary">
                          {conf.title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface border border-theme text-muted">
                        {conf.date}
                      </span>
                    </div>

                    <p className="text-xs text-primary/80 leading-relaxed">
                      {conf.description}
                    </p>

                    {/* Affected Items List */}
                    {conf.affectedItems.length > 0 && (
                      <div className="bg-surface/80 border border-theme/60 rounded-xl p-2.5 space-y-1.5">
                        <span className="text-[10px] font-bold text-muted uppercase font-mono tracking-wider">
                          Affected Sessions ({conf.affectedItems.length}):
                        </span>
                        <div className="space-y-1">
                          {conf.affectedItems.map((item, idx) => (
                            <div key={item.id || idx} className="flex items-center justify-between text-xs">
                              <span className="text-primary font-medium truncate max-w-[280px]">
                                • {item.name}
                              </span>
                              <span className="text-[11px] font-mono text-muted shrink-0 ml-2">
                                {item.time || `${item.duration}m`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-muted italic flex items-center gap-1.5 pt-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Recommendation: {conf.suggestedResolution}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-theme bg-surface/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted">
            {proposals.length > 0 ? (
              <span>
                <strong className="text-primary">{selectedCount} of {proposals.length}</strong> tasks selected for auto-rescheduling.
              </span>
            ) : (
              <span>Schedule is clear and optimized.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
            >
              Close
            </button>

            {proposals.length > 0 && (
              <button
                onClick={handleApplyAutoReschedule}
                disabled={isApplying || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#5a5f4e] disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                {isApplying ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Applying Adjustments...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Apply Auto-Reschedule ({selectedCount})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
