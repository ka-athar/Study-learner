/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  RotateCcw, 
  BookOpen, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Search,
  CheckCircle2,
  Brain,
  ShieldAlert
} from 'lucide-react';
import { RecurringWeaknessItem, TopicStatus } from '../types';
import { FixWeaknessModal } from './FixWeaknessModal';

interface ThingsIKeepForgettingCardProps {
  weaknesses: RecurringWeaknessItem[];
  onStartRemediation?: (weakness: RecurringWeaknessItem) => void;
  compact?: boolean;
}

export const ThingsIKeepForgettingCard: React.FC<ThingsIKeepForgettingCardProps> = ({
  weaknesses,
  onStartRemediation,
  compact = false
}) => {
  const [activeRemediation, setActiveRemediation] = useState<RecurringWeaknessItem | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter only persistent mistakes (repeated >= 2 times as required)
  const persistentItems = weaknesses.filter(w => w.isPersistent);

  const filteredItems = selectedSubject === 'all'
    ? persistentItems
    : persistentItems.filter(w => w.subjectName.toLowerCase() === selectedSubject.toLowerCase());

  const subjectsList = Array.from(new Set(persistentItems.map(w => w.subjectName)));

  const handleFixWeakness = (item: RecurringWeaknessItem) => {
    if (onStartRemediation) {
      onStartRemediation(item);
    } else {
      setActiveRemediation(item);
    }
  };

  return (
    <div className="rounded-3xl bg-surface border border-theme shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-theme bg-header/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-serif font-bold text-primary">
                Things You Keep Forgetting
              </h3>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                {persistentItems.length} Persistent Blind Spots
              </span>
            </div>
            <p className="text-xs text-muted">
              Auto-detected recurring mistake patterns cross-referenced across tests, vaults, and revisions
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        {subjectsList.length > 1 && !compact && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                selectedSubject === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              All ({persistentItems.length})
            </button>
            {subjectsList.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                  selectedSubject === sub
                    ? 'bg-primary text-white'
                    : 'bg-theme-accent text-muted hover:text-primary'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body List */}
      <div className="p-4 sm:p-5 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-primary">No Persistent Weaknesses Detected</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Any isolated slips were one-time mistakes. As you practice more mock tests, any recurring conceptual gaps will automatically emerge here.
            </p>
          </div>
        ) : (
          filteredItems.slice(0, compact ? 4 : filteredItems.length).map((item, index) => {
            const isExpanded = expandedId === item.id;
            return (
              <div 
                key={item.id}
                className="rounded-2xl border border-theme bg-surface hover:border-theme/80 transition p-3.5 sm:p-4 space-y-3 shadow-2xs"
              >
                {/* Top Row: Rank, Subject, Concept, Counts & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-theme-accent flex items-center justify-center text-xs font-mono font-bold text-muted shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-muted uppercase">
                          {item.subjectName}
                        </span>
                        <span className="text-xs text-stone-300 dark:text-stone-700">•</span>
                        <h4 className="text-xs sm:text-sm font-bold text-primary">
                          {item.conceptName}
                        </h4>
                      </div>
                      
                      {/* Sub-meta: Mistakes & Relative Time */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          Wrong {item.mistakeCount} times
                        </span>
                        <span className="text-muted">•</span>
                        <span className="text-muted">
                          Last mistake: <strong className="text-primary font-medium">{item.mostRecentDisplay}</strong>
                        </span>
                        {item.lastSuccessfulRecall && (
                          <>
                            <span className="text-muted">•</span>
                            <span className="text-muted">
                              Last recall: {item.lastSuccessfulRecall}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fix This Weakness Button */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
                      title={isExpanded ? 'Collapse diagnostic details' : 'Expand diagnostic details'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleFixWeakness(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Fix This Weakness</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Recommended Intervention Highlight Box */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold">Intervention: </span>
                    <span>{item.recommendedIntervention}</span>
                  </div>
                </div>

                {/* Expanded Detailed Diagnostic Information */}
                {isExpanded && (
                  <div className="pt-2 border-t border-theme/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs animate-in fade-in duration-150">
                    <div className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme">
                      <span className="text-[10px] font-mono uppercase text-muted block">First Occurrence</span>
                      <span className="font-semibold text-primary">{item.firstOccurrenceDate}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme">
                      <span className="text-[10px] font-mono uppercase text-muted block">Related Chapter</span>
                      <span className="font-semibold text-primary truncate block">{item.relatedChapters.join(', ') || 'Core Syllabus'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme">
                      <span className="text-[10px] font-mono uppercase text-muted block">Mastery State</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{item.currentMasteryStatus} ({item.currentMasteryPercentage}%)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Active Remediation Modal */}
      {activeRemediation && (
        <FixWeaknessModal
          weakness={activeRemediation}
          onClose={() => setActiveRemediation(null)}
          onCured={() => {
            setActiveRemediation(null);
          }}
        />
      )}
    </div>
  );
};
