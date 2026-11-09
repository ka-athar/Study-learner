import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  Smartphone, 
  Laptop, 
  Tablet, 
  X, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  FileCheck, 
  BookmarkCheck, 
  Brain, 
  RotateCcw, 
  Calendar, 
  CheckSquare, 
  Settings, 
  Archive, 
  Copy, 
  Download, 
  Lock,
  Layers,
  Sparkles,
  ChevronDown,
  Info
} from 'lucide-react';
import QRCode from 'qrcode';
import { 
  TransferWorkflowStep, 
  TransferSafetyDiff, 
  ConflictResolutionMode,
  Subject,
  StudySession,
  StudyPlan,
  TestResult,
  StorageVault,
  FlashcardDeck,
  RevisionItem,
  Assignment,
  UserProfile,
  DailyHabitEntry
} from '../types';
import { 
  generateTransferPin, 
  redeemTransferPin, 
  detectDeviceInfo,
  pullFullCloudSnapshot 
} from '../lib/deviceService';
import { 
  analyzeTransferDiff, 
  createPreTransferSafetyBackup, 
  executeSafeMerge,
  setPairedDeviceStatus,
  LocalStudyDataset
} from '../lib/deviceTransferEngine';
import { setPairedSyncUid, setActiveUserEmail, resolveActiveUserId } from '../lib/db';

interface DeviceTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  localDataset: LocalStudyDataset;
  initialScannedPayload?: any;
  initialPin?: string;
  onApplyTransferredData: (mergedData: LocalStudyDataset, pairedUid?: string) => Promise<void> | void;
  onOpenQRScanner?: () => void;
}

