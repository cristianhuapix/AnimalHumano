/**
 * Date utility functions for consistent date formatting across the app
 */

/**
 * Formats a date string to dd/MM/yyyy format
 * Handles dates without timezone conversion to avoid day offset issues
 * @param dateString - Date string in ISO format (YYYY-MM-DD)
 * @returns Formatted date string in dd/MM/yyyy format
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';

  // Split the date string to avoid timezone conversion issues
  const [year, month, day] = dateString.split('T')[0].split('-');

  // Pad day and month with leading zeros if needed
  const paddedDay = day.padStart(2, '0');
  const paddedMonth = month.padStart(2, '0');

  return `${paddedDay}/${paddedMonth}/${year}`;
}

/**
 * Parses a date in dd/MM/yyyy format to ISO format (YYYY-MM-DD)
 * @param dateString - Date string in dd/MM/yyyy format
 * @returns Date string in ISO format (YYYY-MM-DD)
 */
export function parseDate(dateString: string): string {
  if (!dateString) return '';

  const [day, month, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Gets today's date in ISO format (YYYY-MM-DD)
 * @returns Today's date in ISO format
 */
export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
