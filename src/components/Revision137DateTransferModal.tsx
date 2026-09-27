import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  RotateCcw, 
  ArrowRight, 
  Check, 
  X, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Flame, 
  ShieldCheck, 
  Info, 
  RefreshCw,
  Sliders,
  ChevronRight,
  BookmarkCheck
} from 'lucide-react';
import { Spaced137TopicCard, toLocalDateString, calculate137Milestones } from '../lib/spacedRevisionEngine';
import { Subject, RevisionItem } from '../types';

export interface Revision137DateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If provided, operates on this specific card; otherwise operates in batch mode
  initialTopicCard?: Spaced137TopicCard | null;
  allCards: Spaced137TopicCard[];
  subjects: Subject[];
  revisions: RevisionItem[];
  onRescheduleRevision: (
    topicInfo: { id?: string; subjectName: string; topicName: string; chapterName?: string },
    newDueDate: string,
    notes?: string
  ) => Promise<void> | void;
  onTransform137Cycle: (
    subjectName: string,
    topicName: string,
    newDay0Date: string,
    notes?: string
  ) => Promise<void> | void;
  onBatchTransferRevisions: (
    items: Array<{ id?: string; subjectName: string; topicName: string; chapterName?: string }>,
    targetDueDate: string,
    transferMode: 'due_date_only' | 'shift_timeline',
    daysShift: number
  ) => Promise<void> | void;
}

