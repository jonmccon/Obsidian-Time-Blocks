import { describe, it, expect } from 'vitest';
import { parseICS } from '../src/utils/icsParser';

/** Helper to build a minimal valid ICS feed around VEVENT blocks. */
function wrapICS(...vevents: string[]): string {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Test//Test//EN',
		...vevents,
		'END:VCALENDAR',
	].join('\r\n');
}

describe('parseICS', () => {
	it('parses a basic event with UTC datetimes', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:abc123@google.com',
			'SUMMARY:Team standup',
			'DTSTART:20250611T090000Z',
			'DTEND:20250611T093000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		expect(events[0]?.title).toBe('Team standup');
		expect(events[0]?.id).toBe('abc123@google.com');
		expect(events[0]?.isAllDay).toBe(false);
		expect(events[0]?.start.toISOString()).toBe('2025-06-11T09:00:00.000Z');
		expect(events[0]?.end.toISOString()).toBe('2025-06-11T09:30:00.000Z');
	});

	it('parses an all-day event (VALUE=DATE)', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:allday1@google.com',
			'SUMMARY:All day event',
			'DTSTART;VALUE=DATE:20250615',
			'DTEND;VALUE=DATE:20250616',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		expect(events[0]?.isAllDay).toBe(true);
		expect(events[0]?.start.getFullYear()).toBe(2025);
		expect(events[0]?.start.getMonth()).toBe(5); // June
		expect(events[0]?.start.getDate()).toBe(15);
	});

	it('parses floating (local) datetimes', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:local1@test.com',
			'SUMMARY:Local event',
			'DTSTART:20250611T140000',
			'DTEND:20250611T150000',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		expect(events[0]?.start.getHours()).toBe(14);
		expect(events[0]?.end.getHours()).toBe(15);
	});

	it('handles events with description and location', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:detailed1@test.com',
			'SUMMARY:Meeting',
			'DESCRIPTION:Discuss roadmap',
			'LOCATION:Room 42',
			'DTSTART:20250611T100000Z',
			'DTEND:20250611T110000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		expect(events[0]?.description).toBe('Discuss roadmap');
		expect(events[0]?.location).toBe('Room 42');
	});

	it('decodes ICS text escapes', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:esc1@test.com',
			'SUMMARY:Commas\\, semicolons\\; and newlines\\n',
			'DTSTART:20250611T100000Z',
			'DTEND:20250611T110000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events[0]?.title).toBe('Commas, semicolons; and newlines\n');
	});

	it('handles line folding (continuation lines)', () => {
		const ics = [
			'BEGIN:VCALENDAR',
			'BEGIN:VEVENT',
			'UID:fold1@test.com',
			'SUMMARY:A very long event title that is fol',
			' ded across multiple lines',
			'DTSTART:20250611T100000Z',
			'DTEND:20250611T110000Z',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n');

		const events = parseICS(ics);
		expect(events[0]?.title).toBe('A very long event title that is folded across multiple lines');
	});

	it('parses multiple events', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:multi1@test.com',
			'SUMMARY:Event 1',
			'DTSTART:20250611T090000Z',
			'DTEND:20250611T100000Z',
			'END:VEVENT',
			'BEGIN:VEVENT',
			'UID:multi2@test.com',
			'SUMMARY:Event 2',
			'DTSTART:20250612T140000Z',
			'DTEND:20250612T150000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(2);
		expect(events[0]?.title).toBe('Event 1');
		expect(events[1]?.title).toBe('Event 2');
	});

	it('skips events without UID', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'SUMMARY:No UID',
			'DTSTART:20250611T090000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(0);
	});

	it('skips events without DTSTART', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:nostart@test.com',
			'SUMMARY:No start',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(0);
	});

	it('defaults to "(No title)" when SUMMARY is missing', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:notitle@test.com',
			'DTSTART:20250611T090000Z',
			'DTEND:20250611T100000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events[0]?.title).toBe('(No title)');
	});

	it('defaults end to start + 1 hour for timed events without DTEND', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:noend@test.com',
			'SUMMARY:No end',
			'DTSTART:20250611T090000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		expect(events[0]?.start.toISOString()).toBe('2025-06-11T09:00:00.000Z');
		expect(events[0]?.end.toISOString()).toBe('2025-06-11T10:00:00.000Z');
	});

	it('defaults end to start + 1 day for all-day events without DTEND', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:noendallday@test.com',
			'SUMMARY:All day no end',
			'DTSTART;VALUE=DATE:20250615',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		expect(events[0]?.start.getDate()).toBe(15);
		expect(events[0]?.end.getDate()).toBe(16);
	});

	it('handles empty input', () => {
		expect(parseICS('')).toEqual([]);
	});

	it('handles input with no VEVENT blocks', () => {
		const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
		expect(parseICS(ics)).toEqual([]);
	});

	it('handles DTSTART with TZID parameter', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:tzid1@test.com',
			'SUMMARY:TZ event',
			'DTSTART;TZID=America/New_York:20250611T090000',
			'DTEND;TZID=America/New_York:20250611T100000',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events).toHaveLength(1);
		// TZID events are treated as local time (known limitation)
		expect(events[0]?.start.getHours()).toBe(9);
	});

	it('handles values containing colons', () => {
		const ics = wrapICS(
			'BEGIN:VEVENT',
			'UID:colon1@test.com',
			'SUMMARY:Meeting: Topic',
			'DTSTART:20250611T090000Z',
			'DTEND:20250611T100000Z',
			'END:VEVENT',
		);

		const events = parseICS(ics);
		expect(events[0]?.title).toBe('Meeting: Topic');
	});
});
