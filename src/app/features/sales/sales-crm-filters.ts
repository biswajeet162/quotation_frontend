import { CrmCustomerSummary, crmWorkflowStatus } from '../../core/models/admin-crm.model';

export type SalesCrmQuickFilter =
  | 'all'
  | 'done'
  | 'review'
  | 'emptyContacts'
  | 'filledContacts'
  | 'custom';

export type SalesCrmSortBy =
  | 'serial'
  | 'companyName'
  | 'sector'
  | 'location'
  | 'followUpDate'
  | 'meetingDate'
  | 'lastUpdated'
  | 'coordinator'
  | 'purchaserName'
  | 'purchaserPhone'
  | 'purchaserEmail'
  | 'status';

export interface SalesCrmCustomFilter {
  status: 'NONE' | 'REVIEW' | 'DONE' | null;
  requireFollowUpDate: boolean;
  requireMeetingDate: boolean;
  requireCoordinator: boolean;
  requireAddress: boolean;
  requireRemark: boolean;
  missingFollowUpDate: boolean;
  missingMeetingDate: boolean;
  includeDeleted: boolean;
  sectorQuery: string;
  locationQuery: string;
  coordinatorQuery: string;
}

export interface SalesCrmSortSelection {
  sortBy: SalesCrmSortBy;
  ascending: boolean;
}

export const EMPTY_SALES_CUSTOM_FILTER: SalesCrmCustomFilter = {
  status: null,
  requireFollowUpDate: false,
  requireMeetingDate: false,
  requireCoordinator: false,
  requireAddress: false,
  requireRemark: false,
  missingFollowUpDate: false,
  missingMeetingDate: false,
  includeDeleted: false,
  sectorQuery: '',
  locationQuery: '',
  coordinatorQuery: '',
};

export const DEFAULT_SALES_SORT: SalesCrmSortSelection = {
  sortBy: 'serial',
  ascending: true,
};

export const SALES_SORT_OPTIONS: { value: SalesCrmSortBy; label: string }[] = [
  { value: 'serial', label: 'Serial #' },
  { value: 'companyName', label: 'Company name' },
  { value: 'sector', label: 'Sector' },
  { value: 'location', label: 'Location / address' },
  { value: 'followUpDate', label: 'Follow-up date' },
  { value: 'meetingDate', label: 'Meeting date' },
  { value: 'lastUpdated', label: 'Recently updated' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'purchaserName', label: 'Purchaser name' },
  { value: 'purchaserPhone', label: 'Purchaser contact' },
  { value: 'purchaserEmail', label: 'Purchaser email' },
  { value: 'status', label: 'Status' },
];

export function salesQuickFilterLabel(filter: SalesCrmQuickFilter): string {
  switch (filter) {
    case 'all':
      return 'All';
    case 'done':
      return 'Done';
    case 'review':
      return 'Review';
    case 'emptyContacts':
      return 'Empty';
    case 'filledContacts':
      return 'Filled';
    case 'custom':
      return 'Custom';
  }
}

export function passesSalesQuickFilter(
  row: CrmCustomerSummary,
  filter: SalesCrmQuickFilter,
  custom: SalesCrmCustomFilter,
  requireActiveForPresets = true,
): boolean {
  switch (filter) {
    case 'all':
      return !requireActiveForPresets || row.isActive;
    case 'done':
      return (!requireActiveForPresets || row.isActive) && crmWorkflowStatus(row) === 'DONE';
    case 'review':
      return (!requireActiveForPresets || row.isActive) && crmWorkflowStatus(row) === 'REVIEW';
    case 'emptyContacts':
      return (!requireActiveForPresets || row.isActive) && !row.hasContacts;
    case 'filledContacts':
      return (!requireActiveForPresets || row.isActive) && Boolean(row.hasContacts);
    case 'custom':
      return matchesSalesCustomFilter(row, custom);
  }
}

