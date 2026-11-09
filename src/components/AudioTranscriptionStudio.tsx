import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Flame, 
  Sparkles, 
  Volume2, 
  Upload, 
  Copy, 
  Check, 
  Clock, 
  BookOpen, 
  FileText, 
  X, 
  RotateCcw,
  Zap,
  ArrowRight,
  BookmarkCheck,
  Languages
} from 'lucide-react';
import { 
  transcribeAudioWithGemini, 
  AudioRecorderController, 
  TranscriptionCookingResult 
} from '../lib/transcriptionService';
import { Subject, UserNote } from '../types';

interface AudioTranscriptionStudioProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubject?: string;
  initialTopic?: string;
  onSaveToNotes?: (note: { title: string; content: string; subject: string; topic: string }) => void;
  onAttachToActiveTimer?: (transcript: string) => void;
  onAddTo137Cycle?: (params: { subjectName: string; topicName: string; notes?: string }) => void;
}

export const AudioTranscriptionStudio: React.FC<AudioTranscriptionStudioProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubject,
  initialTopic,
  onSaveToNotes,
  onAttachToActiveTimer,
  onAddTo137Cycle
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || subjects[0]?.name || 'Physics');
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || 'Core Principles');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isCooking, setIsCooking] = useState<boolean>(false);
  const [cookingStage, setCookingStage] = useState<string>('');
  const [result, setResult] = useState<TranscriptionCookingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'polished' | 'raw' | 'formulas' | 'summary'>('polished');

  // Controller & timer refs
  const recorderRef = useRef<AudioRecorderController | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Soundwave visualizer state
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(24).fill(10));
  const visualizerAnimRef = useRef<any>(null);

  useEffect(() => {
    if (initialSubject) setSelectedSubject(initialSubject);
    if (initialTopic) setSelectedTopic(initialTopic);
  }, [initialSubject, initialTopic]);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      if (recorderRef.current?.isActive()) {
        recorderRef.current.stop().catch(() => {});
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (visualizerAnimRef.current) cancelAnimationFrame(visualizerAnimRef.current);
    };
  }, []);

  const startVisualizer = () => {
    const update = () => {
      if (recorderRef.current?.isActive()) {
        const freqData = recorderRef.current.getFrequencyData();
        if (freqData) {
          const step = Math.floor(freqData.length / 24);
          const bars: number[] = [];
          for (let i = 0; i < 24; i++) {
            const val = freqData[i * step] || 0;
            // scale 0-255 to percentage height 10% to 100%
            bars.push(Math.max(12, Math.round((val / 255) * 100)));
          }
          setWaveformBars(bars);
        }
        visualizerAnimRef.current = requestAnimationFrame(update);
      }
    };
    visualizerAnimRef.current = requestAnimationFrame(update);
  };

  const handleStartRecording = async () => {
    setErrorMsg(null);
    try {
      const controller = new AudioRecorderController();
      await controller.start();
      recorderRef.current = controller;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      startVisualizer();
    } catch (err: any) {
      console.error('Microphone error:', err);
      setErrorMsg('Microphone access denied or unavailable. Please enable microphone permissions in your browser.');
    }
  };

  const handleStopAndCook = async () => {
    if (!recorderRef.current) return;
    clearInterval(timerIntervalRef.current);
    if (visualizerAnimRef.current) cancelAnimationFrame(visualizerAnimRef.current);

    try {
      setIsCooking(true);
      setCookingStage('Harvesting pristine acoustic buffer...');
      const audioBlob = await recorderRef.current.stop();
      setIsRecording(false);

      setCookingStage('Gemini AI is cooking: extracting formulas and terminology...');
      const cooked = await transcribeAudioWithGemini(audioBlob, {
        subject: selectedSubject,
        topic: selectedTopic,
        taskType: 'study_notes'
      });

      setResult(cooked);
      setIsCooking(false);
    } catch (err: any) {
      console.error('Cooking transcription failed:', err);
      setIsRecording(false);
      setIsCooking(false);
      setErrorMsg(err.message || 'Audio cooking failed. Please try speaking closer to your microphone.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsCooking(true);
    setCookingStage(`Uploading and analyzing "${file.name}"...`);

    try {
      const cooked = await transcribeAudioWithGemini(file, {
        subject: selectedSubject,
        topic: selectedTopic,
        taskType: 'study_notes'
      });
      setResult(cooked);
      setIsCooking(false);
    } catch (err: any) {
      console.error('File transcription failed:', err);
      setIsCooking(false);
      setErrorMsg(err.message || 'File transcription failed. Supported formats: MP3, WAV, M4A, WebM.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1C1F1E] border border-stone-800 text-stone-100 rounded-3xl w-full max-w-4xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between bg-stone-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Audio & Voice Transcription Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  🔥 Powered by Gemini AI
                </span>
              </div>
              <p className="text-xs text-stone-400">
                High-fidelity speech cooking for study notes, Feynman viva, formulas & bilingual explanations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Topic & Subject Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-900/40 p-4 rounded-2xl border border-stone-800/80">
            <div>
              <label className="block text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={isRecording || isCooking}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-200 focus:outline-none focus:border-orange-500"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                {!subjects.some((s) => s.name === selectedSubject) && (
                  <option value={selectedSubject}>{selectedSubject}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">
                Topic or Focus Concept
              </label>
              <input
                type="text"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={isRecording || isCooking}
                placeholder="e.g. Newton's 3rd Law, Organic Nomenclature..."
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-200 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Recorder Stage */}
          <div className="bg-stone-950/80 border border-stone-800 rounded-3xl p-6 text-center relative overflow-hidden">
            {/* Background Glow */}
            <div className={`absolute inset-0 bg-gradient-to-b ${isRecording ? 'from-orange-500/10 via-transparent' : 'from-transparent'} pointer-events-none transition-all duration-700`} />

            {/* Equalizer Visualizer */}
            <div className="flex items-center justify-center gap-1.5 h-16 mb-4 px-8">
              {waveformBars.map((height, idx) => (
                <div
                  key={idx}
                  style={{ height: `${isRecording ? height : 12}%` }}
                  className={`w-2 rounded-full transition-all duration-75 ${
                    isRecording 
                      ? 'bg-gradient-to-t from-orange-500 to-amber-300 shadow-sm shadow-orange-500/50' 
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>

            {/* Time / State Indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {isRecording ? (
                <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-mono font-bold animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  Recording: {formatSeconds(recordingSeconds)}
                </div>
              ) : isCooking ? (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-sm font-semibold">
                  <Flame className="w-4 h-4 animate-spin text-orange-400" />
                  {cookingStage}
                </div>
              ) : (
                <div className="text-xs text-stone-400 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-stone-500" />
                  Ready to record voice explanations, Feynman drills, or upload audio files.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isRecording ? (
                <>
                  <button
                    onClick={handleStartRecording}
                    disabled={isCooking}
                    className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-bold shadow-lg shadow-orange-500/25 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                  >
                    <Mic className="w-5 h-5" />
                    <span>Start Voice Recording</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCooking}
                    className="flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-sm font-medium transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Audio File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </>
              ) : (
                <button
                  onClick={handleStopAndCook}
                  className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-xl shadow-red-500/30 hover:brightness-110 active:scale-95 transition"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>Stop & Cook with Gemini AI 🔥</span>
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs text-left">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Results Showcase */}
          {result && (
            <div className="bg-stone-900/60 border border-stone-800 rounded-3xl p-6 space-y-5 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
                    {result.confidenceScore}%
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-stone-200">
                      Cooked Output: {selectedSubject}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <Languages className="w-3.5 h-3.5 text-stone-400" />
                      <span>{result.detectedLanguage}</span>
                      <span>•</span>
                      <span>{result.rawTranscript.split(/\s+/).length} words spoken</span>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800">
                  <button
                    onClick={() => setActiveTab('polished')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'polished'
                        ? 'bg-orange-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    📝 Polished Notes
                  </button>
                  <button
                    onClick={() => setActiveTab('formulas')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'formulas'
                        ? 'bg-orange-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    🧪 Formulas ({result.mathAndScientificFormulas.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'summary'
                        ? 'bg-orange-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    🔑 Core Concepts
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'raw'
                        ? 'bg-orange-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    📋 Verbatim
                  </button>
                </div>
              </div>

              {/* Tab Display */}
              <div className="min-h-[160px]">
                {activeTab === 'polished' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
                        Academic Structure & Formulas
                      </span>
                      <button
                        onClick={() => copyToClipboard(result.polishedText, 'polished')}
                        className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-medium"
                      >
                        {copiedSection === 'polished' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSection === 'polished' ? 'Copied!' : 'Copy Notes'}</span>
                      </button>
                    </div>
                    <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-sm text-stone-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {result.polishedText}
                    </div>
                  </div>
                )}

                {activeTab === 'formulas' && (
                  <div className="space-y-3">
                    <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
                      Extracted Mathematical & Chemical Equations
                    </span>
                    {result.mathAndScientificFormulas.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {result.mathAndScientificFormulas.map((form, i) => (
                          <div
                            key={i}
                            className="bg-stone-950 border border-stone-800 p-3 rounded-xl flex items-center justify-between font-mono text-sm text-amber-300"
                          >
                            <span>{form}</span>
                            <button
                              onClick={() => copyToClipboard(form, `form_${i}`)}
                              className="text-stone-500 hover:text-stone-300 p-1"
                            >
                              {copiedSection === `form_${i}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-stone-500 text-xs italic bg-stone-950 rounded-2xl">
                        No explicit mathematical or chemical equations detected in this passage.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'summary' && (
                  <div className="space-y-3">
                    <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
                      Key Concepts & High-Yield Takeaways
                    </span>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {result.keyConcepts.map((kc, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        >
                          #{kc}
                        </span>
                      ))}
                    </div>
                    <ul className="space-y-2 bg-stone-950 p-4 rounded-2xl border border-stone-800 text-sm text-stone-300 list-disc list-inside">
                      {result.summaryNotes.map((sn, sIdx) => (
                        <li key={sIdx}>{sn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeTab === 'raw' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
                        Verbatim Spoken Speech
                      </span>
                      <button
                        onClick={() => copyToClipboard(result.rawTranscript, 'raw')}
                        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200"
                      >
                        {copiedSection === 'raw' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSection === 'raw' ? 'Copied' : 'Copy Verbatim'}</span>
                      </button>
                    </div>
                    <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-xs text-stone-300 leading-relaxed font-mono whitespace-pre-wrap">
                      {result.rawTranscript}
                    </div>
                  </div>
                )}
              </div>

              {/* 1-Click Action Dispatchers */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-800">
                <div className="text-xs text-stone-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Transfer cooked notes to Study Planner:</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onSaveToNotes && (
                    <button
                      onClick={() => {
                        onSaveToNotes({
                          title: `${selectedSubject}: ${selectedTopic} (Voice Note)`,
                          content: result.polishedText,
                          subject: selectedSubject,
                          topic: selectedTopic
                        });
                        alert('✅ Cooked notes added to Study Notes!');
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Save to Notes</span>
                    </button>
                  )}

                  {onAttachToActiveTimer && (
                    <button
                      onClick={() => {
                        onAttachToActiveTimer(result.polishedText);
                        alert('✅ Attached to your active study timer session!');
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                    >
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      <span>Attach to Active Timer</span>
                    </button>
                  )}

                  {onAddTo137Cycle && (
                    <button
                      onClick={() => {
                        onAddTo137Cycle({
                          subjectName: selectedSubject,
                          topicName: selectedTopic,
                          notes: result.polishedText
                        });
                        alert('✅ Added to 1-3-7 Spaced Revision cycle!');
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 text-xs font-semibold transition"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Queue in 1-3-7 Cycle</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
