import {
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InquiryTimelineAttachment } from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { ChatAudioPlayerComponent } from '../chat-audio-player/chat-audio-player.component';

@Component({
  selector: 'app-inquiry-chat-attachment',
  imports: [ChatAudioPlayerComponent],
  templateUrl: './inquiry-chat-attachment.component.html',
  styleUrl: './inquiry-chat-attachment.component.css',
})
export class InquiryChatAttachmentComponent implements OnInit {
  readonly attachment = input.required<InquiryTimelineAttachment>();

  private readonly inquiryService = inject(InquiryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly objectUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.inquiryService
      .fetchAttachmentBlob(this.attachment().url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const typedBlob = blob.type
            ? blob
            : new Blob([blob], { type: this.attachment().contentType || 'application/octet-stream' });
          this.objectUrl.set(URL.createObjectURL(typedBlob));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });

    this.destroyRef.onDestroy(() => {
      const url = this.objectUrl();
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
  }

  attachmentLabel(): string {
    const name = this.attachment().fileName ?? '';
    if (/^voice-/i.test(name)) {
      return 'Voice message';
    }
    return name;
  }
}
