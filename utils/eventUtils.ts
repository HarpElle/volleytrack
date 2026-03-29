import { Event } from '../types';

export type EventGroup = 'now' | 'upcoming' | 'recent' | 'past';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getEventGroup(event: Event, now: number = Date.now()): EventGroup {
  const start = event.startDate;
  const end = event.endDate ?? start + DAY_MS;

  if (now >= start && now <= end) return 'now';
  if (start > now && start <= now + 14 * DAY_MS) return 'upcoming';
  if (end < now && end >= now - 7 * DAY_MS) return 'recent';
  return 'past';
}

export interface EventSection {
  title: string;
  key: EventGroup;
  data: Event[];
}

export function groupEvents(events: Event[]): EventSection[] {
  const now = Date.now();
  const groups: Record<EventGroup, Event[]> = { now: [], upcoming: [], recent: [], past: [] };

  const sorted = [...events].sort((a, b) => b.startDate - a.startDate);

  for (const event of sorted) {
    groups[getEventGroup(event, now)].push(event);
  }

  const sections: EventSection[] = [];
  if (groups.now.length)      sections.push({ title: 'Happening Now', key: 'now',      data: groups.now });
  if (groups.upcoming.length) sections.push({ title: 'Upcoming',       key: 'upcoming', data: groups.upcoming });
  if (groups.recent.length)   sections.push({ title: 'Recent',         key: 'recent',   data: groups.recent });
  if (groups.past.length)     sections.push({ title: 'Past',           key: 'past',     data: groups.past });

  return sections;
}
