import { describe, it, expect } from 'vitest';
import { parseQuery, applyQuery } from '../src/utils/queryFilter';
import { TaskItem } from '../src/types';

/** Helper to create a minimal TaskItem with overrides. */
function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
	return {
		id: 'file.md:1',
		title: 'Test task',
		filePath: 'folder/file.md',
		lineNumber: 1,
		completed: false,
		tags: [],
		rawText: '- [ ] Test task',
		...overrides,
	};
}

describe('parseQuery', () => {
	it('parses an empty string', () => {
		const q = parseQuery('');
		expect(q.filters).toHaveLength(0);
		expect(q.limit).toBeNull();
		expect(q.sortBy).toBeNull();
	});

	it('ignores blank lines and comments', () => {
		const q = parseQuery('# This is a comment\n\n   \n# Another comment');
		expect(q.filters).toHaveLength(0);
	});

	it('parses "not done"', () => {
		const q = parseQuery('not done');
		expect(q.filters).toHaveLength(1);
	});

	it('parses "done"', () => {
		const q = parseQuery('done');
		expect(q.filters).toHaveLength(1);
	});

	it('parses due date filters', () => {
		const q = parseQuery('due before 2025-06-01\ndue after 2025-01-01\ndue on 2025-03-15');
		expect(q.filters).toHaveLength(3);
	});

	it('parses path includes/excludes', () => {
		const q = parseQuery('path includes projects/\npath does not include archive');
		expect(q.filters).toHaveLength(2);
	});

	it('parses description includes/excludes', () => {
		const q = parseQuery('description includes meeting\ndescription does not include template');
		expect(q.filters).toHaveLength(2);
	});

	it('parses tag includes/excludes', () => {
		const q = parseQuery('tag includes #work\ntag does not include #someday');
		expect(q.filters).toHaveLength(2);
	});

	it('parses priority filters', () => {
		const q = parseQuery('priority is high\npriority above medium\npriority below low');
		expect(q.filters).toHaveLength(3);
	});

	it('parses limit', () => {
		const q = parseQuery('limit to 20 tasks');
		expect(q.limit).toBe(20);
	});

	it('parses sort by', () => {
		expect(parseQuery('sort by priority').sortBy).toBe('priority');
		expect(parseQuery('sort by due').sortBy).toBe('due');
		expect(parseQuery('sort by description').sortBy).toBe('description');
	});

	it('ignores unknown lines', () => {
		const q = parseQuery('some unknown rule\nnot done');
		expect(q.filters).toHaveLength(1);
	});

	it('handles case insensitivity', () => {
		const q = parseQuery('NOT DONE\nDue Before 2025-06-01');
		expect(q.filters).toHaveLength(2);
	});

	it('ignores invalid dates', () => {
		const q = parseQuery('due before not-a-date');
		expect(q.filters).toHaveLength(0);
	});

	it('ignores invalid priority names', () => {
		const q = parseQuery('priority is supercritical');
		expect(q.filters).toHaveLength(0);
	});

	it('ignores limit of zero', () => {
		const q = parseQuery('limit to 0 tasks');
		expect(q.limit).toBeNull();
	});
});

describe('applyQuery – status filters', () => {
	const incomplete = makeTask({ completed: false });
	const done = makeTask({ id: 'f:2', completed: true });

	it('"not done" filters out completed tasks', () => {
		const q = parseQuery('not done');
		const result = applyQuery([incomplete, done], q);
		expect(result).toEqual([incomplete]);
	});

	it('"done" filters out incomplete tasks', () => {
		const q = parseQuery('done');
		const result = applyQuery([incomplete, done], q);
		expect(result).toEqual([done]);
	});
});

describe('applyQuery – due date filters', () => {
	const early = makeTask({ id: 'f:1', dueDate: new Date('2025-01-15T00:00:00') });
	const mid = makeTask({ id: 'f:2', dueDate: new Date('2025-06-15T00:00:00') });
	const late = makeTask({ id: 'f:3', dueDate: new Date('2025-12-15T00:00:00') });
	const noDue = makeTask({ id: 'f:4' });

	it('"due before" filters correctly', () => {
		const q = parseQuery('due before 2025-07-01');
		const result = applyQuery([early, mid, late, noDue], q);
		expect(result).toHaveLength(2);
		expect(result).toContain(early);
		expect(result).toContain(mid);
	});

	it('"due after" filters correctly', () => {
		const q = parseQuery('due after 2025-06-01');
		const result = applyQuery([early, mid, late, noDue], q);
		expect(result).toHaveLength(2);
		expect(result).toContain(mid);
		expect(result).toContain(late);
	});

	it('"due on" matches exact date', () => {
		const q = parseQuery('due on 2025-06-15');
		const result = applyQuery([early, mid, late, noDue], q);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(mid);
	});
});

