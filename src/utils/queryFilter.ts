import { TaskItem } from '../types';

/**
 * A parsed filter rule derived from one line of a custom query string.
 * The syntax mirrors a subset of the Obsidian Tasks community plugin so
 * users familiar with that plugin can reuse their knowledge.
 *
 * Supported rules (case-insensitive, one per line):
 *   not done
 *   done
 *   due before YYYY-MM-DD
 *   due after  YYYY-MM-DD
 *   due on     YYYY-MM-DD
 *   path includes <text>
 *   path does not include <text>
 *   description includes <text>
 *   description does not include <text>
 *   tag includes <tag>
 *   tag does not include <tag>
 *   priority is   highest | high | medium | low | lowest | none
 *   priority above highest | high | medium | low | lowest | none
 *   priority below highest | high | medium | low | lowest | none
 *   limit to <N> tasks
 *   sort by priority | due | description
 *
 * Lines starting with # are treated as comments.
 * Blank lines are ignored.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type FilterFn = (task: TaskItem) => boolean;

export interface ParsedQuery {
	filters: FilterFn[];
	limit: number | null;
	sortBy: SortField | null;
}

export type SortField = 'priority' | 'due' | 'description';

// ── Priority helpers ───────────────────────────────────────────────────────────

const PRIORITY_NAMES: Record<string, number> = {
	highest: 1,
	high: 2,
	medium: 3,
	low: 4,
	lowest: 5,
	none: 999,
};

function resolvePriority(name: string): number | undefined {
	return PRIORITY_NAMES[name.toLowerCase()];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses YYYY-MM-DD to local midnight Date, or returns null. */
function parseLocalDate(raw: string): Date | null {
	if (!ISO_DATE_RE.test(raw)) return null;
	const d = new Date(`${raw}T00:00:00`);
	return isNaN(d.getTime()) ? null : d;
}

