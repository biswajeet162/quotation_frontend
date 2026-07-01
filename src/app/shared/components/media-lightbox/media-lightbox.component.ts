import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  OnInit,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { teleportElementToBody } from '../../utils/teleport-to-body.util';

@Component({
  selector: 'app-media-lightbox',
  templateUrl: './media-lightbox.component.html',
  styleUrl: './media-lightbox.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class MediaLightboxComponent implements OnInit {
  readonly objectUrl = input.required<string>();
  readonly fileName = input.required<string>();
  readonly mediaType = input.required<'IMAGE' | 'VIDEO'>();

  readonly closed = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    teleportElementToBody(this.host.nativeElement, this.destroyRef);
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
