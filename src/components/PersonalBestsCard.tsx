/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Calendar, 
  Sparkles, 
  Flame, 
  Clock, 
  Zap, 
  Award, 
  Target, 
  FileCheck, 
  BookOpen, 
  CheckCircle2, 
  Filter,
  ArrowUpRight
} from 'lucide-react';
import { PersonalBestRecord, PersonalBestMetricId, SubjectPersonalBests } from '../types';

interface PersonalBestsCardProps {
  records: Record<PersonalBestMetricId, PersonalBestRecord>;
  subjectBests?: Record<string, SubjectPersonalBests>;
  compact?: boolean;
}

export const PersonalBestsCard: React.FC<PersonalBestsCardProps> = ({
  records,
  subjectBests = {},
  compact = false
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'testing' | 'speed' | 'endurance' | 'productivity' | 'mastery'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  const allRecords = Object.values(records) as PersonalBestRecord[];
  
  // Find prominent new personal best for the spotlight hero banner
  const spotlightRecord = allRecords.find(r => r.metricId === 'best_subject_improvement') || 
                          allRecords.find(r => r.isNewRecord) || 
                          allRecords[0];

  const filteredRecords = allRecords.filter(r => {
    const matchCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchSubject = selectedSubject === 'all' || (r.subjectName && r.subjectName.toLowerCase() === selectedSubject.toLowerCase());
    return matchCategory && matchSubject;
  });

  const subjectsList = Array.from(new Set(
    allRecords.map(r => r.subjectName).filter(Boolean) as string[]
  ));

  return (
    <div className="rounded-3xl bg-surface border border-theme shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-theme bg-header/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-serif font-bold text-primary">
                Personal Bests & Growth Trajectory
              </h3>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                Self-Comparison Only
              </span>
            </div>
            <p className="text-xs text-muted">
              Evaluated strictly against your own historical benchmarks across 14 academic dimensions
            </p>
          </div>
        </div>

        {/* Category Filter Pills */}
        {!compact && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              All Records ({allRecords.length})
            </button>
            <button
              onClick={() => setSelectedCategory('testing')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                selectedCategory === 'testing'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              Exams & Scores
            </button>
            <button
              onClick={() => setSelectedCategory('speed')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                selectedCategory === 'speed'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              Speed & Pace
            </button>
            <button
              onClick={() => setSelectedCategory('productivity')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                selectedCategory === 'productivity'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              Volume & Focus
            </button>
            <button
              onClick={() => setSelectedCategory('mastery')}
              className={`px-3 py-1 rounded-xl font-semibold transition cursor-pointer shrink-0 ${
                selectedCategory === 'mastery'
                  ? 'bg-primary text-white'
                  : 'bg-theme-accent text-muted hover:text-primary'
              }`}
            >
              Mastery & Cures
            </button>
          </div>
        )}
      </div>

      {/* Featured Spotlight: NEW PERSONAL BEST Announcement Banner */}
      {spotlightRecord && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-transparent border-b border-theme">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                  NEW PERSONAL BEST
                </span>
                <span className="text-xs font-mono text-muted">
                  Achieved: {spotlightRecord.dateAchieved}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                <span>{spotlightRecord.subjectName || 'Overall'} — {spotlightRecord.currentFormatted}</span>
                {spotlightRecord.improvementFormatted && (
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Improvement — {spotlightRecord.improvementFormatted}</span>
                  </span>
                )}
              </div>
              {spotlightRecord.previousFormatted && (
                <p className="text-xs text-muted">
                  Previous best — <strong className="text-foreground">{spotlightRecord.previousFormatted}</strong> • Context: {spotlightRecord.context}
                </p>
              )}
            </div>

            <div className="self-end sm:self-auto text-right">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted block">Benchmark Metric</span>
              <span className="text-xs sm:text-sm font-semibold text-primary">{spotlightRecord.title}</span>
            </div>
          </div>
        </div>
      )}

      {/* Records Grid */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRecords.slice(0, compact ? 6 : filteredRecords.length).map(record => {
            return (
              <div 
                key={record.metricId}
                className="rounded-2xl border border-theme bg-surface hover:border-theme/80 p-3.5 sm:p-4 space-y-2.5 transition shadow-2xs flex flex-col justify-between"
              >
                {/* Metric Title & Category Badge */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-theme-accent text-muted">
                      {record.category}
                    </span>
                    {record.isNewRecord && (
                      <span className="text-[9px] font-mono font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        NEW PB
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-primary">
                    {record.title}
                  </h4>
                </div>

                {/* Main Values Comparison: Current vs Previous */}
                <div className="p-2.5 rounded-xl bg-theme-accent/40 border border-theme/60 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg sm:text-xl font-bold font-mono text-primary">
                      {record.currentFormatted}
                    </span>
                    {record.improvementFormatted && (
                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {record.improvementFormatted}
                      </span>
                    )}
                  </div>

                  {record.previousFormatted && (
                    <div className="flex items-center justify-between text-[11px] text-muted border-t border-theme/40 pt-1">
                      <span>Previous best:</span>
                      <span className="font-semibold text-foreground">{record.previousFormatted}</span>
                    </div>
                  )}
                </div>

                {/* Context & Date Achieved Footer */}
                <div className="text-[11px] text-muted space-y-0.5 pt-1 border-t border-theme/30">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="truncate max-w-[160px] text-primary font-medium">{record.context}</span>
                    <span>{record.dateAchieved}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