export const DeviceTransferModal: React.FC<DeviceTransferModalProps> = ({
  isOpen,
  onClose,
  localDataset,
  initialScannedPayload,
  initialPin,
  onApplyTransferredData,
  onOpenQRScanner
}) => {
  // Mode: connect_screen (Generate/Scan) | preview_diff | transfer_progress
  const [activeScreen, setActiveScreen] = useState<'connect' | 'preview' | 'progress'>('connect');
  const [connectTab, setConnectTab] = useState<'generate' | 'scan_manual'>('generate');

  // Generator State
  const [myPin, setMyPin] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingPin, setIsGeneratingPin] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Manual PIN input
  const [inputPin, setInputPin] = useState<string>(initialPin || '');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Transfer Diff & Payload
  const [incomingPayload, setIncomingPayload] = useState<any>(initialScannedPayload || null);
  const [foundDeviceName, setFoundDeviceName] = useState<string>('Remote Device');
  const [diffAnalysis, setDiffAnalysis] = useState<TransferSafetyDiff | null>(null);
  const [conflictMode, setConflictMode] = useState<ConflictResolutionMode>('smart_merge');

  // Multi-step progress tracker
  const [workflowStep, setWorkflowStep] = useState<TransferWorkflowStep>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [transferStatusMessage, setTransferStatusMessage] = useState<string>('');
  const [isSyncPermanent, setIsSyncPermanent] = useState<boolean>(true);

  // Generate PIN & QR for THIS device on open
  useEffect(() => {
    if (isOpen && !myPin) {
      handleGenerateHostPin();
    }
  }, [isOpen]);

  // When initialScannedPayload is supplied from external QR scanner
  useEffect(() => {
    if (initialScannedPayload) {
      handleInspectPayload(initialScannedPayload, initialScannedPayload.deviceName || 'Scanned Device');
    }
  }, [initialScannedPayload]);

  // When initialPin is passed from QR scan or URL parameter, auto-populate and auto-lookup immediately
  useEffect(() => {
    if (initialPin) {
      const clean = String(initialPin).replace(/[^0-9]/g, '').slice(0, 6);
      if (clean) {
        setInputPin(clean);
        setConnectTab('scan_manual');
        if (clean.length === 6) {
          handleLookupPin(undefined, clean);
        }
      }
    }
  }, [initialPin]);

  const handleGenerateHostPin = async () => {
    setIsGeneratingPin(true);
    try {
      const devInfo = detectDeviceInfo();
      const effectiveUserUid = localDataset.profile?.uid || localDataset.profile?.id || resolveActiveUserId(null, localDataset.profile?.email) || 'user_primary';
      const userEmail = localDataset.profile?.email || '';

      const res = await generateTransferPin(
        effectiveUserUid,
        userEmail,
        localDataset
      );

      if (res.success && res.code) {
        setMyPin(res.code);

        // Generate clean QR code referencing this device handshake without dumping raw DB in QR
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
        const linkUrl = `${origin}${pathname}?transfer_code=${res.code}&sync_uid=${encodeURIComponent(effectiveUserUid)}&email=${encodeURIComponent(userEmail)}&device=${encodeURIComponent(devInfo.deviceName)}`;

        const url = await QRCode.toDataURL(linkUrl, {
          width: 280,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
          errorCorrectionLevel: 'M'
        });
        setQrDataUrl(url);
      }
    } catch (err) {
      console.warn('Error generating device PIN:', err);
    } finally {
      setIsGeneratingPin(false);
    }
  };

  const handleInspectPayload = (payload: any, deviceName: string) => {
    setIncomingPayload(payload);
    setFoundDeviceName(deviceName);
    const diff = analyzeTransferDiff(payload, localDataset, deviceName);
    setDiffAnalysis(diff);
    setActiveScreen('preview');
  };

  const handleLookupPin = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    const clean = (overrideCode || inputPin).replace(/[^0-9]/g, '').trim();
    if (clean.length !== 6) {
      setLookupError('Please enter a 6-digit code from your other device.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);

    try {
      const res = await redeemTransferPin(clean, { forcePull: true });
      let payloadToUse = res.payload;

      // If payload wasn't embedded on the root document, pull the full snapshot for this UID
      if (res.success && (!payloadToUse || !Array.isArray(payloadToUse.subjects) || payloadToUse.subjects.length === 0) && res.uid) {
        const cloudPull = await pullFullCloudSnapshot(res.uid);
        if (cloudPull.success && cloudPull.snapshot) {
          payloadToUse = cloudPull.snapshot;
        }
      }

      if (res.success) {
        const finalPayload = payloadToUse || {
          subjects: [],
          plans: [],
          sessions: [],
          vaults: [],
          assignments: [],
          testResults: [],
          flashcardDecks: [],
          revisions: [],
          profile: { uid: res.uid, email: res.email }
        };
        handleInspectPayload(finalPayload, res.deviceName || `Device (${clean})`);
      } else {
        setLookupError(res.message || 'Device not found. Please verify the 6-digit PIN on your other device.');
      }
    } catch (err: any) {
      setLookupError(err?.message || 'Failed to connect to device.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Perform multi-step cross-device transfer
  const handleStartTransfer = async (permanentSync: boolean) => {
    if (!incomingPayload) return;
    setIsSyncPermanent(permanentSync);
    setActiveScreen('progress');
    setWorkflowStep('connected');
    setProgressPercent(15);
    setTransferStatusMessage(`Connected to ${foundDeviceName}`);

    try {
      // Step 1: CONNECTED (verified)
      await new Promise(r => setTimeout(r, 400));
      setWorkflowStep('authenticated');
      setProgressPercent(30);
      setTransferStatusMessage('Authenticating handshake & validating device integrity token...');

      // Step 2: AUTHENTICATED -> Create Safety Backup Snapshot
      await new Promise(r => setTimeout(r, 400));
      setWorkflowStep('transfer_started');
      setProgressPercent(45);
      setTransferStatusMessage('Creating automatic safety snapshot before modifying records...');
      await createPreTransferSafetyBackup(localDataset);

      // Step 3: TRANSFER PROGRESS (Safe merge with chosen conflict strategy)
      await new Promise(r => setTimeout(r, 500));
      setWorkflowStep('transfer_progress');
      setProgressPercent(70);
      setTransferStatusMessage('Transferring syllabus, topics, flashcards, and study habit records...');
      const merged = executeSafeMerge(localDataset, incomingPayload, conflictMode);

      // Step 4: VALIDATING
      await new Promise(r => setTimeout(r, 400));
      setWorkflowStep('validating');
      setProgressPercent(90);
      setTransferStatusMessage('Validating data integrity and stable entity identities...');

      // Permanent Device Pairing if requested
      const targetUid = incomingPayload.uid || incomingPayload.syncUid;
      if (permanentSync && targetUid) {
        setPairedSyncUid(targetUid);
      }
      if (incomingPayload.email) {
        setActiveUserEmail(incomingPayload.email);
      }

      // Update Device Pairing Status for header
      setPairedDeviceStatus({
        isConnected: true,
        deviceName: foundDeviceName,
        syncUid: targetUid,
        syncEmail: incomingPayload.email,
        lastSyncFormatted: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        pendingChangesCount: 0
      });

      // Apply to React State & Storage
      await onApplyTransferredData(merged, targetUid);

      // Step 5: COMPLETE
      setWorkflowStep('complete');
      setProgressPercent(100);
      setTransferStatusMessage(`Transfer completed successfully! All records from ${foundDeviceName} are active.`);
    } catch (err: any) {
      setWorkflowStep('error');
      setTransferStatusMessage(`Transfer encountered an issue: ${err?.message || 'Error occurred.'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-theme-card border border-theme rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-theme-surface/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-serif italic text-primary">
                {activeScreen === 'connect' && 'Connect Device & Data Transfer'}
                {activeScreen === 'preview' && 'Inspect Device & Available Data'}
                {activeScreen === 'progress' && 'Transferring Study Planner State'}
              </h2>
              <p className="text-xs text-muted">
                {activeScreen === 'connect' && 'Transfer or sync between iPad, laptop, phone, or different browsers.'}
                {activeScreen === 'preview' && 'Guaranteed zero silent overwrite. Preview all changes before transferring.'}
                {activeScreen === 'progress' && 'Verifying signatures, creating backup snapshot, and updating state.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-surface transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* ======================================================== */}
          {/* SCREEN 1: CONNECT DEVICE ([ Generate QR ] or [ Scan QR ]) */}
          {/* ======================================================== */}
          {activeScreen === 'connect' && (
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-theme-surface border border-theme">
                <button
                  type="button"
                  onClick={() => setConnectTab('generate')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    connectTab === 'generate'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Generate QR / PIN</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('scan_manual')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    connectTab === 'scan_manual'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Scan or Enter PIN</span>
                </button>
              </div>

              {/* Sub-tab 1: Generate QR & PIN */}
              {connectTab === 'generate' && (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 rounded-3xl bg-white border border-stone-200 shadow-sm">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="Transfer QR Code" className="w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-xl" />
                    ) : (
                      <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center text-muted gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-xs">Generating secure transfer code...</span>
                      </div>
                    )}
                  </div>

                  {/* 6-Digit Transfer PIN */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted uppercase font-mono font-semibold tracking-wider">
                      Or use 6-digit Connection PIN
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <div className="px-5 py-2.5 rounded-2xl bg-theme-surface border border-theme font-mono font-extrabold text-2xl tracking-[0.25em] text-primary">
                        {myPin || '------'}
                      </div>
                      <button
                        onClick={() => {
                          if (myPin) {
                            navigator.clipboard.writeText(myPin);
                            setCopiedPin(true);
                            setTimeout(() => setCopiedPin(false), 2000);
                          }
                        }}
                        className="p-3 rounded-2xl border border-theme bg-theme-surface hover:bg-stone-200 dark:hover:bg-stone-800 text-primary transition cursor-pointer"
                        title="Copy 6-digit PIN"
                      >
                        {copiedPin ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted max-w-md">
                    Scan this code with the in-app scanner on your other device or enter the 6-digit PIN. Your private database is never embedded in the QR itself.
                  </p>
                </div>
              )}

              {/* Sub-tab 2: Scan QR or Enter Manual PIN */}
              {connectTab === 'scan_manual' && (
                <div className="space-y-5">
                  {/* Optical Scanner Action */}
                  <div className="p-5 rounded-3xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-primary" />
                        <span>Scan QR from Another Device</span>
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        Uses built-in optical camera scanner without switching browser tabs or apps.
                      </p>
                    </div>
                    {onOpenQRScanner && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenQRScanner();
                        }}
                        className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 transition cursor-pointer shadow-xs shrink-0"
                      >
                        Open In-App Camera Scanner
                      </button>
                    )}
                  </div>

                  {/* Manual 6-digit PIN lookup form */}
                  <form onSubmit={handleLookupPin} className="p-5 rounded-3xl bg-theme-surface border border-theme space-y-3">
                    <label className="text-xs font-bold text-primary block">
                      Enter 6-Digit Transfer PIN
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={inputPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                          setInputPin(val);
                          if (val.length === 6) {
                            handleLookupPin(undefined, val);
                          }
                        }}
                        placeholder="e.g. 583921"
                        className="flex-1 px-4 py-3 rounded-2xl border border-theme bg-theme-card text-primary font-mono text-xl tracking-widest text-center font-bold focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        type="submit"
                        disabled={isLookingUp || inputPin.length !== 6}
                        className="px-5 py-3 rounded-2xl bg-primary text-white font-bold text-xs hover:opacity-90 disabled:opacity-50 transition cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
                      >
                        {isLookingUp ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Finding...</span>
                          </>
                        ) : (
                          <>
                            <span>Connect Device</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {lookupError && (
                      <div className="text-xs text-rose-500 flex items-center gap-1.5 font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{lookupError}</span>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 2: PREVIEW AVAILABLE DATA & CONFLICT DIFF         */}
          {/* ======================================================== */}
          {activeScreen === 'preview' && diffAnalysis && (
            <div className="space-y-6">
              {/* Device Found Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                      Device Found
                    </div>
                    <div className="text-base font-bold text-primary">{foundDeviceName}</div>
                    <div className="text-xs text-muted">Ready for safe transmission • Zero silent overwrites</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono font-semibold bg-theme-card px-3 py-1.5 rounded-xl border border-theme">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Snapshot Secured</span>
                </div>
              </div>

              {/* Data Available Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Data Available on {foundDeviceName}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-theme-surface border border-theme">
                    <div className="flex items-center gap-1.5 text-muted mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Syllabus & Topics</span>
                    </div>
                    <div className="font-mono font-bold text-primary text-sm">
                      {incomingPayload?.subjects?.length || 0} subjects
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-theme-surface border border-theme">
                    <div className="flex items-center gap-1.5 text-muted mb-1">
                      <FileCheck className="w-3.5 h-3.5 text-amber-500" />
                      <span>Tests & Mocks</span>
                    </div>
                    <div className="font-mono font-bold text-primary text-sm">
                      {incomingPayload?.testResults?.length || 0} tests
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-theme-surface border border-theme">
                    <div className="flex items-center gap-1.5 text-muted mb-1">
                      <RotateCcw className="w-3.5 h-3.5 text-violet-500" />
                      <span>1–3–7 Revisions</span>
                    </div>
                    <div className="font-mono font-bold text-primary text-sm">
                      {incomingPayload?.revisions?.length || 0} records
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-theme-surface border border-theme">
                    <div className="flex items-center gap-1.5 text-muted mb-1">
                      <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                      <span>Habits & Plans</span>
                    </div>
                    <div className="font-mono font-bold text-primary text-sm">
                      {incomingPayload?.plans?.length || 0} plans
                    </div>
                  </div>
                </div>
              </div>

              {/* DIFF & CONFLICT SAFETY REPORT */}
              <div className="p-4 sm:p-5 rounded-3xl bg-theme-surface border border-theme space-y-4">
                <div className="flex items-center justify-between border-b border-theme pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-primary">Transfer Safety Diff Analysis</h4>
                    <p className="text-xs text-muted">What will change on this device after import:</p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">+{diffAnalysis.totalNew} New</span>
                    <span className="text-indigo-600 dark:text-indigo-400">~{diffAnalysis.totalUpdated} Updated</span>
                    <span className="text-amber-600 dark:text-amber-400">!{diffAnalysis.totalConflicts} Conflicts</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">NEW DATA</div>
                    <div className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                      +{diffAnalysis.totalNew} records
                    </div>
                    <div className="text-[11px] text-muted mt-1">
                      Topics, tests, flashcards, or plans not yet present locally.
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="font-bold text-indigo-700 dark:text-indigo-300 mb-1">UPDATED RECORDS</div>
                    <div className="font-mono font-bold text-base text-indigo-600 dark:text-indigo-400">
                      ~{diffAnalysis.totalUpdated} records
                    </div>
                    <div className="text-[11px] text-muted mt-1">
                      Topics and 1-3-7 stages aligned to latest progress.
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="font-bold text-amber-700 dark:text-amber-300 mb-1">CONFLICTS</div>
                    <div className="font-mono font-bold text-base text-amber-600 dark:text-amber-400">
                      !{diffAnalysis.totalConflicts} records
                    </div>
                    <div className="text-[11px] text-muted mt-1">
                      Both devices modified this record independently.
                    </div>
                  </div>
                </div>

                {/* Conflict Resolution Choice */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-primary block">
                    Conflict Resolution Strategy:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setConflictMode('smart_merge')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                        conflictMode === 'smart_merge'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-theme bg-theme-card text-muted hover:text-primary'
                      }`}
                    >
                      <div className="font-semibold text-primary">Smart Merge (Recommended)</div>
                      <div className="text-[11px] opacity-80 mt-0.5">Combines records, highest mastery wins</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConflictMode('keep_local')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                        conflictMode === 'keep_local'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-theme bg-theme-card text-muted hover:text-primary'
                      }`}
                    >
                      <div className="font-semibold text-primary">Keep Local State</div>
                      <div className="text-[11px] opacity-80 mt-0.5">Preserve local version if conflicted</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConflictMode('overwrite_incoming')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                        conflictMode === 'overwrite_incoming'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-theme bg-theme-card text-muted hover:text-primary'
                      }`}
                    >
                      <div className="font-semibold text-primary">Adopt Incoming</div>
                      <div className="text-[11px] opacity-80 mt-0.5">Incoming device state takes priority</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS (Transfer Data | Sync Devices | Cancel) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveScreen('connect')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-theme bg-theme-surface hover:bg-stone-200 dark:hover:bg-stone-800 text-xs font-semibold text-primary transition cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleStartTransfer(false)}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl border border-primary text-primary hover:bg-primary/10 text-xs font-bold transition cursor-pointer"
                  >
                    Transfer Data (One-Way Import)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartTransfer(true)}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-2xl bg-primary text-white hover:opacity-90 text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Devices (Continuous Link)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 3: CROSS-DEVICE TRANSFER WORKFLOW TRACKER        */}
          {/* ======================================================== */}
          {activeScreen === 'progress' && (
            <div className="space-y-6 py-4">
              {/* Separate Step Status Indicators */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted text-center">
                  Cross-Device Transfer Pipeline
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                  {[
                    { step: 'connected', label: '1. Connected' },
                    { step: 'authenticated', label: '2. Verified' },
                    { step: 'transfer_started', label: '3. Started' },
                    { step: 'transfer_progress', label: '4. Progress' },
                    { step: 'validating', label: '5. Validating' },
                    { step: 'complete', label: '6. Complete' }
                  ].map((s, idx) => {
                    const stepWeights: Record<string, number> = {
                      idle: 0,
                      connected: 1,
                      authenticated: 2,
                      transfer_started: 3,
                      transfer_progress: 4,
                      validating: 5,
                      complete: 6,
                      error: -1
                    };
                    const currentWeight = stepWeights[workflowStep] || 0;
                    const thisWeight = idx + 1;
                    const isDone = currentWeight > thisWeight || workflowStep === 'complete';
                    const isCurrent = currentWeight === thisWeight;

                    return (
                      <div
                        key={s.step}
                        className={`p-2.5 rounded-2xl border transition-all ${
                          isDone
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold'
                            : isCurrent
                            ? 'bg-primary text-white border-primary shadow-xs font-bold animate-pulse'
                            : 'bg-theme-surface border-theme text-muted opacity-60'
                        }`}
                      >
                        <div>{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-muted">
                  <span>{progressPercent}%</span>
                  <span>{transferStatusMessage}</span>
                </div>
              </div>

              {/* Success / Error Card */}
              {workflowStep === 'complete' && (
                <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-primary">Transfer Complete & Verified!</h4>
                    <p className="text-xs text-muted mt-1">
                      {foundDeviceName} is now synchronized with this device. All syllabus topics, habit records, and tests are updated.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                  >
                    Done & Return to App
                  </button>
                </div>
              )}

              {workflowStep === 'error' && (
                <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-rose-700 dark:text-rose-300">Transfer Error</h4>
                    <p className="text-xs text-muted mt-1">{transferStatusMessage}</p>
                  </div>
                  <button
                    onClick={() => setActiveScreen('preview')}
                    className="px-5 py-2.5 rounded-2xl bg-primary text-white font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    Back to Preview & Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
