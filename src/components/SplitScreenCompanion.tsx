import React, { useState, useEffect } from 'react';
import { 
  X, 
  Columns, 
  ExternalLink, 
  FileText, 
  Maximize2, 
  Minimize2, 
  Tv, 
  Clock, 
  Zap, 
  BookOpen, 
  RefreshCw,
  Plus,
  Play,
  Pause,
  ChevronRight
} from 'lucide-react';
import { 
  GlobalTimerSession, 
  getPersistedTimer, 
  pauseGlobalTimerSession, 
  resumeGlobalTimerSession,
  addMinutesToGlobalTimer
} from '../lib/globalTimerService';
import { pipTimer } from '../lib/pipTimerService';
import { Subject, StudyPlan, UserProfile } from '../types';

interface SplitScreenCompanionProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  userProfile: UserProfile | null;
  onStartTimerForTopic: (subject: string, chapter: string, topic: string, minutes?: number) => void;
  onNavigateToCockpit: () => void;
}

export const SplitScreenCompanion: React.FC<SplitScreenCompanionProps> = ({
  isOpen,
  onClose,
  subjects,
  userProfile,
  onStartTimerForTopic,
  onNavigateToCockpit
}) => {
  const [splitRatio, setSplitRatio] = useState<number>(55); // Left percentage
  const [docUrl, setDocUrl] = useState<string>(() => {
    return localStorage.getItem('studyflow_splitscreen_url') || '';
  });
  const [tempUrlInput, setTempUrlInput] = useState<string>(docUrl);
  const [scratchNotes, setScratchNotes] = useState<string>(() => {
    return localStorage.getItem('studyflow_splitscreen_notes') || '';
  });
  const [timer, setTimer] = useState<GlobalTimerSession | null>(() => getPersistedTimer());
  const [activeTab, setActiveTab] = useState<'timer' | 'notes' | 'formulas'>('timer');

  useEffect(() => {
    const handleUpdate = (e: any) => {
      setTimer(e.detail || getPersistedTimer());
    };
    window.addEventListener('studyplanner:timer-update', handleUpdate);
    const interval = setInterval(() => {
      setTimer(getPersistedTimer());
    }, 1000);
    return () => {
      window.removeEventListener('studyplanner:timer-update', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) return null;

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let clean = tempUrlInput.trim();
    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    setDocUrl(clean);
    try {
      localStorage.setItem('studyflow_splitscreen_url', clean);
    } catch (e) {}
  };

  const handleNotesChange = (text: string) => {
    setScratchNotes(text);
    try {
      localStorage.setItem('studyflow_splitscreen_notes', text);
    } catch (e) {}
  };

  const seconds = timer?.secondsLeft ?? 1500;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const isPaused = timer?.isPaused || !timer?.isRunning;

  return (
    <div className="fixed inset-0 z-50 bg-[#1C1D1A]/95 backdrop-blur-md flex flex-col animate-fade-in text-[#FAF8F5]">
      {/* Top Bar */}
      <header className="h-14 border-b border-white/10 px-4 flex items-center justify-between shrink-0 bg-[#242522]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Columns className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-serif text-white flex items-center gap-2">
              <span>Split-Screen Study Companion</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                Multi-Monitor Ready
              </span>
            </h2>
            <p className="text-[11px] text-stone-400">
              Read lecture PDFs or past papers on the left while tracking sprint focus on the right
            </p>
          </div>
        </div>

        {/* Ratio Selector & Window Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10 text-xs">
            <button
              onClick={() => setSplitRatio(40)}
              className={`px-2 py-1 rounded-lg transition ${splitRatio === 40 ? 'bg-white/20 text-white font-bold' : 'text-stone-400'}`}
            >
              40 : 60
            </button>
            <button
              onClick={() => setSplitRatio(55)}
              className={`px-2 py-1 rounded-lg transition ${splitRatio === 55 ? 'bg-white/20 text-white font-bold' : 'text-stone-400'}`}
            >
              55 : 45
            </button>
            <button
              onClick={() => setSplitRatio(70)}
              className={`px-2 py-1 rounded-lg transition ${splitRatio === 70 ? 'bg-white/20 text-white font-bold' : 'text-stone-400'}`}
            >
              70 : 30
            </button>
          </div>

          <button
            onClick={() => pipTimer.togglePip()}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
            title="Pop out floating Picture-in-Picture window"
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Picture-in-Picture</span>
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-stone-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Split Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT PANE: Document / Resource Viewer */}
        <div 
          style={{ flex: `0 0 ${splitRatio}%` }} 
          className="border-b md:border-b-0 md:border-r border-white/10 flex flex-col h-1/2 md:h-full bg-[#181916]"
        >
          {/* Document URL Bar */}
          <div className="p-2.5 border-b border-white/10 bg-[#20211E] flex items-center gap-2">
            <form onSubmit={handleSaveUrl} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={tempUrlInput}
                onChange={(e) => setTempUrlInput(e.target.value)}
                placeholder="Paste PDF link, Google Drive document, or textbook URL (e.g. https://...)"
                className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-400 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#585C4B] text-white text-xs font-bold transition shrink-0 cursor-pointer"
              >
                Load Resource
              </button>
            </form>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition"
                title="Open in new window"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Document View / Empty State */}
          <div className="flex-1 overflow-hidden relative">
            {docUrl ? (
              <iframe
                src={docUrl}
                title="Study Material Viewer"
                className="w-full h-full border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-stone-400 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-stone-500">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No document loaded</h3>
                  <p className="text-xs text-stone-400 max-w-sm mt-1">
                    Paste a link to any past-paper PDF, Google Docs study guide, or lecture slides above to study side-by-side with your active sprint timer.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      const sample = 'https://archive.org/details/texts';
                      setTempUrlInput(sample);
                      setDocUrl(sample);
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300"
                  >
                    Open Reference Archive
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Companion Cockpit & Notes */}
        <div className="flex-1 flex flex-col h-1/2 md:h-full bg-[#1C1D1A]">
          {/* Right Pane Navigation */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-[#20211E]">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('timer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'timer' ? 'bg-[#6B705C] text-white shadow-xs' : 'text-stone-400 hover:text-white'
                }`}
              >
                ⏱️ Focus Timer
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'notes' ? 'bg-[#6B705C] text-white shadow-xs' : 'text-stone-400 hover:text-white'
                }`}
              >
                📝 Active Scratchpad
              </button>
            </div>

            <button
              onClick={() => {
                onClose();
                onNavigateToCockpit();
              }}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <span>Full Cockpit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Pane Body */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'timer' ? (
              <div className="max-w-md mx-auto space-y-6 text-center">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                    Active Sprint
                  </span>
                  <h3 className="text-xl font-bold font-serif text-white mt-0.5">
                    {timer?.subjectName || 'Physics'}: {timer?.topicName || 'Focus Sprint'}
                  </h3>
                </div>

                {/* Big Timer */}
                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="text-5xl sm:text-6xl font-black font-mono tracking-wider text-white">
                    {timeFormatted}
                  </div>
                  <div className="text-xs font-mono text-stone-400 mt-2">
                    {isPaused ? '⏸️ Paused (Wall-clock synced)' : '🟢 Timer ticks accurately even if minimized'}
                  </div>

                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => {
                        if (isPaused) resumeGlobalTimerSession();
                        else pauseGlobalTimerSession();
                      }}
                      className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition shadow-lg cursor-pointer ${
                        isPaused
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                      <span>{isPaused ? 'Resume Sprint' : 'Pause Sprint'}</span>
                    </button>

                    <button
                      onClick={() => addMinutesToGlobalTimer(5)}
                      className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
                      title="Add 5 minutes"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+5m</span>
                    </button>
                  </div>
                </div>

                {/* Quick Topic Switcher */}
                <div className="text-left bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="text-xs font-bold text-stone-300 mb-2 flex items-center justify-between">
                    <span>Quick Switch Sprint Topic</span>
                    <span className="text-[10px] font-mono text-stone-400">{subjects.length} Subjects</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {subjects.slice(0, 4).map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => onStartTimerForTopic(sub.name, sub.chapters[0]?.name || 'General', sub.chapters[0]?.topics[0]?.name || 'Core Mastery', 25)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left text-xs text-stone-200 transition truncate cursor-pointer"
                      >
                        <div className="font-bold truncate">{sub.name}</div>
                        <div className="text-[10px] text-stone-400 truncate">{sub.chapters[0]?.topics[0]?.name || 'Sprint'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Scratchpad */
              <div className="h-full flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-300">Active Recall & Scratch Notes</span>
                  <span className="text-[10px] font-mono text-stone-400">Auto-saved to storage</span>
                </div>
                <textarea
                  value={scratchNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Jot down active recall summaries, formulas, or tricky definitions as you read the document..."
                  className="flex-1 w-full bg-black/40 border border-white/15 rounded-2xl p-4 text-xs font-mono text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-400 resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
