export function getWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export function getDatesFromWeekString(weekStr: string): { start: string; end: string } {
  const [yearStr, weekNoStr] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekNoStr, 10);

  const d = new Date(Date.UTC(year, 0, 1));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekStart = new Date(yearStart.getTime() + (week - 1) * 7 * 86400000);

  const monday = new Date(weekStart.getTime() - 3 * 86400000);
  const sunday = new Date(weekStart.getTime() + 3 * 86400000);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

export function getPreviousWeekString(weekStr: string): string {
  const dates = getDatesFromWeekString(weekStr);
  const date = new Date(dates.start);
  date.setDate(date.getDate() - 7);
  return getWeekString(date);
}

export function getNextWeekString(weekStr: string): string {
  const dates = getDatesFromWeekString(weekStr);
  const date = new Date(dates.start);
  date.setDate(date.getDate() + 7);
  return getWeekString(date);
}

export interface PastWeekOption {
  value: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export function getPastWeeks(count: number = 12): PastWeekOption[] {
  const weeks: PastWeekOption[] = [];
  let currentWeekStr = getWeekString(new Date());

  for (let i = 0; i < count; i++) {
    const dates = getDatesFromWeekString(currentWeekStr);
    const start = new Date(dates.start);
    const end = new Date(dates.end);

    weeks.push({
      value: currentWeekStr,
      label: `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
      startDate: dates.start,
      endDate: dates.end,
      isCurrent: i === 0,
    });

    currentWeekStr = getPreviousWeekString(currentWeekStr);
  }

  return weeks;
}
