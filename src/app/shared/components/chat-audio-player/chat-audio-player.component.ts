import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-chat-audio-player',
  templateUrl: './chat-audio-player.component.html',
  styleUrl: './chat-audio-player.component.css',
})
export class ChatAudioPlayerComponent implements OnInit {
  readonly src = input.required<string>();
  readonly label = input('Voice message');
  readonly compact = input(false);
  readonly showLabel = input(true);

  private readonly destroyRef = inject(DestroyRef);
  private readonly audioRef = viewChild<ElementRef<HTMLAudioElement>>('audio');

  readonly playing = signal(false);
  readonly duration = signal(0);
  readonly currentTime = signal(0);
  readonly ready = signal(false);

  readonly waveform = Array.from({ length: 16 }, (_, i) => {
    const wave = Math.sin(i * 0.55) * 0.35 + Math.cos(i * 0.31) * 0.25;
    return 0.3 + Math.abs(wave) * 0.5;
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      const audio = this.audioRef()?.nativeElement;
      if (audio) {
        audio.pause();
      }
    });
  }

  onLoadedMetadata(): void {
    const audio = this.audioRef()?.nativeElement;
    if (!audio || !Number.isFinite(audio.duration)) {
      return;
    }
    this.duration.set(audio.duration);
    this.ready.set(true);
  }

  onTimeUpdate(): void {
    const audio = this.audioRef()?.nativeElement;
    if (!audio) {
      return;
    }
    this.currentTime.set(audio.currentTime);
  }

  onEnded(): void {
    this.playing.set(false);
    this.currentTime.set(0);
    const audio = this.audioRef()?.nativeElement;
    if (audio) {
      audio.currentTime = 0;
    }
  }

  togglePlay(): void {
    const audio = this.audioRef()?.nativeElement;
    if (!audio) {
      return;
    }
    if (this.playing()) {
      audio.pause();
      this.playing.set(false);
      return;
    }
    audio.play().then(() => this.playing.set(true)).catch(() => this.playing.set(false));
  }

  progressPercent(): number {
    const total = this.duration();
    if (!total) {
      return 0;
    }
    return Math.min(100, (this.currentTime() / total) * 100);
  }

  displayTime(): string {
    const seconds = this.playing() || this.currentTime() > 0
      ? this.currentTime()
      : this.duration();
    return this.formatTime(seconds);
  }

  private formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const whole = Math.floor(seconds);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
