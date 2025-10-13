/**
 * Date formatting utilities
 *
 * Provides consistent date and time formatting throughout the application.
 */

/**
 * Format ISO date string to localized date string.
 *
 * @param date - ISO date string (e.g., "2025-10-05T12:00:00Z")
 * @returns Formatted date string (e.g., "Oct 5, 2025")
 *
 * @example
 * formatDate("2025-10-05T12:00:00Z") // "Oct 5, 2025"
 */
export function formatDate(date: string): string {
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Failed to format date:', error);
    return 'Invalid date';
  }
}

/**
 * Format ISO date string to relative time string.
 *
 * @param date - ISO date string
 * @returns Relative time string (e.g., "2 hours ago", "3 days ago")
 *
 * @example
 * formatRelativeTime("2025-10-05T10:00:00Z") // "2 hours ago"
 */
export function formatRelativeTime(date: string): string {
  try {
    const dateObj = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    } else {
      return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
    }
  } catch (error) {
    console.error('Failed to format relative time:', error);
    return 'Invalid date';
  }
}

/**
 * Format ISO date string to localized date and time string.
 *
 * @param date - ISO date string
 * @returns Formatted date and time string (e.g., "Oct 5, 2025, 12:00 PM")
 *
 * @example
 * formatDateTime("2025-10-05T12:00:00Z") // "Oct 5, 2025, 12:00 PM"
 */
export function formatDateTime(date: string): string {
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Failed to format date time:', error);
    return 'Invalid date';
  }
}
