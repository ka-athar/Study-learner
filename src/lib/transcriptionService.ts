// High-Performance Audio Transcription & Cooking Service
// Powered by Gemini AI (gemini-3.5-transcribe / gemini-3.8-flash)
// Handles audio recording, streaming soundwaves, formula formatting, and academic extraction.

export interface TranscriptionContext {
  subject?: string;
  topic?: string;
  chapter?: string;
  question?: string;
  taskType?: 'study_notes' | 'oral_exam' | 'feynman' | 'blurt_recall' | 'general';
}

export interface TranscriptionCookingResult {
  success: boolean;
  rawTranscript: string;
  polishedText: string;
  mathAndScientificFormulas: string[];
  keyConcepts: string[];
  summaryNotes: string[];
  detectedLanguage: string;
  confidenceScore: number;
  academicTakeaways: string;
  cookedAt: string;
  error?: string;
}

/**
 * Transcribe and cook recorded audio with Gemini AI
 */
export async function transcribeAudioWithGemini(
  audioBlob: Blob,
  context?: TranscriptionContext
): Promise<TranscriptionCookingResult> {
  const base64Data = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/webm';

  const res = await fetch('/api/ai/transcribe-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: base64Data,
      mimeType,
      context
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    let parsedMsg = 'Audio transcription service error.';
    try {
      const errJson = JSON.parse(errorText);
      parsedMsg = errJson.error || errJson.message || parsedMsg;
    } catch {}
    throw new Error(parsedMsg);
  }

  const result: TranscriptionCookingResult = await res.json();
  if (!result.success && result.error) {
    throw new Error(result.error);
  }
  return result;
}

/**
 * Utility: Convert Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      // Strip data URL prefix
      const base64 = res.replace(/^data:[^;]+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Audio Recorder Controller with MediaRecorder
 */
export class AudioRecorderController {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isRecording = false;

  async start(): Promise<void> {
    if (this.isRecording) return;
    this.audioChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Setup AudioContext for visualizer
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
      }
    } catch (e) {
      console.warn('AudioContext analyser not initialized:', e);
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // collect chunks every 250ms
    this.isRecording = true;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Recorder is not active'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve(audioBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        this.cleanup();
        reject(err);
      }
      this.isRecording = false;
    });
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  isActive(): boolean {
    return this.isRecording;
  }

  private cleanup() {
    this.isRecording = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
  }
}