/** Returns the date portion (midnight local) of a Date. */
function dayStart(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parses a multi-line custom query string into an executable ParsedQuery.
 * Unknown or malformed lines are silently ignored so a partial query
 * still works.
 */
export function parseQuery(raw: string): ParsedQuery {
	const result: ParsedQuery = { filters: [], limit: null, sortBy: null };

	for (const rawLine of raw.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const lower = line.toLowerCase();

		// ── Status ──────────────────────────────────────────────────────────
		if (lower === 'not done') {
			result.filters.push((t) => !t.completed);
			continue;
		}
		if (lower === 'done') {
			result.filters.push((t) => t.completed);
			continue;
		}

		// ── Due date ────────────────────────────────────────────────────────
		const dueMatch = lower.match(/^due\s+(before|after|on)\s+(.+)$/);
		if (dueMatch) {
			const op = dueMatch[1] as string;
			const dateStr = (dueMatch[2] as string).trim();
			const target = parseLocalDate(dateStr);
			if (target) {
				const targetDay = dayStart(target);
				if (op === 'before') {
					result.filters.push((t) =>
						t.dueDate !== undefined && dayStart(t.dueDate) < targetDay
					);
				} else if (op === 'after') {
					result.filters.push((t) =>
						t.dueDate !== undefined && dayStart(t.dueDate) > targetDay
					);
				} else {
					result.filters.push((t) =>
						t.dueDate !== undefined && dayStart(t.dueDate) === targetDay
					);
				}
			}
			continue;
		}

		// ── Path ────────────────────────────────────────────────────────────
		const pathIncMatch = lower.match(/^path\s+includes\s+(.+)$/);
		if (pathIncMatch) {
			const needle = (pathIncMatch[1] as string).trim().toLowerCase();
			result.filters.push((t) => t.filePath.toLowerCase().includes(needle));
			continue;
		}
		const pathExcMatch = lower.match(/^path\s+does\s+not\s+include\s+(.+)$/);
		if (pathExcMatch) {
			const needle = (pathExcMatch[1] as string).trim().toLowerCase();
			result.filters.push((t) => !t.filePath.toLowerCase().includes(needle));
			continue;
		}

		// ── Description ─────────────────────────────────────────────────────
		const descIncMatch = lower.match(/^description\s+includes\s+(.+)$/);
		if (descIncMatch) {
			const needle = (descIncMatch[1] as string).trim().toLowerCase();
			result.filters.push((t) => t.title.toLowerCase().includes(needle));
			continue;
		}
		const descExcMatch = lower.match(/^description\s+does\s+not\s+include\s+(.+)$/);
		if (descExcMatch) {
			const needle = (descExcMatch[1] as string).trim().toLowerCase();
			result.filters.push((t) => !t.title.toLowerCase().includes(needle));
			continue;
		}

		// ── Tag ─────────────────────────────────────────────────────────────
		const tagIncMatch = lower.match(/^tags?\s+includes?\s+(.+)$/);
		if (tagIncMatch) {
			const tag = (tagIncMatch[1] as string).trim().toLowerCase();
			result.filters.push((t) =>
				t.tags.some((tg) => tg.toLowerCase() === tag)
			);
			continue;
		}
		const tagExcMatch = lower.match(/^tags?\s+does\s+not\s+includes?\s+(.+)$/);
		if (tagExcMatch) {
			const tag = (tagExcMatch[1] as string).trim().toLowerCase();
			result.filters.push((t) =>
				!t.tags.some((tg) => tg.toLowerCase() === tag)
			);
			continue;
		}

		// ── Priority ────────────────────────────────────────────────────────
		const prioMatch = lower.match(/^priority\s+(is|above|below)\s+(.+)$/);
		if (prioMatch) {
			const op = prioMatch[1] as string;
			const level = resolvePriority((prioMatch[2] as string).trim());
			if (level !== undefined) {
				if (op === 'is') {
					result.filters.push((t) => (t.priority ?? 999) === level);
				} else if (op === 'above') {
					// "above high" means priority number < high's number (lower = higher priority)
					result.filters.push((t) => (t.priority ?? 999) < level);
				} else {
					result.filters.push((t) => (t.priority ?? 999) > level);
				}
			}
			continue;
		}

		// ── Limit ───────────────────────────────────────────────────────────
		const limitMatch = lower.match(/^limit\s+to\s+(\d+)\s+tasks?$/);
		if (limitMatch) {
			const n = parseInt(limitMatch[1] as string, 10);
			if (n > 0) result.limit = n;
			continue;
		}

		// ── Sort ────────────────────────────────────────────────────────────
		const sortMatch = lower.match(/^sort\s+by\s+(priority|due|description)$/);
		if (sortMatch) {
			result.sortBy = (sortMatch[1] as string) as SortField;
			continue;
		}

		// Unknown line — silently ignored
	}

	return result;
}

// ── Executor ───────────────────────────────────────────────────────────────────

/**
 * Applies a parsed query to a list of tasks, returning the filtered,
 * sorted, and optionally limited result.
 */
export function applyQuery(tasks: TaskItem[], query: ParsedQuery): TaskItem[] {
	let result = tasks;

	// Apply all filter predicates (AND logic)
	for (const fn of query.filters) {
		result = result.filter(fn);
	}

	// Sort
	if (query.sortBy) {
		result = [...result].sort((a, b) => {
			switch (query.sortBy) {
				case 'priority': {
					const pa = a.priority ?? 999;
					const pb = b.priority ?? 999;
					return pa - pb;
				}
				case 'due': {
					const da = a.dueDate?.getTime() ?? Infinity;
					const db = b.dueDate?.getTime() ?? Infinity;
					return da - db;
				}
				case 'description':
					return a.title.localeCompare(b.title);
				default:
					return 0;
			}
		});
	}

	// Limit
	if (query.limit !== null && query.limit > 0) {
		result = result.slice(0, query.limit);
	}

	return result;
}
