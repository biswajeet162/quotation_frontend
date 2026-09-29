import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../../constants/storage.constants';
import { AuthService } from '../auth/auth.service';
import { AdminCrmService } from '../admin/admin-crm.service';

/** customerId → ISO timestamp of last local open/edit for this salesperson. */
export type CrmRecentOpenedMap = Record<string, string>;

const MAX_TRACKED = 200;

/**
 * User-specific CRM “float to top” ranking via localStorage.
 * No backend call on each open — hourly batch sync shares activity with other sales users.
 */
@Injectable({ providedIn: 'root' })
export class CrmRecentOpenedService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly crmApi = inject(AdminCrmService);

  /** Bumps whenever local map changes so list computeds re-sort. */
  readonly revision = signal(0);

  private hourTimer: ReturnType<typeof setTimeout> | null = null;
  private hourInterval: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  constructor() {
    this.scheduleHourlySync();
  }

  ngOnDestroy(): void {
    if (this.hourTimer) clearTimeout(this.hourTimer);
    if (this.hourInterval) clearInterval(this.hourInterval);
  }

  /** Record that this salesperson opened/changed a CRM row (local only). */
  touch(customerId: string): void {
    const id = customerId?.trim();
    if (!id) return;
    const map = this.readMap();
    map[id] = new Date().toISOString();
    this.writeMap(this.trimMap(map));
    this.revision.update((n) => n + 1);
  }

  /** Effective open time for sorting: newer of local bump vs server lastOpenedAt. */
  effectiveOpenedAt(customerId: string, serverLastOpenedAt?: string | null): string {
    const local = this.readMap()[customerId] ?? '';
    const server = serverLastOpenedAt?.trim() ?? '';
    if (!local) return server;
    if (!server) return local;
    return local >= server ? local : server;
  }

  /** Push local opens to backend (called on the hour). */
  syncNow(): void {
    if (this.syncing) return;
    const user = this.auth.currentUser();
    if (!user?.userId) return;

    const map = this.readMap();
    const payload = {
      opens: Object.entries(map).map(([customerId, openedAt]) => ({
        customerId,
        openedAt: this.toLocalDateTimePayload(openedAt),
      })),
    };
    if (payload.opens.length === 0) return;

    this.syncing = true;
    this.crmApi.syncOpenedBatch(payload).subscribe({
      next: () => {
        this.syncing = false;
      },
      error: () => {
        this.syncing = false;
      },
    });
  }

  private toLocalDateTimePayload(iso: string): string {
    // "2026-03-29T14:05:00.123Z" → "2026-03-29T14:05:00" (UTC wall clock for simplicity)
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }

  private scheduleHourlySync(): void {
    const msUntilNextHour = () => {
      const now = new Date();
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next.getTime() - now.getTime();
    };

    this.hourTimer = setTimeout(() => {
      this.syncNow();
      this.hourInterval = setInterval(() => this.syncNow(), 60 * 60 * 1000);
    }, msUntilNextHour());
  }

  private storageKey(): string | null {
    const userId = this.auth.currentUser()?.userId;
    if (!userId) return null;
    return `${STORAGE_KEYS.crmRecentOpenedPrefix}${userId}`;
  }

  private readMap(): CrmRecentOpenedMap {
    const key = this.storageKey();
    if (!key) return {};
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as CrmRecentOpenedMap;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeMap(map: CrmRecentOpenedMap): void {
    const key = this.storageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(map));
    } catch {
      // quota / private mode — ignore
    }
  }

  private trimMap(map: CrmRecentOpenedMap): CrmRecentOpenedMap {
    const entries = Object.entries(map).sort((a, b) => b[1].localeCompare(a[1]));
    if (entries.length <= MAX_TRACKED) return map;
    return Object.fromEntries(entries.slice(0, MAX_TRACKED));
  }
}
