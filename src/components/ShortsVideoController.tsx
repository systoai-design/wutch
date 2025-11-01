import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoSources {
  mp4Url: string;
  hlsUrl?: string | null;
}

interface ActivateOptions {
  muted: boolean;
  startAt?: number;
}

interface VideoSlot {
  element: HTMLElement;
  sources: VideoSources;
}

class ShortsVideoControllerClass {
  private videoElement: HTMLVideoElement;
  private hlsInstance: Hls | null = null;
  private slots = new Map<string, VideoSlot>();
  private activeSlotId: string | null = null;
  private playEventHandler: ((e: Event) => void) | null = null;
  private isDeactivating = false;

  constructor() {
    // Create single video element
    this.videoElement = document.createElement('video');
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.loop = true;
    this.videoElement.className = 'absolute inset-0 w-full h-full object-contain';
    this.videoElement.setAttribute('data-shorts-player', 'true');

    // Setup global play-capture listener as final guard
    this.setupGlobalAudioFence();
  }

  private setupGlobalAudioFence() {
    this.playEventHandler = (e: Event) => {
      const target = e.target as HTMLVideoElement;
      if (!target || target.tagName !== 'VIDEO') return;
      
      // If any other video starts playing (shouldn't happen), force stop it
      if (target !== this.videoElement && target.getAttribute('data-shorts-player') !== 'true') {
        console.warn('[ShortsController] Rogue video detected, stopping:', target);
        target.pause();
        target.muted = true;
        target.currentTime = 0;
      }
    };
    
    document.addEventListener('play', this.playEventHandler, true);
  }

  registerSlot(id: string, element: HTMLElement, sources: VideoSources) {
    console.log('[ShortsController] Register slot:', id);
    this.slots.set(id, { element, sources });
  }

  unregisterSlot(id: string) {
    console.log('[ShortsController] Unregister slot:', id);
    if (this.activeSlotId === id) {
      this.deactivateCurrentSlot();
    }
    this.slots.delete(id);
  }

  async activate(id: string, options: ActivateOptions) {
    // CRITICAL: Silence all videos first
    this.silenceAll();
    
    const slot = this.slots.get(id);
    if (!slot) {
      console.warn('[ShortsController] Slot not found:', id);
      return;
    }

    // CRITICAL: Wait for previous deactivation to complete
    if (this.isDeactivating) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Deactivate previous BEFORE loading new source
    if (this.activeSlotId && this.activeSlotId !== id) {
      console.log('[ShortsController] Deactivate prev:', this.activeSlotId);
      await this.deactivateCurrentSlot();
    }

    console.log('[ShortsController] Activate:', id);
    this.activeSlotId = id;

    // Attach video element to slot
    slot.element.innerHTML = '';
    slot.element.appendChild(this.videoElement);

    // Set mute state
    this.videoElement.muted = options.muted;

    // Load source (HLS if available, otherwise MP4)
    await this.loadSource(slot.sources, options.startAt || 0);

    // Play
    try {
      await this.videoElement.play();
    } catch (error) {
      console.log('[ShortsController] Autoplay prevented:', error);
    }
  }

  private silenceAll() {
    // Emergency silence: force-stop ALL video elements in DOM
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(vid => {
      if (vid !== this.videoElement) {
        vid.pause();
        vid.muted = true;
        vid.currentTime = 0;
      }
    });
  }

  private async deactivateCurrentSlot() {
    if (!this.activeSlotId || this.isDeactivating) return;
    
    this.isDeactivating = true;
    console.log('[ShortsController] Hard release media for:', this.activeSlotId);
    
    // Stop playback IMMEDIATELY
    this.videoElement.pause();
    this.videoElement.muted = true;
    this.videoElement.currentTime = 0;

    // Destroy HLS if active
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    // Release media resource completely
    this.videoElement.removeAttribute('src');
    this.videoElement.load();

    // Small delay to ensure media pipeline fully releases
    await new Promise(resolve => setTimeout(resolve, 10));

    // Remove from DOM
    if (this.videoElement.parentElement) {
      this.videoElement.parentElement.removeChild(this.videoElement);
    }

    this.activeSlotId = null;
    this.isDeactivating = false;
  }

  private async loadSource(sources: VideoSources, startAt: number) {
    // Clear previous source
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    this.videoElement.removeAttribute('src');

    // Load HLS if available and supported
    if (sources.hlsUrl) {
      if (Hls.isSupported()) {
        this.hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        });
        
        this.hlsInstance.loadSource(sources.hlsUrl);
        this.hlsInstance.attachMedia(this.videoElement);
        
        await new Promise<void>((resolve) => {
          this.hlsInstance!.once(Hls.Events.MANIFEST_PARSED, () => resolve());
        });
      } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (iOS Safari)
        this.videoElement.src = sources.hlsUrl;
        await this.videoElement.load();
      } else {
        // Fallback to MP4
        this.videoElement.src = sources.mp4Url;
        await this.videoElement.load();
      }
    } else {
      // Use MP4
      this.videoElement.src = sources.mp4Url;
      await this.videoElement.load();
    }

    // Set start time
    if (startAt > 0) {
      this.videoElement.currentTime = startAt;
    }
  }

  pauseAll() {
    console.log('[ShortsController] Pause all');
    this.videoElement.pause();
    this.videoElement.muted = true;
  }

  setMuted(muted: boolean) {
    this.videoElement.muted = muted;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.activeSlotId ? this.videoElement : null;
  }

  destroy() {
    console.log('[ShortsController] Destroy controller');
    
    // Remove global listener
    if (this.playEventHandler) {
      document.removeEventListener('play', this.playEventHandler, true);
      this.playEventHandler = null;
    }

    // Deactivate and cleanup
    this.deactivateCurrentSlot();
    this.slots.clear();
    
    // Remove video element
    if (this.videoElement.parentElement) {
      this.videoElement.parentElement.removeChild(this.videoElement);
    }
  }
}

interface ShortsVideoControllerContextValue {
  controller: ShortsVideoControllerClass;
}

const ShortsVideoControllerContext = createContext<ShortsVideoControllerContextValue | null>(null);

export function ShortsVideoControllerProvider({ children }: { children: React.ReactNode }) {
  const controllerRef = useRef<ShortsVideoControllerClass | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new ShortsVideoControllerClass();
  }

  useEffect(() => {
    const controller = controllerRef.current!;

    // Pause on tab hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        controller.pauseAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      controller.destroy();
    };
  }, []);

  return (
    <ShortsVideoControllerContext.Provider value={{ controller: controllerRef.current }}>
      {children}
    </ShortsVideoControllerContext.Provider>
  );
}

export function useShortsVideoController() {
  const context = useContext(ShortsVideoControllerContext);
  if (!context) {
    throw new Error('useShortsVideoController must be used within ShortsVideoControllerProvider');
  }
  return context.controller;
}
