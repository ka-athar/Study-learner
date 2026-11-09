import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Tv, 
  Columns, 
  Bell, 
  PenTool, 
  Sparkles, 
  Brain, 
  BookOpen, 
  BookmarkCheck, 
  Flame, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  ShieldCheck,
  Send,
  RefreshCw,
  Award
} from 'lucide-react';
import { 
  Subject, 
  StudySession, 
  StudyPlan, 
  RevisionItem, 
  UserProfile, 
  ActiveTab 
} from '../types';
import { 
  GlobalTimerSession, 
  getPersistedTimer, 
  startGlobalTimerSession, 
  pauseGlobalTimerSession, 
  resumeGlobalTimerSession, 
  addMinutesToGlobalTimer, 
  clearRunningTimer,
  scheduleImmediateReminder
} from '../lib/globalTimerService';
import { pipTimer } from '../lib/pipTimerService';
import { 
  sendNativePushNotification, 
  playNotificationChime, 
  requestPushPermission, 
  isPushNotificationSupported 
} from '../lib/pushNotificationManager';
import { triggerStudyGoalConfetti } from '../lib/confetti';
import { addMistake } from '../lib/mistakeVaultStorage';

interface StudyCockpitViewProps {
  sessions: StudySession[];
  plans: StudyPlan[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  subjects: Subject[];
  onStartTimerForTopic: (subject: string, chapter: string, topic: string, minutes?: number) => void;
  onSaveCompletedSession: (subject: string, topic: string, minutes: number) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenSplitScreen: () => void;
  onOpenNotificationDiagnostics?: () => void;
  onOpenTranscriptionStudio?: () => void;
  onSyncDataBridge?: () => void;
  isBridgeSyncing?: boolean;
}

export const StudyCockpitView: React.FC<StudyCockpitViewProps> = ({
  sessions,
  plans,
  revisions,
  userProfile,
  subjects,
  onStartTimerForTopic,
  onSaveCompletedSession,
  onNavigateTab,
  onOpenSplitScreen,
  onOpenNotificationDiagnostics,
  onOpenTranscriptionStudio,
  onSyncDataBridge,
  isBridgeSyncing = false
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPlan = plans.find(p => p.date === todayStr) || plans[0] || null;

  // Timer State
  const [timer, setTimer] = useState<GlobalTimerSession | null>(() => getPersistedTimer());
  const [selectedDuration, setSelectedDuration] = useState<number>(25);

  // Focus topic selection
  const [activeSubject, setActiveSubject] = useState<string>(subjects[0]?.name || 'Physics');
  const [activeTopic, setActiveTopic] = useState<string>(() => {
    return localStorage.getItem('studyflow_written_sprint_topic') || 'Electromagnetic Induction';
  });
  const [customTopicInput, setCustomTopicInput] = useState<string>('');

  // Post-session Active Recall & Blurt Check state
  const [showRecallPrompt, setShowRecallPrompt] = useState<boolean>(false);
  const [recalledPoints, setRecalledPoints] = useState<string>('');
  const [identifiedTrap, setIdentifiedTrap] = useState<string>('');
  const [recallSavedToast, setRecallSavedToast] = useState<string | null>(null);

  // Audio Ambience Generator (Web Audio API - 40Hz Gamma & Brown Noise)
  const [ambientAudioType, setAmbientAudioType] = useState<'off' | 'gamma40' | 'brown_noise'>('off');
  const audioNodesRef = useRef<{ ctx?: AudioContext; osc?: OscillatorNode; gain?: GainNode; noiseSource?: AudioBufferSourceNode }>({});

  // Push Permission State
  const [pushStatus, setPushStatus] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Listen for timer events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getPersistedTimer();
      setTimer(updated);
      if (updated && updated.secondsLeft === 0 && !updated.isRunning) {
        setShowRecallPrompt(true);
      }
    };
    window.addEventListener('studyplanner:timer-update', handleUpdate);
    const interval = setInterval(() => {
      const latest = getPersistedTimer();
      setTimer(latest);
      if (latest && latest.secondsLeft === 0 && !latest.isRunning) {
        setShowRecallPrompt(true);
      }
    }, 1000);
    return () => {
      window.removeEventListener('studyplanner:timer-update', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Ambient sound management
  useEffect(() => {
    stopAmbientAudio();
    if (ambientAudioType === 'gamma40') {
      start40HzBinaural();
    } else if (ambientAudioType === 'brown_noise') {
      startBrownNoise();
    }
    return () => stopAmbientAudio();
  }, [ambientAudioType]);

  const stopAmbientAudio = () => {
    try {
      if (audioNodesRef.current.osc) {
        audioNodesRef.current.osc.stop();
        audioNodesRef.current.osc.disconnect();
      }
      if (audioNodesRef.current.noiseSource) {
        audioNodesRef.current.noiseSource.stop();
        audioNodesRef.current.noiseSource.disconnect();
      }
      if (audioNodesRef.current.ctx && audioNodesRef.current.ctx.state !== 'closed') {
        audioNodesRef.current.ctx.close();
      }
    } catch (e) {}
    audioNodesRef.current = {};
  };

  const start40HzBinaural = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // 40Hz modulation for focused cognitive attention
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime); // 200 Hz carrier
      gain.gain.setValueAtTime(0.04, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      audioNodesRef.current = { ctx, osc, gain };
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  };

  const startBrownNoise = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);

      noiseSource.connect(gain);
      gain.connect(ctx.destination);
      noiseSource.start();

      audioNodesRef.current = { ctx, noiseSource, gain };
    } catch (e) {
      console.warn('Brown noise failed:', e);
    }
  };

  // Compute Today's Total Minutes
  const todaySessions = sessions.filter(s => s.date === todayStr);
  const totalMinutesToday = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursToday = (totalMinutesToday / 60).toFixed(1);
  const targetHours = userProfile?.targetHoursPerDay || 3;
  const targetPercent = Math.min(100, Math.round((totalMinutesToday / (targetHours * 60)) * 100));

  // Today's due items
  const dueRevisions = revisions.filter(r => r.status !== 'Completed' && (r.dueDate === todayStr || r.dueDate < todayStr));
  const pendingPlanTopics = todayPlan?.topics?.filter(t => !t.completed) || [];

  const handleStartSprint = (minutes: number = selectedDuration) => {
    const topicToUse = customTopicInput.trim() || activeTopic;
    startGlobalTimerSession(activeSubject, topicToUse, minutes, 'focus');
    setShowRecallPrompt(false);
    triggerStudyGoalConfetti();
  };

  const handleTestInstantNotification = async () => {
    let perm = pushStatus;
    if (perm !== 'granted') {
      try {
        perm = await requestPushPermission();
        setPushStatus(perm);
      } catch (e) {}
    }
    playNotificationChime();
    sendNativePushNotification({
      title: '🎯 Study Cockpit Alert Verified!',
      body: 'Notifications are active! Your timer will alert you with chime and banner when sprints complete, even in the background.',
      playSound: true,
      onClickUrl: '/?tab=study_cockpit'
    });

    if (perm === 'granted') {
      setReminderToast('Desktop notification, chime & in-app HUD sent successfully!');
    } else if (perm === 'denied') {
      setReminderToast('Chime & in-app HUD fired! (Desktop popups blocked by browser - click status pill to fix)');
    } else {
      setReminderToast('In-App HUD alert & audio chime sounded! Check browser prompt to allow desktop popups.');
    }
    setTimeout(() => setReminderToast(null), 4000);
  };

  const handleSetReminder = async (mins: number) => {
    if (pushStatus !== 'granted') {
      await requestPushPermission();
      setPushStatus(Notification.permission);
    }
    const topic = activeTopic || 'Study Sprint';
    scheduleImmediateReminder(`Study Focus Sprint (${mins}m)`, topic, mins);
    setReminderToast(`Reminder scheduled for ${mins} mins!`);
    setTimeout(() => setReminderToast(null), 3000);
  };

  const handleFinishEarly = () => {
    if (!timer) return;
    const spentMinutes = Math.max(1, Math.round((timer.targetSeconds - timer.secondsLeft) / 60));
    onSaveCompletedSession(timer.subjectName, timer.topicName, spentMinutes);
    clearRunningTimer();
    setShowRecallPrompt(true);
    triggerStudyGoalConfetti();
  };

  const handleSaveActiveRecall = () => {
    if (!timer) return;
    // If student noted a mistake or trap, push directly to Mistake Vault
    if (identifiedTrap.trim()) {
      addMistake({
        subjectName: timer.subjectName,
        chapter: 'Study Sprint',
        topicName: timer.topicName,
        question: `Active Recall Drill: ${timer.topicName}`,
        userAttempt: identifiedTrap,
        correctAnswer: recalledPoints || 'Mastered core definitions and formulas',
        errorCategory: 'careless_calc',
        notes: 'Identified during immediate post-sprint active recall check.'
      });
    }

    setRecallSavedToast('Active recall and mistake insights logged to vault!');
    setTimeout(() => {
      setRecallSavedToast(null);
      setShowRecallPrompt(false);
      setRecalledPoints('');
      setIdentifiedTrap('');
    }, 2500);
  };

  const seconds = timer?.secondsLeft ?? (selectedDuration * 60);
  const targetSeconds = timer?.targetSeconds ?? (selectedDuration * 60);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const isRunning = Boolean(timer?.isRunning && !timer?.isPaused);
  const isPaused = Boolean(timer?.isRunning && timer?.isPaused);
  const progressRatio = targetSeconds > 0 ? (1 - seconds / targetSeconds) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in text-[#282925] dark:text-[#E8E6DF]">
      {/* Toast */}
      {reminderToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-bounce-short">
          <CheckCircle2 className="w-4 h-4" />
          <span>{reminderToast}</span>
        </div>
      )}

      {/* TOP HEADER & ACTION COCKPIT */}
      <section className="bg-card border border-theme rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" />
              <span>Study Cockpit Command</span>
            </span>
            <span className="text-xs text-muted font-mono">{todayStr}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-primary">
            Unified Daily Study Cockpit
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            One distraction-free loop: Pick sprint topic → Deep focus with background wall-clock accuracy → Immediate active recall check → Sign daily hours.
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => pipTimer.togglePip()}
            className="px-3.5 py-2 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Pop out floating Picture-in-Picture window over other apps"
          >
            <Tv className="w-4 h-4 text-amber-500" />
            <span>Float PiP Timer</span>
          </button>

          <button
            type="button"
            onClick={onOpenSplitScreen}
            className="px-3.5 py-2 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Open side-by-side PDF and notes companion"
          >
            <Columns className="w-4 h-4 text-indigo-500" />
            <span>Split-Screen PDF</span>
          </button>

          {onOpenTranscriptionStudio && (
            <button
              type="button"
              onClick={onOpenTranscriptionStudio}
              className="px-3.5 py-2 rounded-2xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-800 dark:text-orange-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              title="Voice & Audio Transcription Studio: Record & cook notes with Gemini AI"
            >
              <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
              <span>Voice Studio (Cook)</span>
            </button>
          )}

          {onSyncDataBridge && (
            <button
              type="button"
              onClick={onSyncDataBridge}
              className="px-3.5 py-2 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-800 dark:text-cyan-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              title="Link & Sync Data: Push & pull study records between external screen & builder app"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-500 ${isBridgeSyncing ? 'animate-spin' : ''}`} />
              <span>{isBridgeSyncing ? 'Syncing...' : 'Link Screen'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onOpenNotificationDiagnostics) {
                onOpenNotificationDiagnostics();
              } else {
                handleTestInstantNotification();
              }
            }}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 border ${
              pushStatus === 'granted'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : pushStatus === 'denied'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-200'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200'
            }`}
            title="Notification diagnostics and fix center"
          >
            <span className={`w-2 h-2 rounded-full ${
              pushStatus === 'granted' ? 'bg-emerald-500 animate-pulse' : pushStatus === 'denied' ? 'bg-rose-500' : 'bg-amber-500'
            }`} />
            <span>
              {pushStatus === 'granted' ? 'Push Active' : pushStatus === 'denied' ? 'Alerts Blocked (Fix)' : 'Enable Alerts'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleTestInstantNotification}
            className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Test real browser push notification on your machine"
          >
            <Bell className="w-4 h-4" />
            <span>Test Alert Now</span>
          </button>
        </div>
      </section>

      {/* MAIN TWO-COLUMN WORKSTATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: THE SPRINT ENGINE & TIMER */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border border-theme rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-center relative overflow-hidden">
            {/* Background subtle ring progress */}
            <div 
              className="absolute top-0 left-0 h-1.5 bg-[#6B705C] transition-all duration-1000"
              style={{ width: `${Math.min(100, progressRatio * 100)}%` }}
            />

            {/* Topic Header in Timer */}
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {timer ? timer.subjectName : activeSubject}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-primary truncate mt-0.5">
                {timer ? timer.topicName : activeTopic}
              </h2>
            </div>

            {/* Big Countdown Timer */}
            <div className="py-2">
              <div className="text-6xl sm:text-7xl font-black font-mono tracking-wider text-primary">
                {timeFormatted}
              </div>
              <div className="text-xs font-mono text-muted mt-2 flex items-center justify-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : isPaused ? 'bg-amber-500' : 'bg-stone-400'}`} />
                <span>
                  {isRunning ? 'Ticking accurately in background' : isPaused ? 'Paused' : 'Ready to start'}
                </span>
              </div>
            </div>

            {/* Core Timer Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!timer || !timer.isRunning ? (
                <button
                  type="button"
                  onClick={() => handleStartSprint(selectedDuration)}
                  className="px-8 py-3.5 rounded-2xl bg-[#6B705C] hover:bg-[#585C4B] text-white text-base font-bold transition flex items-center gap-2.5 shadow-md hover:shadow-lg cursor-pointer active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start {selectedDuration}m Sprint</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPaused) resumeGlobalTimerSession();
                      else pauseGlobalTimerSession();
                    }}
                    className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-95 ${
                      isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addMinutesToGlobalTimer(5)}
                    className="px-4 py-3 rounded-2xl bg-surface hover:bg-theme-accent border border-theme text-primary text-sm font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+5m</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishEarly}
                    className="px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finish &amp; Recall</span>
                  </button>
                </>
              )}
            </div>

            {/* Quick Duration Buttons */}
            {!timer?.isRunning && (
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-theme">
                {[
                  { label: '15m Sprint', mins: 15 },
                  { label: '25m Pomodoro', mins: 25 },
                  { label: '50m Deep Block', mins: 50 },
                  { label: '90m Exam Block', mins: 90 },
                ].map((preset) => (
                  <button
                    key={preset.mins}
                    type="button"
                    onClick={() => setSelectedDuration(preset.mins)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedDuration === preset.mins
                        ? 'bg-[#6B705C] text-white shadow-xs'
                        : 'bg-surface hover:bg-theme-accent border border-theme text-muted'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Built-in Focus Audio Ambience Generator */}
            <div className="pt-3 border-t border-theme flex flex-wrap items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5 font-bold">
                <Volume2 className="w-4 h-4 text-amber-500" />
                <span>Focus Audio Ambience:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmbientAudioType('off')}
                  className={`px-2.5 py-1 rounded-lg transition ${ambientAudioType === 'off' ? 'bg-stone-300 dark:bg-stone-700 text-primary font-bold' : 'hover:bg-theme-accent'}`}
                >
                  Mute
                </button>
                <button
                  type="button"
                  onClick={() => setAmbientAudioType('gamma40')}
                  className={`px-2.5 py-1 rounded-lg transition ${ambientAudioType === 'gamma40' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30' : 'hover:bg-theme-accent'}`}
                >
                  ⚡ 40Hz Gamma Focus
                </button>
                <button
                  type="button"
                  onClick={() => setAmbientAudioType('brown_noise')}
                  className={`px-2.5 py-1 rounded-lg transition ${ambientAudioType === 'brown_noise' ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/30' : 'hover:bg-theme-accent'}`}
                >
                  🌧️ Brown Noise
                </button>
              </div>
            </div>
          </div>

          {/* ACTIVE RECALL & BLURT MODAL / CARD */}
          {showRecallPrompt && (
            <div className="bg-card border-2 border-amber-500/40 rounded-3xl p-6 shadow-lg space-y-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-theme pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-serif text-primary">
                      2-Minute Active Recall Check
                    </h3>
                    <p className="text-xs text-muted">
                      Sprint finished for <span className="font-bold text-primary">{timer?.topicName || activeTopic}</span>. Lock in memory before leaving.
                    </p>
                  </div>
                </div>
                {recallSavedToast && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    {recallSavedToast}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">
                    What 3 key points, formulas, or derivations did you just learn?
                  </label>
                  <textarea
                    rows={3}
                    value={recalledPoints}
                    onChange={(e) => setRecalledPoints(e.target.value)}
                    placeholder="1. Faraday's Law: Induced EMF = -N(dΦ/dt)...&#10;2. Lenz's Law gives the negative sign (conservation of energy)...&#10;3. Units of magnetic flux: Weber (Wb)..."
                    className="w-full bg-surface border border-theme rounded-2xl p-3 text-xs text-primary placeholder-muted focus:outline-hidden focus:border-amber-500 resize-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                    Did you get stuck on any trap or make a mistake? (Pushes to Mistake Vault)
                  </label>
                  <input
                    type="text"
                    value={identifiedTrap}
                    onChange={(e) => setIdentifiedTrap(e.target.value)}
                    placeholder="e.g. Forgot to multiply by number of turns N in formula..."
                    className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs text-primary placeholder-muted focus:outline-hidden focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('137_revision')}
                    className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>View 1-3-7 Queue</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRecallPrompt(false)}
                      className="px-3 py-1.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-bold text-muted cursor-pointer"
                    >
                      Skip For Now
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveActiveRecall}
                      className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#585C4B] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lock In Recall &amp; Log</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IMMEDIATE STUDY REMINDER STATION */}
          <div className="bg-card border border-theme rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Instant Push Notification Reminders</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Active in Background
              </span>
            </div>
            <p className="text-xs text-muted">
              Working on external browser tabs or other screens? Set an immediate nudge to return to your study desk:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[5, 15, 30, 45].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSetReminder(mins)}
                  className="py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-bold text-primary text-center transition cursor-pointer active:scale-95"
                >
                  🔔 In {mins}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AGENDA & DAILY SIGN-OFF */}
        <div className="lg:col-span-5 space-y-6">
          {/* DAILY SIGN-OFF ATTESTATION CARD */}
          <div className="bg-card border border-theme rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                Daily Study Certification
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {targetPercent}% of {targetHours}h Goal
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-black font-serif text-primary">
                  {hoursToday} <span className="text-sm font-sans font-normal text-muted">hours</span>
                </span>
                <p className="text-xs text-muted mt-0.5">
                  {todaySessions.length} focus sessions logged today
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center font-bold">
                <PenTool className="w-6 h-6" />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-surface border border-theme text-xs text-muted space-y-1.5">
              <div className="flex items-center justify-between font-bold text-primary">
                <span>Certified Student:</span>
                <span>{userProfile?.displayName || 'Athar Khan'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Accountability Sync:</span>
                <span className="text-emerald-600 font-bold">Google Chat &amp; Cloud Ready</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerStudyGoalConfetti();
                setReminderToast('Today\'s study hours attested and signed!');
                setTimeout(() => setReminderToast(null), 3000);
              }}
              className="w-full py-2.5 rounded-2xl bg-[#6B705C] hover:bg-[#585C4B] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <PenTool className="w-4 h-4" />
              <span>✍️ Sign &amp; Lock In Today's Hours</span>
            </button>
          </div>

          {/* SPRINT TOPIC PICKER */}
          <div className="bg-card border border-theme rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-serif text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span>Select Today's Topic Focus</span>
              </h3>
              <span className="text-[10px] font-mono text-muted">1-Click Load</span>
            </div>

            {/* Custom Input */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                placeholder={`Or type custom topic (e.g. ${activeTopic})...`}
                className="w-full bg-surface border border-theme rounded-xl px-3 py-2 text-xs text-primary placeholder-muted focus:outline-hidden focus:border-amber-500"
              />
            </div>

            {/* From 1-3-7 Spaced Revisions */}
            {dueRevisions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-theme">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Due 1-3-7 Spaced Revisions ({dueRevisions.length})</span>
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {dueRevisions.slice(0, 3).map((rev) => (
                    <button
                      key={rev.id}
                      type="button"
                      onClick={() => {
                        setActiveSubject(rev.subjectName);
                        setActiveTopic(rev.topicName);
                        setCustomTopicInput('');
                      }}
                      className="w-full p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-left text-xs transition flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-bold truncate text-indigo-950 dark:text-indigo-200">
                        {rev.subjectName}: {rev.topicName}
                      </span>
                      <span className="text-[10px] font-mono text-indigo-600 shrink-0">Stage {rev.cycleStage || 'Day 1'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* From Today's Plan */}
            {pendingPlanTopics.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-theme">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pending Agenda Topics</span>
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {pendingPlanTopics.slice(0, 4).map((top) => (
                    <button
                      key={top.id}
                      type="button"
                      onClick={() => {
                        setActiveSubject(top.subjectName);
                        setActiveTopic(top.topicName);
                        setCustomTopicInput('');
                      }}
                      className="w-full p-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-left text-xs transition flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-bold truncate text-primary">
                        {top.subjectName}: {top.topicName}
                      </span>
                      <span className="text-[10px] font-mono text-muted">{top.estimatedMinutes}m</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
