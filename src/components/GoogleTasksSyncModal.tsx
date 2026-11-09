import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  X, 
  ListOrdered, 
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  RotateCcw
} from 'lucide-react';
import { StudyPlan, RevisionItem, StudySession } from '../types';
import { 
  listTaskLists, 
  getOrCreateStudyTaskList, 
  syncPlansAndRevisionsToGoogleTasks,
  cleanDuplicateGoogleTasks,
  transferSingleTaskToGoogleTasks,
  getTransferredGoogleTaskIds,
  clearTransferredGoogleTaskCache,
  GoogleTaskList,
  SingleTaskTransferItem
} from '../lib/googleTasksService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface GoogleTasksSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: StudyPlan[];
  revisions?: RevisionItem[];
  sessions?: StudySession[];
}

export const GoogleTasksSyncModal: React.FC<GoogleTasksSyncModalProps> = ({
  isOpen,
  onClose,
  plans = [],
  revisions = [],
  sessions = []
}) => {
  const [activeTab, setActiveTab] = useState<'single_item' | 'selective_batch'>('single_item');
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isLoadingLists, setIsLoadingLists] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; taskName: string }>({
    current: 0,
    total: 0,
    taskName: ''
  });
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 1-Time Transfer enforcement states
  const [transferredMap, setTransferredMap] = useState<Record<string, any>>({});
  const [allowRetransfer, setAllowRetransfer] = useState<boolean>(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'topics' | 'sessions' | 'revisions'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Selected items for single transfer or batch
  const [selectedSingleKey, setSelectedSingleKey] = useState<string>('');
  const [selectedBatchKeys, setSelectedBatchKeys] = useState<string[]>([]);

  // Cleaner state
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanNotice, setCleanNotice] = useState<string | null>(null);

  // Refresh transferred registry from storage
  const refreshTransferredRegistry = () => {
    setTransferredMap(getTransferredGoogleTaskIds());
  };

  useEffect(() => {
    if (!isOpen) return;

    refreshTransferredRegistry();

    const loadLists = async () => {
      setIsLoadingLists(true);
      setSyncError(null);
      try {
        const lists = await listTaskLists();
        setTaskLists(lists);
        if (lists.length > 0) {
          const studyList = lists.find(l => l.title === 'StudyFlow Academic Tasks' || l.title === 'Study Tasks');
          setSelectedListId(studyList ? studyList.id : lists[0].id);
        } else {
          const created = await getOrCreateStudyTaskList();
          setTaskLists([created]);
          setSelectedListId(created.id);
        }
      } catch (err: any) {
        console.warn('Failed to load task lists:', err);
        setSyncError(err.message || 'Could not load your Google Tasks lists. Please authorize access.');
      } finally {
        setIsLoadingLists(false);
      }
    };

    loadLists();
  }, [isOpen]);

  // Aggregate candidate items for transfer
  const allTransferrableItems = useMemo<SingleTaskTransferItem[]>(() => {
    const list: SingleTaskTransferItem[] = [];

    // 1. Study Plan Topics
    plans.forEach(plan => {
      (plan.topics || []).forEach(tp => {
        list.push({
          id: `${plan.id}-${tp.id || tp.topicName}`,
          type: 'plan_topic',
          title: `📖 [${tp.subjectName}] ${tp.topicName}`,
          notes: `Chapter: ${tp.chapterName}\nEstimated: ${tp.estimatedMinutes}m | Priority: ${tp.priority}\nPlan Date: ${plan.date}\nSynced from StudyFlow`,
          dueDate: plan.date,
          completed: tp.completed
        });
      });
    });

    // 2. Recent Timer Sessions
    sessions.slice(0, 25).forEach(s => {
      list.push({
        id: s.id,
        type: 'session',
        title: `⚡ [${s.subjectName}] ${s.topicName} (${s.durationMinutes}m)`,
        notes: `Chapter: ${s.chapterName}\nDuration: ${s.durationMinutes} minutes\nSession Date: ${s.date}\nNotes: ${s.notes || 'None'}`,
        dueDate: s.date,
        completed: true
      });
    });

    // 3. Spaced Revisions
    revisions.forEach(rev => {
      list.push({
        id: rev.id,
        type: 'revision',
        title: `🔄 Revise: ${rev.topicName} (${rev.subjectName})`,
        notes: `Chapter: ${rev.chapterName}\nPriority: ${rev.priority}\nDue Date: ${rev.dueDate}\nStatus: ${rev.status}`,
        dueDate: rev.dueDate,
        completed: rev.status === 'Completed'
      });
    });

    return list;
  }, [plans, sessions, revisions]);

  // Filtered transfer items
  const filteredItems = useMemo(() => {
    return allTransferrableItems.filter(item => {
      if (itemTypeFilter === 'topics' && item.type !== 'plan_topic') return false;
      if (itemTypeFilter === 'sessions' && item.type !== 'session') return false;
      if (itemTypeFilter === 'revisions' && item.type !== 'revision') return false;
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        return item.title.toLowerCase().includes(query) || (item.notes || '').toLowerCase().includes(query);
      }
      return true;
    });
  }, [allTransferrableItems, itemTypeFilter, searchFilter]);

  // Set initial selected single item
  useEffect(() => {
    if (!selectedSingleKey && filteredItems.length > 0) {
      setSelectedSingleKey(`${filteredItems[0].type}:${filteredItems[0].id}`);
    }
  }, [filteredItems, selectedSingleKey]);

  if (!isOpen) return null;

  // Handle single item transfer (1-Time)
  const handleTransferSingle = async (targetItem?: SingleTaskTransferItem) => {
    const itemToTransfer = targetItem || filteredItems.find(i => `${i.type}:${i.id}` === selectedSingleKey);
    if (!itemToTransfer) {
      setSyncError('Please select a specific item to transfer.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const res = await transferSingleTaskToGoogleTasks(
        { ...itemToTransfer, taskListId: selectedListId },
        { force: allowRetransfer }
      );

      refreshTransferredRegistry();

      if (res.status === 'already_transferred') {
        setSyncSuccess(`ℹ️ ${res.message}`);
      } else {
        setSyncSuccess(`✓ ${res.message}`);
        triggerStudyGoalConfetti();
      }
    } catch (err: any) {
      console.error('Google Tasks single transfer error:', err);
      setSyncError(err.message || 'Failed to transfer item to Google Tasks.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle selective batch transfer with 1-Time Transfer enforcement
  const handleTransferBatch = async () => {
    const keysToTransfer = selectedBatchKeys.length > 0
      ? selectedBatchKeys
      : filteredItems.map(i => `${i.type}:${i.id}`);

    if (keysToTransfer.length === 0) {
      setSyncError('No items selected for transfer.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    setSyncProgress({ current: 0, total: keysToTransfer.length, taskName: 'Connecting to Google Tasks...' });

    try {
      const res = await syncPlansAndRevisionsToGoogleTasks(
        { plans, revisions },
        (current, total, taskName) => {
          setSyncProgress({ current, total, taskName });
        },
        {
          force: allowRetransfer,
          selectedItemKeys: keysToTransfer
        }
      );

      refreshTransferredRegistry();

      let msg = `✓ Completed transfer: ${res.createdCount} new task(s) added.`;
      if (res.skippedCount > 0) {
        msg += ` ${res.skippedCount} item(s) skipped (already transferred to prevent duplicates).`;
      }
      setSyncSuccess(msg);
      if (res.createdCount > 0) {
        triggerStudyGoalConfetti();
      }
      if (res.errors.length > 0) {
        setSyncError(`Some items had warnings: ${res.errors[0]}`);
      }
    } catch (err: any) {
      console.error('Batch transfer error:', err);
      setSyncError(err.message || 'Failed to sync with Google Tasks.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCleanDuplicates = async () => {
    setIsCleaning(true);
    setCleanNotice(null);
    setSyncError(null);

    try {
      const res = await cleanDuplicateGoogleTasks();
      if (res.removedDuplicatesCount > 0) {
        setCleanNotice(`✓ Scanned and removed ${res.removedDuplicatesCount} duplicate task(s) from your Google Tasks!`);
        triggerStudyGoalConfetti();
      } else {
        setCleanNotice('✓ Zero duplicate tasks found. Your Google Tasks list is completely clean!');
      }
      setTimeout(() => setCleanNotice(null), 7000);
    } catch (err: any) {
      setSyncError(err.message || 'Failed to clean duplicate tasks.');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-card rounded-3xl max-w-2xl w-full border border-theme shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-theme flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <span>Google Tasks 1-Time Transfer Hub</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  Deduplication Guard
                </span>
              </h2>
              <p className="text-xs text-muted">
                Transfer a single item or selective tasks once without repeating or duplicating across iPad and phone.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface hover:bg-theme-accent border border-theme text-muted hover:text-primary flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
          
          {/* Target Task List Selection Box */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-theme space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-primary flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-emerald-600" />
                <span>Destination Google Tasks List:</span>
              </label>
              {isLoadingLists && (
                <span className="text-[10px] text-muted font-mono animate-pulse">Loading lists...</span>
              )}
            </div>

            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              disabled={isLoadingLists || taskLists.length === 0}
              className="w-full px-3 py-2 rounded-xl border border-theme bg-card text-xs font-semibold text-primary focus:outline-hidden focus:border-primary"
            >
              {taskLists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.title} {list.title.includes('StudyFlow') ? '★ (Dedicated Academic List)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Transfer Mode Switcher: Single Item Transfer vs Selective Batch */}
          <div className="flex items-center justify-between border-b border-theme pb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-surface border border-theme rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('single_item')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'single_item'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Single Item Transfer (1-Time)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('selective_batch')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'selective_batch'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Selective Batch Transfer</span>
              </button>
            </div>

            {/* 1-Time Transfer Guard Status */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowRetransfer}
                  onChange={(e) => setAllowRetransfer(e.target.checked)}
                  className="rounded border-theme"
                />
                <span>Allow Re-transfer</span>
              </label>
              <button
                type="button"
                onClick={handleCleanDuplicates}
                disabled={isCleaning}
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-theme-surface hover:bg-theme-accent text-primary border border-theme transition cursor-pointer flex items-center gap-1"
                title="Scan and delete duplicate tasks in Google Tasks"
              >
                <RefreshCw className={`w-3 h-3 ${isCleaning ? 'animate-spin' : ''}`} />
                <span>Clean Duplicates</span>
              </button>
            </div>
          </div>

          {cleanNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
              <span>{cleanNotice}</span>
              <button onClick={() => setCleanNotice(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {(['all', 'topics', 'sessions', 'revisions'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setItemTypeFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition cursor-pointer ${
                    itemTypeFilter === f
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-surface text-muted hover:text-primary border border-theme'
                  }`}
                >
                  {f === 'all' ? `All (${allTransferrableItems.length})` : f}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search topic or session..."
              className="px-2.5 py-1 rounded-lg bg-surface border border-theme text-xs text-primary placeholder:text-muted focus:outline-none w-44"
            />
          </div>

          {/* TAB 1: SINGLE ITEM TRANSFER */}
          {activeTab === 'single_item' && (
            <div className="space-y-3">
              <p className="text-[11px] text-muted">
                Select a single study topic, timer session, or revision item below to transfer it once. Already transferred tasks are tagged and protected against duplicate re-transfer.
              </p>

              <div className="max-h-56 overflow-y-auto space-y-1.5 border border-theme rounded-2xl p-2 bg-surface">
                {filteredItems.map(item => {
                  const itemKey = `${item.type}:${item.id}`;
                  const isTransferred = Boolean(transferredMap[itemKey]);
                  const isSelected = selectedSingleKey === itemKey;

                  return (
                    <div
                      key={itemKey}
                      onClick={() => setSelectedSingleKey(itemKey)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-theme/70 bg-card hover:border-theme'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="radio"
                          name="single_transfer_item"
                          checked={isSelected}
                          onChange={() => setSelectedSingleKey(itemKey)}
                          className="text-primary cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-primary truncate text-xs flex items-center gap-1.5">
                            <span>{item.title}</span>
                          </div>
                          <div className="text-[10px] font-mono text-muted flex items-center gap-2 mt-0.5">
                            <span className="capitalize">{item.type.replace('_', ' ')}</span>
                            <span>•</span>
                            <span>Due: {item.dueDate || 'Today'}</span>
                            {item.completed && <span className="text-emerald-600 dark:text-emerald-400">✓ Done</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isTransferred ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Transferred</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Ready
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSingleKey(itemKey);
                            handleTransferSingle(item);
                          }}
                          disabled={isSyncing}
                          className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                        >
                          Transfer Now
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredItems.length === 0 && (
                  <div className="p-4 text-center text-muted text-xs">
                    No matching study items found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SELECTIVE BATCH TRANSFER */}
          {activeTab === 'selective_batch' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Select items to batch transfer ({selectedBatchKeys.length} selected):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Select all not yet transferred
                      const nonTransferred = filteredItems
                        .filter(i => !transferredMap[`${i.type}:${i.id}`])
                        .map(i => `${i.type}:${i.id}`);
                      setSelectedBatchKeys(nonTransferred);
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Select Non-Transferred Only
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBatchKeys(filteredItems.map(i => `${i.type}:${i.id}`))}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBatchKeys([])}
                    className="hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 border border-theme rounded-2xl p-2 bg-surface">
                {filteredItems.map(item => {
                  const itemKey = `${item.type}:${item.id}`;
                  const isTransferred = Boolean(transferredMap[itemKey]);
                  const isChecked = selectedBatchKeys.includes(itemKey);

                  return (
                    <label
                      key={itemKey}
                      className="p-2 rounded-xl border border-theme bg-card hover:bg-theme-surface flex items-center justify-between gap-2.5 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBatchKeys(prev => [...prev, itemKey]);
                            } else {
                              setSelectedBatchKeys(prev => prev.filter(k => k !== itemKey));
                            }
                          }}
                          className="rounded text-primary cursor-pointer"
                        />
                        <span className="font-semibold text-primary truncate max-w-[340px]">
                          {item.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isTransferred && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            ✓ Synced
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted">
                          {item.dueDate || 'Today'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sync Progress Indicator */}
          {isSyncing && (
            <div className="space-y-2 max-w-sm mx-auto text-center py-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-primary">
                <span>Transferring task {syncProgress.current} of {syncProgress.total || 1}...</span>
                <span>{Math.round((syncProgress.current / Math.max(1, syncProgress.total || 1)) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-theme-surface overflow-hidden border border-theme/40">
                <div 
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.round((syncProgress.current / Math.max(1, syncProgress.total || 1)) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-muted truncate font-mono">
                {syncProgress.taskName || 'Processing Google Tasks API...'}
              </div>
            </div>
          )}

          {syncSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncSuccess}</span>
            </div>
          )}

          {syncError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-theme">
            <div className="text-[11px] text-muted font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>1-Time Transfer Guarantee (Zero duplicates)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-theme text-muted hover:text-primary hover:bg-surface font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>

              {activeTab === 'single_item' ? (
                <button
                  type="button"
                  onClick={() => handleTransferSingle()}
                  disabled={isSyncing || !selectedSingleKey || !selectedListId}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Transfer 1 Item Only</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTransferBatch}
                  disabled={isSyncing || selectedBatchKeys.length === 0 || !selectedListId}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Transfer {selectedBatchKeys.length} Selected</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
