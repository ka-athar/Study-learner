/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  BookOpen, 
  Target, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Filter,
  Flame,
  Check
} from 'lucide-react';
import { AcademicMilestoneRecord, AcademicMilestoneId } from '../types';

interface MilestonesCardProps {
  milestones: AcademicMilestoneRecord[];
  compact?: boolean;
}

export const MilestonesCard: React.FC<MilestonesCardProps> = ({
  milestones,
  compact = false
}) => {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'in_progress'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'rigor' | 'mastery' | 'consistency' | 'resilience'>('all');

  const unlockedCount = milestones.filter(m => m.unlocked).length;

  const filteredMilestones = milestones.filter(m => {
    if (filter === 'unlocked' && !m.unlocked) return false;
    if (filter === 'in_progress' && m.unlocked) return false;
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="rounded-3xl bg-surface border border-theme shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-theme bg-header/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-serif font-bold text-primary">
                Academic Milestones
              </h3>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                {unlockedCount} of {milestones.length} Verified
              </span>
            </div>
            <p className="text-xs text-muted">
              Objective verification of academic readiness, syllabus depth, and retention benchmarks
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        {!compact && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              All ({milestones.length})
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                filter === 'unlocked'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              Achieved ({unlockedCount})
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                filter === 'in_progress'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              In Progress ({milestones.length - unlockedCount})
            </button>
          </div>
        )}
      </div>

      {/* Milestones Grid */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMilestones.slice(0, compact ? 6 : filteredMilestones.length).map(m => {
            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 space-y-3 transition shadow-2xs flex flex-col justify-between ${
                  m.unlocked
                    ? 'bg-surface border-theme'
                    : 'bg-surface/50 border-theme/40 opacity-80'
                }`}
              >
                {/* Status Indicator & Category */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-muted">
                      {m.category}
                    </span>
                    {m.unlocked ? (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Milestone Achieved</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-muted border border-theme/40">
                        In Progress
                      </span>
                    )}
                  </div>

                  {/* Title formatted as requested: "100 Questions Mastered" */}
                  <h4 className="text-sm font-bold text-primary pt-1">
                    "{m.title}"
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    {m.description}
                  </p>
                </div>

                {/* Academic Context & Relevant Score */}
                {m.unlocked ? (
                  <div className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted uppercase">Subject / Scope</span>
                      <span className="font-semibold text-primary">{m.subject || 'All Subjects'}</span>
                    </div>

                    {m.relevantScore && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted uppercase">Relevant Score</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {m.relevantScore}
                        </span>
                      </div>
                    )}

                    <div className="pt-1 border-t border-theme/40 text-[11px] text-muted">
                      <strong className="text-primary font-medium">Context: </strong>
                      <span>{m.academicContext}</span>
                    </div>

                    {m.dateAchieved && (
                      <div className="text-[10px] font-mono text-muted text-right pt-0.5">
                        Achieved on {m.dateAchieved}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-theme-accent/30 border border-theme/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">Target Requirement</span>
                      <span className="font-mono font-semibold text-primary">
                        {m.progressCurrent} / {m.progressTarget}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-theme-accent overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (m.progressCurrent / m.progressTarget) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
