import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  BookOpen,
  Filter,
  Zap,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Subject, CognitiveTopicHealth } from '../types';
import { buildCognitiveHealthGraph } from '../lib/retentionGraphStorage';

interface RetentionHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onStartDrillForTopic: (subjectName: string, topicName: string) => void;
}

export const RetentionHeatmapModal: React.FC<RetentionHeatmapModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onStartDrillForTopic
}) => {
  const [healthGraph, setHealthGraph] = useState<CognitiveTopicHealth[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | 'critical_decay' | 'decaying' | 'safe'>('all');

  const refreshData = () => {
    const data = buildCognitiveHealthGraph(subjects);
    setHealthGraph(data);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen, subjects]);

  if (!isOpen) return null;

  const filteredTopics = healthGraph.filter(item => {
    if (selectedSubject !== 'all' && item.subjectName !== selectedSubject) return false;
    if (selectedRiskFilter !== 'all' && item.riskLevel !== selectedRiskFilter) return false;
    return true;
  });

  const criticalCount = healthGraph.filter(t => t.riskLevel === 'critical_decay').length;
  const decayingCount = healthGraph.filter(t => t.riskLevel === 'decaying').length;
  const safeCount = healthGraph.filter(t => t.riskLevel === 'safe').length;
  const avgRetention = healthGraph.length > 0 
    ? Math.round(healthGraph.reduce((acc, t) => acc + t.retentionPercent, 0) / healthGraph.length) 
    : 85;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-theme rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">Cognitive Health & Forgetting Curve Graph</h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-900 dark:text-rose-200 text-[10px] font-mono font-bold uppercase">
                  Ebbinghaus Decay Model
                </span>
              </div>
              <p className="text-xs text-muted">
                Correlating Mistake Vault traps, Blurt Autopsies, and Mock Exam marks into unified memory stability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              title="Refresh Graph Calculations"
              className="w-8 h-8 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* High-Level Overview Metrics */}
        <div className="p-4 sm:p-5 border-b border-theme bg-surface-raised grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Overall Syllabus Retention</div>
            <div className="text-xl font-bold font-mono text-primary mt-0.5">{avgRetention}%</div>
            <div className="text-[10px] text-muted">Estimated recall probability</div>
          </div>

          <div 
            onClick={() => setSelectedRiskFilter(selectedRiskFilter === 'critical_decay' ? 'all' : 'critical_decay')}
            className={`p-3 rounded-2xl border cursor-pointer transition ${
              selectedRiskFilter === 'critical_decay' ? 'bg-rose-500/20 border-rose-500' : 'bg-surface border-theme hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <span>Critical Memory Decay</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{criticalCount} Topics</div>
            <div className="text-[10px] text-muted">Needs immediate drill</div>
          </div>

          <div 
            onClick={() => setSelectedRiskFilter(selectedRiskFilter === 'decaying' ? 'all' : 'decaying')}
            className={`p-3 rounded-2xl border cursor-pointer transition ${
              selectedRiskFilter === 'decaying' ? 'bg-amber-500/20 border-amber-500' : 'bg-surface border-theme hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <span>Decaying Memory</span>
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{decayingCount} Topics</div>
            <div className="text-[10px] text-muted">Review within 48 hours</div>
          </div>

          <div 
            onClick={() => setSelectedRiskFilter(selectedRiskFilter === 'safe' ? 'all' : 'safe')}
            className={`p-3 rounded-2xl border cursor-pointer transition ${
              selectedRiskFilter === 'safe' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-surface border-theme hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span>Consolidated (Safe)</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{safeCount} Topics</div>
            <div className="text-[10px] text-muted">High neural stability</div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-3 sm:px-5 border-b border-theme flex flex-wrap items-center justify-between gap-3 text-xs bg-surface">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-muted uppercase">Subject:</span>
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1 rounded-xl font-bold text-xs transition cursor-pointer ${
                selectedSubject === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-surface-raised border border-theme text-secondary hover:text-primary'
              }`}
            >
              All Subjects
            </button>
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.name)}
                className={`px-3 py-1 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${
                  selectedSubject === s.name
                    ? 'bg-primary text-white'
                    : 'bg-surface-raised border border-theme text-secondary hover:text-primary'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {selectedRiskFilter !== 'all' && (
            <button
              onClick={() => setSelectedRiskFilter('all')}
              className="text-[11px] text-muted hover:text-primary underline cursor-pointer"
            >
              Clear Risk Filter ({selectedRiskFilter.replace('_', ' ')})
            </button>
          )}
        </div>

        {/* Heatmap Matrix Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {filteredTopics.length === 0 ? (
            <div className="py-16 text-center text-muted space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-primary">No topics match this filter.</p>
              <p className="text-xs">Your memory curve for this selection is currently stable.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTopics.map((item) => {
                const isCritical = item.riskLevel === 'critical_decay';
                const isDecaying = item.riskLevel === 'decaying';

                return (
                  <div
                    key={item.topicKey}
                    className={`p-4 rounded-2xl border transition shadow-2xs flex flex-col justify-between space-y-3 ${
                      isCritical
                        ? 'bg-rose-500/5 border-rose-500/30'
                        : isDecaying
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-surface-raised border-theme'
                    }`}
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            {item.subjectName} &bull; {item.chapterName || 'General'}
                          </span>
                          <h4 className="text-xs font-bold text-primary leading-snug">
                            {item.topicName}
                          </h4>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0 uppercase ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                            : isDecaying
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {item.retentionPercent}% Retention
                        </span>
                      </div>

                      {/* Ebbinghaus Decay Bar */}
                      <div className="w-full h-2 rounded-full bg-theme-accent/60 overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCritical ? 'bg-rose-600' : isDecaying ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${item.retentionPercent}%` }}
                        />
                      </div>

                      {/* Diagnostic Attributes */}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-muted">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted" />
                          <span>Last review: {item.daysSinceReview}d ago</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${item.totalLoggedMistakes > 0 ? 'text-rose-500' : 'text-muted'}`} />
                          <span className={item.totalLoggedMistakes > 0 ? 'font-bold text-rose-600 dark:text-rose-400' : ''}>
                            {item.totalLoggedMistakes} Uncured Trap{item.totalLoggedMistakes === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t border-theme/40 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted">
                        {isCritical ? '⚡ High risk of exam slip' : 'Stability: ~' + Math.round(item.stabilityDays) + ' days'}
                      </span>

                      <button
                        onClick={() => {
                          onStartDrillForTopic(item.subjectName, item.topicName);
                          onClose();
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          isCritical
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-surface hover:bg-theme-accent text-primary border border-theme'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Launch 2-Min Drill</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface flex items-center justify-between">
          <div className="text-[11px] text-muted flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Active recall passes progressively flatten your personal forgetting curve.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-xs transition cursor-pointer"
          >
            Close Heatmap
          </button>
        </div>

      </div>
    </div>
  );
};
