import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PublicImageSet } from '../../models/public-image.model';

@Injectable({ providedIn: 'root' })
export class PublicImageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/public/images`;

  getImageSet(imageId: string): Observable<PublicImageSet> {
    return this.http.get<PublicImageSet>(`${this.baseUrl}/${imageId}`);
  }

  contentAbsoluteUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    return `${environment.apiUrl}${relativeUrl}`;
  }
}