describe('applyQuery – path filters', () => {
	const projTask = makeTask({ filePath: 'projects/active/task.md' });
	const archiveTask = makeTask({ id: 'f:2', filePath: 'archive/old.md' });

	it('"path includes" filters correctly', () => {
		const q = parseQuery('path includes projects/');
		const result = applyQuery([projTask, archiveTask], q);
		expect(result).toEqual([projTask]);
	});

	it('"path does not include" filters correctly', () => {
		const q = parseQuery('path does not include archive');
		const result = applyQuery([projTask, archiveTask], q);
		expect(result).toEqual([projTask]);
	});
});

describe('applyQuery – description filters', () => {
	const meetingTask = makeTask({ title: 'Weekly meeting' });
	const codeTask = makeTask({ id: 'f:2', title: 'Code review' });

	it('"description includes" filters by task title', () => {
		const q = parseQuery('description includes meeting');
		const result = applyQuery([meetingTask, codeTask], q);
		expect(result).toEqual([meetingTask]);
	});

	it('"description does not include" excludes matching', () => {
		const q = parseQuery('description does not include meeting');
		const result = applyQuery([meetingTask, codeTask], q);
		expect(result).toEqual([codeTask]);
	});
});

describe('applyQuery – tag filters', () => {
	const workTask = makeTask({ tags: ['#work', '#urgent'] });
	const homeTask = makeTask({ id: 'f:2', tags: ['#home'] });
	const noTags = makeTask({ id: 'f:3', tags: [] });

	it('"tag includes" filters correctly', () => {
		const q = parseQuery('tag includes #work');
		const result = applyQuery([workTask, homeTask, noTags], q);
		expect(result).toEqual([workTask]);
	});

	it('"tag does not include" filters correctly', () => {
		const q = parseQuery('tag does not include #work');
		const result = applyQuery([workTask, homeTask, noTags], q);
		expect(result).toEqual([homeTask, noTags]);
	});
});

describe('applyQuery – priority filters', () => {
	const highest = makeTask({ id: 'f:1', priority: 1 });
	const high = makeTask({ id: 'f:2', priority: 2 });
	const medium = makeTask({ id: 'f:3', priority: 3 });
	const low = makeTask({ id: 'f:4', priority: 4 });
	const none = makeTask({ id: 'f:5' }); // undefined → 999

	it('"priority is high" matches exact level', () => {
		const q = parseQuery('priority is high');
		const result = applyQuery([highest, high, medium, low, none], q);
		expect(result).toEqual([high]);
	});

	it('"priority above medium" returns higher priorities', () => {
		const q = parseQuery('priority above medium');
		const result = applyQuery([highest, high, medium, low, none], q);
		expect(result).toEqual([highest, high]);
	});

	it('"priority below medium" returns lower priorities', () => {
		const q = parseQuery('priority below medium');
		const result = applyQuery([highest, high, medium, low, none], q);
		expect(result).toEqual([low, none]);
	});
});

describe('applyQuery – sorting', () => {
	const taskA = makeTask({ id: 'f:1', title: 'Alpha', priority: 3, dueDate: new Date('2025-03-01T00:00:00') });
	const taskB = makeTask({ id: 'f:2', title: 'Beta', priority: 1, dueDate: new Date('2025-01-01T00:00:00') });
	const taskC = makeTask({ id: 'f:3', title: 'Charlie', priority: 2 });

	it('sorts by priority', () => {
		const q = parseQuery('sort by priority');
		const result = applyQuery([taskA, taskB, taskC], q);
		expect(result.map((t) => t.priority)).toEqual([1, 2, 3]);
	});

	it('sorts by due date', () => {
		const q = parseQuery('sort by due');
		const result = applyQuery([taskA, taskB, taskC], q);
		// taskB (Jan) → taskA (Mar) → taskC (no due = Infinity)
		expect(result.map((t) => t.id)).toEqual(['f:2', 'f:1', 'f:3']);
	});

	it('sorts by description (alphabetical)', () => {
		const q = parseQuery('sort by description');
		const result = applyQuery([taskC, taskA, taskB], q);
		expect(result.map((t) => t.title)).toEqual(['Alpha', 'Beta', 'Charlie']);
	});
});

describe('applyQuery – limit', () => {
	const tasks = Array.from({ length: 10 }, (_, i) =>
		makeTask({ id: `f:${i}`, title: `Task ${i}` })
	);

	it('limits results to N', () => {
		const q = parseQuery('limit to 3 tasks');
		const result = applyQuery(tasks, q);
		expect(result).toHaveLength(3);
	});

	it('returns all if limit exceeds count', () => {
		const q = parseQuery('limit to 100 tasks');
		const result = applyQuery(tasks, q);
		expect(result).toHaveLength(10);
	});
});

describe('applyQuery – combined filters', () => {
	it('ANDs multiple filters together', () => {
		const tasks = [
			makeTask({ id: 'f:1', title: 'Work meeting', tags: ['#work'], completed: false }),
			makeTask({ id: 'f:2', title: 'Work email', tags: ['#work'], completed: true }),
			makeTask({ id: 'f:3', title: 'Home chore', tags: ['#home'], completed: false }),
		];

		const q = parseQuery('not done\ntag includes #work');
		const result = applyQuery(tasks, q);
		expect(result).toHaveLength(1);
		expect(result[0]?.title).toBe('Work meeting');
	});
});