export const Revision137DateTransferModal: React.FC<Revision137DateTransferModalProps> = ({
  isOpen,
  onClose,
  initialTopicCard,
  allCards,
  subjects: _subjects,
  revisions,
  onRescheduleRevision,
  onTransform137Cycle,
  onBatchTransferRevisions
}) => {
  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

  // Mode: single card vs batch
  const isSingleMode = Boolean(initialTopicCard);

  // Tab: 'transfer_date' | 'transform_timeline' | 'workload_balancer'
  const [activeTab, setActiveTab] = useState<'transfer_date' | 'transform_timeline' | 'workload_balancer'>('transfer_date');

  // Source selection for batch mode
  const [sourceFilter, setSourceFilter] = useState<'overdue' | 'due_today' | 'due_tomorrow' | 'specific_date'>('overdue');
  const [sourceDate, setSourceDate] = useState<string>(todayStr);

  // Selected topics in batch mode (ids)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // Target Date Selection
  const defaultTargetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    return toLocalDateString(d);
  }, []);
  const [targetDate, setTargetDate] = useState<string>(defaultTargetDate);
  const [transferReason, setTransferReason] = useState<string>('');

  // Timeline Transform state (Day 0 re-anchoring)
  const [newDay0Date, setNewDay0Date] = useState<string>(() => {
    if (initialTopicCard) return initialTopicCard.initialStudyDate;
    return todayStr;
  });

  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Reset/initialize state when modal opens or initialTopicCard changes
  React.useEffect(() => {
    if (isOpen) {
      setSuccessBanner(null);
      setIsApplying(false);
      setTransferReason('');

      if (initialTopicCard) {
        // Initialize for single card
        setNewDay0Date(initialTopicCard.initialStudyDate || todayStr);
        // Default target date: tomorrow or current due date + 1
        const curDue = new Date(initialTopicCard.dueDate);
        curDue.setDate(curDue.getDate() + 1);
        setTargetDate(toLocalDateString(curDue));
      } else {
        // Batch mode: pick default filter based on what has items
        const hasOverdue = allCards.some(c => c.dueStatus === 'overdue');
        const defaultFilter = hasOverdue ? 'overdue' : 'due_today';
        setSourceFilter(defaultFilter);

        // Preselect all cards in that category
        const initialMatching = allCards.filter(c => {
          if (defaultFilter === 'overdue') return c.dueStatus === 'overdue';
          return c.dueStatus === 'due_today';
        });
        setSelectedCardIds(new Set(initialMatching.map(c => c.id)));
      }
    }
  }, [isOpen, initialTopicCard, allCards, todayStr]);

  // Available cards for batch selection based on sourceFilter
  const candidateBatchCards = useMemo(() => {
    if (isSingleMode) return [];
    return allCards.filter(c => {
      if (sourceFilter === 'overdue') return c.dueStatus === 'overdue';
      if (sourceFilter === 'due_today') return c.dueStatus === 'due_today';
      if (sourceFilter === 'due_tomorrow') return c.dueStatus === 'due_tomorrow';
      if (sourceFilter === 'specific_date') return c.dueDate === sourceDate;
      return true;
    });
  }, [isSingleMode, allCards, sourceFilter, sourceDate]);

  // Update selected cards when candidate list changes due to source filter
  const handleSourceFilterChange = (filter: 'overdue' | 'due_today' | 'due_tomorrow' | 'specific_date') => {
    setSourceFilter(filter);
    const matching = allCards.filter(c => {
      if (filter === 'overdue') return c.dueStatus === 'overdue';
      if (filter === 'due_today') return c.dueStatus === 'due_today';
      if (filter === 'due_tomorrow') return c.dueStatus === 'due_tomorrow';
      if (filter === 'specific_date') return c.dueDate === sourceDate;
      return true;
    });
    setSelectedCardIds(new Set(matching.map(c => c.id)));
  };

  const toggleSelectCard = (id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCardIds.size === candidateBatchCards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(candidateBatchCards.map(c => c.id)));
    }
  };

  // 7-day workload distribution for visualization and suggestions
  const workloadByDate = useMemo(() => {
    const map = new Map<string, { count: number; topics: Spaced137TopicCard[] }>();
    const base = new Date();
    
    // Check next 10 days
    for (let i = 0; i < 10; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dStr = toLocalDateString(d);
      map.set(dStr, { count: 0, topics: [] });
    }

    allCards.forEach(c => {
      if (c.dueStatus === 'completed') return;
      const rec = map.get(c.dueDate);
      if (rec) {
        rec.count += 1;
        rec.topics.push(c);
      }
    });

    return Array.from(map.entries()).map(([dateStr, data]) => {
      const dateObj = new Date(dateStr);
      const isToday = dateStr === todayStr;
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = isToday ? 'Today' : dayNames[dateObj.getDay()];
      return {
        dateStr,
        dayName,
        displayDate: `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })}`,
        count: data.count,
        topics: data.topics,
        isOverloaded: data.count >= 5,
        isHeavy: data.count >= 3 && data.count < 5,
        isLight: data.count < 3
      };
    });
  }, [allCards, todayStr]);

  // Milestones preview for timeline transform
  const transformedMilestones = useMemo(() => {
    return calculate137Milestones(newDay0Date);
  }, [newDay0Date]);

  // Calculate days difference between today/source and target
  const daysDiff = useMemo(() => {
    const tDate = new Date(targetDate);
    const bDate = new Date(todayStr);
    return Math.round((tDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [targetDate, todayStr]);

  // Quick Preset Handlers
  const handleQuickPreset = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setTargetDate(toLocalDateString(d));
  };

  const handleSetWeekend = (type: 'saturday' | 'sunday') => {
    const d = new Date();
    const day = d.getDay();
    const diff = type === 'saturday' ? (6 - day + 7) % 7 || 7 : (7 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    setTargetDate(toLocalDateString(d));
  };

  // Execute Single Transfer
  const handleExecuteSingleTransfer = async () => {
    if (!initialTopicCard) return;
    setIsApplying(true);
    try {
      if (activeTab === 'transform_timeline') {
        await onTransform137Cycle(
          initialTopicCard.subjectName,
          initialTopicCard.topicName,
          newDay0Date,
          transferReason
        );
        setSuccessBanner(`Transformed 1-3-7 cadence for "${initialTopicCard.topicName}"! Anchored to Day 0 (${newDay0Date}).`);
      } else {
        await onRescheduleRevision(
          {
            id: initialTopicCard.revisionId,
            subjectName: initialTopicCard.subjectName,
            topicName: initialTopicCard.topicName,
            chapterName: initialTopicCard.chapterName
          },
          targetDate,
          transferReason
        );
        setSuccessBanner(`Transferred "${initialTopicCard.topicName}" to ${targetDate}!`);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsApplying(false);
    }
  };

  // Reset to original cadence for a single transferred topic
  const handleResetToCadence = async () => {
    if (!initialTopicCard || !initialTopicCard.originalCadenceDate) return;
    setIsApplying(true);
    try {
      await onRescheduleRevision(
        {
          id: initialTopicCard.revisionId,
          subjectName: initialTopicCard.subjectName,
          topicName: initialTopicCard.topicName,
          chapterName: initialTopicCard.chapterName
        },
        initialTopicCard.originalCadenceDate,
        'Reset to original Ebbinghaus cadence'
      );
      setSuccessBanner(`Reset "${initialTopicCard.topicName}" back to original cadence date (${initialTopicCard.originalCadenceDate})!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } finally {
      setIsApplying(false);
    }
  };

  // Execute Batch Transfer
  const handleExecuteBatchTransfer = async () => {
    const selectedCards = candidateBatchCards.filter(c => selectedCardIds.has(c.id));
    if (selectedCards.length === 0) return;

    setIsApplying(true);
    try {
      const items = selectedCards.map(c => ({
        id: c.revisionId,
        subjectName: c.subjectName,
        topicName: c.topicName,
        chapterName: c.chapterName
      }));

      const mode = activeTab === 'transform_timeline' ? 'shift_timeline' : 'due_date_only';
      await onBatchTransferRevisions(items, targetDate, mode, Math.max(1, daysDiff));

      setSuccessBanner(`Successfully transferred ${items.length} topics to ${targetDate}!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsApplying(false);
    }
  };

  // Smart Auto-Distribute Overload: Spreads high-density days into lighter days
  const handleAutoDistributeOverload = async () => {
    const heavyDay = workloadByDate.find(w => w.count >= 4);
    if (!heavyDay) {
      setSuccessBanner('No overloaded days detected! Your revision workload is currently well-balanced.');
      return;
    }

    const lightDay = workloadByDate.find(w => w.dateStr > heavyDay.dateStr && w.count < 3);
    if (!lightDay) {
      setSuccessBanner('Next few days also have full schedules. Pick a custom target date below.');
      return;
    }

    // Pick half of the topics from heavy day to move to light day
    const topicsToMove = heavyDay.topics.slice(Math.ceil(heavyDay.topics.length / 2));
    setIsApplying(true);
    try {
      const items = topicsToMove.map(c => ({
        id: c.revisionId,
        subjectName: c.subjectName,
        topicName: c.topicName,
        chapterName: c.chapterName
      }));

      await onBatchTransferRevisions(items, lightDay.dateStr, 'due_date_only', 1);
      setSuccessBanner(`Smart Balanced: Shifted ${items.length} topics from ${heavyDay.dayName} to ${lightDay.dayName} (${lightDay.displayDate})!`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-theme rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-theme flex items-start justify-between gap-4 bg-surface-raised/40">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>1-3-7 Spaced Revision Engine</span>
            </div>
            <h2 className="text-xl font-extrabold text-primary flex items-center gap-2">
              <span>{isSingleMode ? `Reschedule & Date Transfer` : `Date Transfer & Workload Transformer`}</span>
            </h2>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              {isSingleMode 
                ? `Move "${initialTopicCard?.topicName}" to another date or recalibrate its complete 1-3-7 retention timeline.`
                : `Batch-transfer overdue or today's revision reviews from one date to another with automated retention protection.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-surface-raised border border-theme transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3 border-b border-theme flex items-center gap-2 bg-surface">
          <button
            onClick={() => setActiveTab('transfer_date')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transfer_date'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Transfer Due Date</span>
          </button>

          <button
            onClick={() => setActiveTab('transform_timeline')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transform_timeline'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Transform 1-3-7 Cadence</span>
          </button>

          {!isSingleMode && (
            <button
              onClick={() => setActiveTab('workload_balancer')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'workload_balancer'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Workload Balancer</span>
            </button>
          )}
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">

          {/* SINGLE TOPIC SUMMARY CARD */}
          {isSingleMode && initialTopicCard && (
            <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    {initialTopicCard.subjectName} • {initialTopicCard.chapterName}
                  </span>
                  <h3 className="font-extrabold text-base text-primary">
                    {initialTopicCard.topicName}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {initialTopicCard.currentStage.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    initialTopicCard.dueStatus === 'overdue' 
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : initialTopicCard.dueStatus === 'due_today'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-theme-accent text-muted border-theme'
                  }`}>
                    {initialTopicCard.dueStatus === 'overdue' ? 'Overdue' : initialTopicCard.dueStatus === 'due_today' ? 'Due Today' : 'Upcoming'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-theme/40 text-xs">
                <div>
                  <span className="text-[10px] text-muted block">Day 0 (Initial Study):</span>
                  <span className="font-mono font-bold text-primary">{initialTopicCard.initialStudyDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block">Current Due Date:</span>
                  <span className="font-mono font-bold text-primary">{initialTopicCard.dueDate}</span>
                </div>
                {initialTopicCard.isTransferredDate && initialTopicCard.originalCadenceDate && (
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-bold">Transferred From:</span>
                      <span className="font-mono text-[11px] text-muted">{initialTopicCard.originalCadenceDate}</span>
                    </div>
                    <button
                      onClick={handleResetToCadence}
                      disabled={isApplying}
                      className="text-[10px] px-2 py-1 rounded-lg bg-surface hover:bg-theme-accent border border-theme text-primary font-bold cursor-pointer"
                      title="Restore original Ebbinghaus formula date"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BATCH TOPIC SELECTOR (Batch mode only) */}
          {!isSingleMode && activeTab !== 'workload_balancer' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>1. Choose Topics to Transfer</span>
                </label>
                
                {/* Source Filter Quick Tabs */}
                <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-xl border border-theme text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSourceFilterChange('overdue')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      sourceFilter === 'overdue' ? 'bg-rose-500 text-white shadow-xs' : 'text-muted hover:text-primary'
                    }`}
                  >
                    Overdue ({allCards.filter(c => c.dueStatus === 'overdue').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSourceFilterChange('due_today')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      sourceFilter === 'due_today' ? 'bg-amber-500 text-white shadow-xs' : 'text-muted hover:text-primary'
                    }`}
                  >
                    Due Today ({allCards.filter(c => c.dueStatus === 'due_today').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSourceFilterChange('due_tomorrow')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      sourceFilter === 'due_tomorrow' ? 'bg-indigo-500 text-white shadow-xs' : 'text-muted hover:text-primary'
                    }`}
                  >
                    Tomorrow ({allCards.filter(c => c.dueStatus === 'due_tomorrow').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSourceFilterChange('specific_date')}
                    className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      sourceFilter === 'specific_date' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-primary'
                    }`}
                  >
                    By Date
                  </button>
                </div>
              </div>

              {sourceFilter === 'specific_date' && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-raised border border-theme text-xs">
                  <span className="text-muted font-bold">Pick Source Date:</span>
                  <input
                    type="date"
                    value={sourceDate}
                    onChange={(e) => {
                      setSourceDate(e.target.value);
                      const matching = allCards.filter(c => c.dueDate === e.target.value);
                      setSelectedCardIds(new Set(matching.map(c => c.id)));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-surface border border-theme text-primary font-mono text-xs focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-muted font-mono">({candidateBatchCards.length} scheduled)</span>
                </div>
              )}

              {/* Topic Multi-select List */}
              <div className="border border-theme rounded-2xl overflow-hidden bg-surface">
                <div className="p-2.5 bg-surface-raised/60 border-b border-theme flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="font-bold text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {selectedCardIds.size === candidateBatchCards.length && candidateBatchCards.length > 0
                        ? 'Deselect All'
                        : `Select All (${candidateBatchCards.length})`}
                    </span>
                  </button>
                  <span className="text-[11px] font-mono text-muted">
                    {selectedCardIds.size} of {candidateBatchCards.length} selected
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-theme/40">
                  {candidateBatchCards.map(card => {
                    const isSelected = selectedCardIds.has(card.id);
                    return (
                      <div
                        key={card.id}
                        onClick={() => toggleSelectCard(card.id)}
                        className={`p-2.5 text-xs flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSelected ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-theme-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by div click
                            className="rounded border-theme text-primary focus:ring-primary cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-primary font-bold block truncate">
                              {card.topicName}
                            </span>
                            <span className="text-[10px] text-muted block truncate">
                              {card.subjectName} • Due: {card.dueDate}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-theme text-muted">
                            {card.currentStage.toUpperCase()}
                          </span>
                          {card.dueStatus === 'overdue' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 border border-rose-500/20">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {candidateBatchCards.length === 0 && (
                    <div className="p-6 text-center text-xs text-muted">
                      No topics found in this category. Switch to another source filter tab above!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: TRANSFER DUE DATE */}
          {activeTab === 'transfer_date' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>2. Pick Target Date to Move Revisions To</span>
                </label>

                {/* Quick Presets Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset(1)}
                    className="p-2.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-center transition cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span>Tomorrow</span>
                    <span className="text-[10px] font-mono font-normal text-muted">+1 Day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickPreset(2)}
                    className="p-2.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-center transition cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span>+2 Days</span>
                    <span className="text-[10px] font-mono font-normal text-muted">Skip a day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetWeekend('saturday')}
                    className="p-2.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-center transition cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span>Saturday</span>
                    <span className="text-[10px] font-mono font-normal text-muted">Weekend catchup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetWeekend('sunday')}
                    className="p-2.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-center transition cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span>Sunday</span>
                    <span className="text-[10px] font-mono font-normal text-muted">Weekly wrap-up</span>
                  </button>
                </div>

                {/* Custom Date Input */}
                <div className="p-3 rounded-2xl bg-surface-raised border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-primary block">Custom Destination Date:</span>
                    <span className="text-[11px] text-muted">Select exact calendar date</span>
                  </div>
                  <input
                    type="date"
                    min={todayStr}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-surface border border-theme text-primary font-mono text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Reason / Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted">
                  Transfer Note (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Busy with physics lab today, moved review to Friday"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-surface-raised border border-theme text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Transfer Preview Card */}
              <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Transfer Impact & Retention Protection</span>
                </div>
                <p className="text-muted text-[11px] leading-relaxed">
                  Moving due date to <strong className="text-primary font-mono">{targetDate}</strong> ({daysDiff > 0 ? `+${daysDiff} days from now` : 'today'}). 
                  Your initial Day 0 study baseline is preserved for historical accuracy while scheduling your active recall drill on your chosen date.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSFORM 1-3-7 TIMELINE (Day 0 Re-anchoring) */}
          {activeTab === 'transform_timeline' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/10 via-surface-raised to-surface border border-indigo-500/20 space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <RotateCcw className="w-4 h-4" />
                  <span>Recalibrate Day 0 Initial Study Anchor</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  When you re-anchor the Day 0 learning date, the entire 1-3-7 Ebbinghaus progression shifts in unison:
                  <strong> Day 1 (+24h)</strong>, <strong>Day 3 (+72h)</strong>, and <strong>Day 7 (+168h)</strong> automatically recalibrate.
                </p>

                <div className="pt-2">
                  <label className="text-xs font-bold text-primary block mb-1.5">
                    New Day 0 (Initial Study Date):
                  </label>
                  <input
                    type="date"
                    value={newDay0Date}
                    onChange={(e) => setNewDay0Date(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-surface border border-theme text-primary font-mono text-xs focus:ring-1 focus:ring-primary w-full sm:w-auto"
                  />
                </div>
              </div>

              {/* Recalibrated Milestones Preview Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-primary block">
                  New Recalibrated Cadence Milestones:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-[10px] font-bold uppercase text-indigo-400 block">Day 1 (+24h)</span>
                    <span className="font-mono font-extrabold text-indigo-500 text-sm">{transformedMilestones.day1}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                    <span className="text-[10px] font-bold uppercase text-cyan-400 block">Day 3 (+72h)</span>
                    <span className="font-mono font-extrabold text-cyan-500 text-sm">{transformedMilestones.day3}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 block">Day 7 (+168h)</span>
                    <span className="font-mono font-extrabold text-emerald-500 text-sm">{transformedMilestones.day7}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WORKLOAD BALANCER & HEATMAP */}
          {!isSingleMode && activeTab === 'workload_balancer' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <Sliders className="w-4 h-4" />
                    <span>Workload Density & Burnout Prevention</span>
                  </div>
                  <button
                    onClick={handleAutoDistributeOverload}
                    disabled={isApplying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Distribute Overload</span>
                  </button>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Reviewing more than 4 topics per day impairs long-term retention. Use the timeline below to identify busy days and redistribute reviews into lighter slots.
                </p>
              </div>

              {/* 7-Day Density Strip */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-primary block">Upcoming 10-Day Revision Load:</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {workloadByDate.map(day => (
                    <div
                      key={day.dateStr}
                      onClick={() => {
                        setTargetDate(day.dateStr);
                        setActiveTab('transfer_date');
                      }}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        day.isOverloaded
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                          : day.isHeavy
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                          : 'bg-surface border-theme text-primary hover:bg-surface-raised'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted block">
                          {day.dayName}
                        </span>
                        <span className="font-mono text-xs font-bold block">
                          {day.displayDate}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-extrabold font-mono">
                          {day.count}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface/50 border border-theme/40">
                          {day.isOverloaded ? 'Heavy' : day.isHeavy ? 'Moderate' : 'Optimal'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-theme bg-surface-raised/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface border border-theme text-primary text-xs font-bold hover:bg-theme-accent transition cursor-pointer"
          >
            Cancel
          </button>

          {isSingleMode ? (
            <button
              type="button"
              onClick={handleExecuteSingleTransfer}
              disabled={isApplying}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-95 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply Transfer to {targetDate}</span>
                </>
              )}
            </button>
          ) : activeTab === 'workload_balancer' ? (
            <button
              type="button"
              onClick={() => setActiveTab('transfer_date')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-95 shadow-lg transition active:scale-95 cursor-pointer"
            >
              <span>Continue to Transfer Date</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecuteBatchTransfer}
              disabled={isApplying || selectedCardIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-95 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transferring {selectedCardIds.size} topics...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Transfer {selectedCardIds.size} Topic{selectedCardIds.size > 1 ? 's' : ''} to {targetDate}</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
