/**
 * Picture-in-Picture (PiP) Floating Study Timer Service
 * Enables native OS-level Picture-in-Picture windows that float on top of
 * any app (PDF readers, YouTube lectures, Word, notes, or external monitors).
 */

import { getPersistedTimer, GlobalTimerSession, pauseGlobalTimerSession, resumeGlobalTimerSession, addMinutesToGlobalTimer } from './globalTimerService';

class PipTimerController {
  private pipWindow: Window | null = null;
  private hiddenVideo: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private animFrameId: number | null = null;
  private isPipActive: boolean = false;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasDocPip = 'documentPictureInPicture' in window;
    const hasVideoPip = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
    return Boolean(hasDocPip || hasVideoPip);
  }

  public isActive(): boolean {
    return this.isPipActive;
  }

  /**
   * Launch native Picture-in-Picture window
   */
  public async togglePip(): Promise<boolean> {
    if (this.isPipActive) {
      this.closePip();
      return false;
    }
    return this.openPip();
  }

  public async openPip(): Promise<boolean> {
    try {
      // 1. Try Document Picture-in-Picture first (Chrome 116+, modern Edge)
      if ('documentPictureInPicture' in window && (window as any).documentPictureInPicture?.requestWindow) {
        return await this.openDocumentPip();
      }

      // 2. Fallback to HTML5 Canvas Video Stream PiP (Universal browser support)
      return await this.openCanvasVideoPip();
    } catch (err) {
      console.warn('[PipTimerController] Failed to open PiP:', err);
      return false;
    }
  }

  private async openDocumentPip(): Promise<boolean> {
    try {
      const docPipApi = (window as any).documentPictureInPicture;
      const pipWin = await docPipApi.requestWindow({
        width: 340,
        height: 220,
      });

      this.pipWindow = pipWin;
      this.isPipActive = true;

      // Copy essential styling
      pipWin.document.head.innerHTML = `
        <title>⏱️ Study Sprint PiP</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
          body { background: #1C1D1A; color: #FAF8F5; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; padding: 16px; user-select: none; }
          .badge { font-size: 11px; font-weight: 700; color: #DDA15E; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
          .topic { font-size: 13px; font-weight: 600; color: #E8E6DF; max-width: 290px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; margin-bottom: 12px; }
          .time { font-size: 42px; font-weight: 900; font-family: monospace; letter-spacing: 2px; color: #FAF8F5; line-height: 1; margin-bottom: 14px; }
          .time.urgent { color: #F87171; animation: pulse 1s infinite; }
          .controls { display: flex; gap: 8px; width: 100%; justify-content: center; }
          button { background: #282925; border: 1px solid #444; color: #FFF; padding: 7px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
          button:hover { background: #383A35; }
          button.primary { background: #6B705C; border-color: #A5A58D; }
          button.primary:hover { background: #585C4B; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        </style>
      `;

      const renderDocPipContent = () => {
        if (!pipWin || pipWin.closed) {
          this.closePip();
          return;
        }

        const t = getPersistedTimer();
        const seconds = t?.secondsLeft ?? 1500;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        const isRunning = t?.isRunning && !t?.isPaused;
        const isUrgent = seconds <= 120 && seconds > 0;

        pipWin.document.body.innerHTML = `
          <div class="badge">${t?.subjectName || 'Study Sprint'}</div>
          <div class="topic">${t?.topicName || 'Deep Work Focus'}</div>
          <div class="time ${isUrgent ? 'urgent' : ''}">${formatted}</div>
          <div class="controls">
            <button id="pip-toggle" class="primary">${isRunning ? '⏸️ Pause' : '▶️ Resume'}</button>
            <button id="pip-add5">+5m</button>
          </div>
        `;

        const btnToggle = pipWin.document.getElementById('pip-toggle');
        const btnAdd5 = pipWin.document.getElementById('pip-add5');

        if (btnToggle) {
          btnToggle.onclick = () => {
            if (isRunning) {
              pauseGlobalTimerSession();
            } else {
              resumeGlobalTimerSession();
            }
            renderDocPipContent();
          };
        }

        if (btnAdd5) {
          btnAdd5.onclick = () => {
            addMinutesToGlobalTimer(5);
            renderDocPipContent();
          };
        }
      };

      renderDocPipContent();
      const interval = setInterval(renderDocPipContent, 1000);

      pipWin.addEventListener('pagehide', () => {
        clearInterval(interval);
        this.closePip();
      });

      window.dispatchEvent(new CustomEvent('studyplanner:pip-change', { detail: { active: true } }));
      return true;
    } catch (e) {
      console.warn('Document PiP request failed, falling back to canvas:', e);
      return this.openCanvasVideoPip();
    }
  }

  private async openCanvasVideoPip(): Promise<boolean> {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 360;
      this.canvas.height = 240;
    }

    if (!this.hiddenVideo) {
      this.hiddenVideo = document.createElement('video');
      this.hiddenVideo.muted = true;
      this.hiddenVideo.autoplay = true;
      this.hiddenVideo.playsInline = true;
      this.hiddenVideo.style.position = 'fixed';
      this.hiddenVideo.style.top = '-9999px';
      this.hiddenVideo.style.left = '-9999px';
      this.hiddenVideo.style.opacity = '0';
      this.hiddenVideo.style.pointerEvents = 'none';
      document.body.appendChild(this.hiddenVideo);
    }

    const stream = this.canvas.captureStream(30);
    this.hiddenVideo.srcObject = stream;
    await this.hiddenVideo.play();

    this.startCanvasRenderLoop();

    const videoPip = await this.hiddenVideo.requestPictureInPicture();
    this.isPipActive = true;

    videoPip.addEventListener('leavepictureinpicture', () => {
      this.closePip();
    });

    window.dispatchEvent(new CustomEvent('studyplanner:pip-change', { detail: { active: true } }));
    return true;
  }

  private startCanvasRenderLoop(): void {
    const render = () => {
      if (!this.isPipActive || !this.canvas) return;
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;

      const t = getPersistedTimer();
      const seconds = t?.secondsLeft ?? 1500;
      const targetSec = t?.targetSeconds ?? 1500;
      const progress = targetSec > 0 ? (1 - seconds / targetSec) : 0;

      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // Background
      ctx.fillStyle = '#1C1D1A';
      ctx.fillRect(0, 0, 360, 240);

      // Accent border
      ctx.strokeStyle = '#3A3C36';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 352, 232);

      // Progress bar at top
      ctx.fillStyle = '#3A3C36';
      ctx.fillRect(20, 20, 320, 6);
      ctx.fillStyle = seconds <= 120 ? '#EF4444' : '#6B705C';
      ctx.fillRect(20, 20, Math.min(320, 320 * progress), 6);

      // Subject badge
      ctx.fillStyle = '#DDA15E';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((t?.subjectName || 'STUDY SPRINT').toUpperCase(), 180, 56);

      // Topic title
      ctx.fillStyle = '#E8E6DF';
      ctx.font = '600 15px system-ui, sans-serif';
      const topic = t?.topicName || 'Deep Work Focus';
      const truncatedTopic = topic.length > 28 ? topic.substring(0, 26) + '...' : topic;
      ctx.fillText(truncatedTopic, 180, 84);

      // Large Timer
      ctx.fillStyle = seconds <= 120 ? '#EF4444' : '#FAF8F5';
      ctx.font = 'bold 54px monospace';
      ctx.fillText(formatted, 180, 155);

      // Status subtitle
      ctx.fillStyle = '#A5A58D';
      ctx.font = '12px system-ui, sans-serif';
      const statusText = t?.isPaused ? '⏸️ PAUSED' : t?.isRunning ? '🟢 FOCUSING' : 'READY';
      ctx.fillText(statusText, 180, 195);

      this.animFrameId = requestAnimationFrame(render);
    };

    render();
  }

  public closePip(): void {
    this.isPipActive = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.pipWindow && !this.pipWindow.closed) {
      try {
        this.pipWindow.close();
      } catch (e) {}
      this.pipWindow = null;
    }

    if (document.pictureInPictureElement) {
      try {
        document.exitPictureInPicture();
      } catch (e) {}
    }

    if (this.hiddenVideo) {
      try {
        this.hiddenVideo.pause();
        this.hiddenVideo.srcObject = null;
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('studyplanner:pip-change', { detail: { active: false } }));
  }
}

export const pipTimer = new PipTimerController();
