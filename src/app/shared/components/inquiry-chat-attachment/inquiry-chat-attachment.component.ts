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

@Component({
  selector: 'app-inquiry-chat-attachment',
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
          this.objectUrl.set(URL.createObjectURL(blob));
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
}
