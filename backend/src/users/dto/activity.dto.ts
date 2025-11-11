export interface ActivityLogDto {
  timestamp: string;
  action: string;
  room?: string;
  details?: Record<string, any>;
}

export interface ActivitySummaryDto {
  [action: string]: number;
}
