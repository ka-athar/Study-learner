/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Award, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  BookOpen, 
  Target, 
  CheckCircle2, 
  Filter,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { 
  Subject, 
  TestResult, 
  StudySession, 
  PersonalBestRecord, 
  PersonalBestMetricId, 
  SubjectPersonalBests,
  AcademicMilestoneRecord, 
  RecurringWeaknessItem, 
  ActiveTab 
} from '../types';
import { 
  evaluatePersonalBests, 
  evaluateAcademicMilestones, 
  detectRecurringWeaknesses, 
  ACADEMIC_ENGINE_EVENT 
} from '../lib/academicMasteryEngine';
import { loadMistakes } from '../lib/mistakeVaultStorage';
import { PersonalBestsCard } from './PersonalBestsCard';
import { MilestonesCard } from './MilestonesCard';
import { ThingsIKeepForgettingCard } from './ThingsIKeepForgettingCard';
import { FixWeaknessModal } from './FixWeaknessModal';

interface PersonalBestsMilestonesViewProps {
  subjects: Subject[];
  testResults: TestResult[];
  sessions: StudySession[];
  onNavigateTab: (tab: ActiveTab) => void;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
}

export const PersonalBestsMilestonesView: React.FC<PersonalBestsMilestonesViewProps> = ({
  subjects,
  testResults,
  sessions,
  onNavigateTab,
  onStartTimerForTopic
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'bests' | 'milestones' | 'recurring'>('bests');
  const [activeRemediation, setActiveRemediation] = useState<RecurringWeaknessItem | null>(null);

  // Compute live engine evaluations based on persistent data
  const pbState = useMemo(() => {
    return evaluatePersonalBests(subjects, testResults, sessions);
  }, [subjects, testResults, sessions]);

  const milestones = useMemo(() => {
    return evaluateAcademicMilestones(subjects, testResults, sessions);
  }, [subjects, testResults, sessions]);

  const recurringWeaknesses = useMemo(() => {
    return detectRecurringWeaknesses(loadMistakes(), testResults, [], [], subjects);
  }, [testResults, subjects]);

  const unlockedMilestonesCount = milestones.filter(m => m.unlocked).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-3 sm:px-6">
      {/* Top Banner */}
      <div className="rounded-3xl bg-header border border-theme p-6 sm:p-8 relative overflow-hidden shadow-xs">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
              <Trophy className="w-3 h-3" />
              <span>Self-Comparison & Mastery Engine</span>
            </span>
            <span className="text-xs font-mono text-muted">• No Competition • Pure Self-Growth</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-primary">
            Personal Bests, Milestones & Weakness Autopsy
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Every metric compares your latest test performance, speed, and volume against your own previous verified records. 
            Study → Practice → Measure → Diagnose → Correct → Verify → Improve.
          </p>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-theme/60">
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-mono uppercase text-muted block">Mock Exam Best</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-primary">
              {pbState.records.highest_mock_score?.currentFormatted || '86%'}
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
              {pbState.records.highest_mock_score?.improvementFormatted || '+12 pts'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-mono uppercase text-muted block">MCQ Accuracy Peak</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-primary">
              {pbState.records.highest_mcq_accuracy?.currentFormatted || '88%'}
            </span>
            <span className="text-[10px] text-muted block mt-0.5">
              Previous: {pbState.records.highest_mcq_accuracy?.previousFormatted || '80%'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-mono uppercase text-muted block">Milestones Verified</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-primary">
              {unlockedMilestonesCount} / {milestones.length}
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block mt-0.5 font-medium">
              Academic Benchmarks
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-mono uppercase text-muted block">Recurring Weaknesses</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {recurringWeaknesses.length} Patterns
            </span>
            <span className="text-[10px] text-muted block mt-0.5">
              Requires Remediation
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-theme pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('bests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer shrink-0 ${
            activeSubTab === 'bests'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:text-primary hover:bg-theme-accent'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Personal Bests (14 Metrics)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('milestones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer shrink-0 ${
            activeSubTab === 'milestones'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:text-primary hover:bg-theme-accent'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Academic Milestones ({unlockedMilestonesCount}/{milestones.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recurring')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer shrink-0 ${
            activeSubTab === 'recurring'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:text-primary hover:bg-theme-accent'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>Things You Keep Forgetting ({recurringWeaknesses.length})</span>
        </button>
      </div>

      {/* Sub-Tab Content */}
      {activeSubTab === 'bests' && (
        <div className="space-y-6">
          <PersonalBestsCard 
            records={pbState.records} 
            subjectBests={pbState.subjectBests} 
          />

          {/* Subject Breakdown Card */}
          <div className="rounded-3xl bg-surface border border-theme p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-serif font-bold text-primary">
                  Subject-Specific Personal Records
                </h3>
                <p className="text-xs text-muted">
                  Highest test scores and improvements tracked per individual curriculum
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(Object.values(pbState.subjectBests) as SubjectPersonalBests[]).map(sb => {
                return (
                  <div 
                    key={sb.subjectName}
                    className="p-4 rounded-2xl border border-theme bg-surface hover:border-theme/80 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">{sb.subjectName}</span>
                      <span className="text-[10px] font-mono text-muted">{sb.bestDate}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme/60 flex items-baseline justify-between">
                      <span className="text-lg font-bold font-mono text-primary">{sb.highestScore}%</span>
                      {sb.improvementPoints !== undefined && sb.improvementPoints > 0 && (
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{sb.improvementPoints} percentage points
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-muted space-y-0.5">
                      <div className="truncate font-medium text-foreground">{sb.bestTestTitle}</div>
                      <div>Mastered topics: {sb.masteredTopicsCount}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'milestones' && (
        <MilestonesCard milestones={milestones} />
      )}

      {activeSubTab === 'recurring' && (
        <ThingsIKeepForgettingCard 
          weaknesses={recurringWeaknesses} 
          onStartRemediation={(weakness) => setActiveRemediation(weakness)}
        />
      )}

      {/* Remediation Modal */}
      {activeRemediation && (
        <FixWeaknessModal
          weakness={activeRemediation}
          onClose={() => setActiveRemediation(null)}
          onCured={() => setActiveRemediation(null)}
        />
      )}
    </div>
  );
};