export function matchesSalesCustomFilter(row: CrmCustomerSummary, custom: SalesCrmCustomFilter): boolean {
  if (!custom.includeDeleted && !row.isActive) return false;
  if (custom.status && crmWorkflowStatus(row) !== custom.status) return false;
  if (custom.requireFollowUpDate && !row.followUpDate?.trim()) return false;
  if (custom.requireMeetingDate && !row.meetingDate?.trim()) return false;
  if (custom.missingFollowUpDate && row.followUpDate?.trim()) return false;
  if (custom.missingMeetingDate && row.meetingDate?.trim()) return false;
  if (custom.requireCoordinator && !row.coordinatorName?.trim()) return false;
  if (custom.requireAddress && !row.location?.trim()) return false;
  if (custom.requireRemark && !row.remark?.trim()) return false;
  const sectorQ = custom.sectorQuery.trim().toLowerCase();
  if (sectorQ && !(row.sector ?? '').toLowerCase().includes(sectorQ)) return false;
  const locationQ = custom.locationQuery.trim().toLowerCase();
  if (locationQ && !(row.location ?? '').toLowerCase().includes(locationQ)) return false;
  const coordinatorQ = custom.coordinatorQuery.trim().toLowerCase();
  if (coordinatorQ && !(row.coordinatorName ?? '').toLowerCase().includes(coordinatorQ)) return false;
  return true;
}

export function compareSalesCrmRows(
  a: CrmCustomerSummary,
  b: CrmCustomerSummary,
  sort: SalesCrmSortSelection,
): number {
  let cmp = 0;
  switch (sort.sortBy) {
    case 'serial':
      cmp = a.serialNumber - b.serialNumber;
      break;
    case 'companyName':
      cmp = a.industryName.toLowerCase().localeCompare(b.industryName.toLowerCase());
      break;
    case 'sector':
      cmp = (a.sector ?? '').toLowerCase().localeCompare((b.sector ?? '').toLowerCase());
      break;
    case 'location':
      cmp = (a.location ?? '').toLowerCase().localeCompare((b.location ?? '').toLowerCase());
      break;
    case 'followUpDate':
      cmp = (a.followUpDate ?? '').localeCompare(b.followUpDate ?? '');
      break;
    case 'meetingDate':
      cmp = (a.meetingDate ?? '').localeCompare(b.meetingDate ?? '');
      break;
    case 'lastUpdated':
      cmp = (a.updatedAt ?? a.createdAt ?? '').localeCompare(b.updatedAt ?? b.createdAt ?? '');
      break;
    case 'coordinator':
      cmp = (a.coordinatorName ?? '').toLowerCase().localeCompare((b.coordinatorName ?? '').toLowerCase());
      break;
    case 'purchaserName':
      cmp = (a.purchaserName ?? '').toLowerCase().localeCompare((b.purchaserName ?? '').toLowerCase());
      break;
    case 'purchaserPhone':
      cmp = (a.purchaserPhone ?? '').localeCompare(b.purchaserPhone ?? '');
      break;
    case 'purchaserEmail':
      cmp = (a.purchaserEmail ?? '').toLowerCase().localeCompare((b.purchaserEmail ?? '').toLowerCase());
      break;
    case 'status':
      cmp = crmWorkflowStatus(a).localeCompare(crmWorkflowStatus(b));
      break;
  }
  if (cmp === 0) cmp = a.serialNumber - b.serialNumber;
  return sort.ascending ? cmp : -cmp;
}

export function formatSalesCrmDate(value?: string | null): string {
  if (!value?.trim()) return '—';
  const raw = value.trim();
  const datePart = raw.includes('T') ? raw.slice(0, 10) : raw;
  const parsed = new Date(raw.includes('T') ? raw : `${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    const parts = datePart.split('-');
    if (parts.length >= 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return raw;
  }
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatSalesCrmDateTime(value?: string | null): string {
  if (!value?.trim()) return '—';
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return formatSalesCrmDate(value);
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  let hours = parsed.getHours();
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${dd}-${mm}-${yyyy}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}
