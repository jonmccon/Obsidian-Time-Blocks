# Time Blocks

A weekly time-blocking plugin for [Obsidian](https://obsidian.md). Drag tasks from your vault onto a visual calendar grid to plan your week, with optional Google Calendar overlay.

## Features

- **Weekly calendar grid** — A 7-day time grid (Monday–Sunday) with configurable workday start/end hours and a current-time indicator.
- **Task backlog sidebar** — Automatically scans your vault for tasks written in [Obsidian Tasks](https://obsidian-tasks-group.github.io/obsidian-tasks/) format (`- [ ] task text`) and displays them in a filterable sidebar, sorted by priority and due date.
- **Drag-and-drop scheduling** — Drag tasks from the backlog onto the grid to schedule them. Once placed, blocks snap to 15-minute increments and can be repositioned by dragging again.
- **Block resizing** — Drag the bottom edge of any scheduled block to change its duration.
- **Google Calendar integration** — Paste a private ICS feed URL in settings to overlay your Google Calendar events on the grid (read-only).
- **Customizable colors** — Choose background colors for task blocks and calendar event blocks.
- **Search & filter** — Filter the backlog by text, tag, or completion status.
- **Week navigation** — Move between weeks or jump back to the current week.
- **Persistent schedule** — Scheduled blocks are saved to `data.json` and restored when the plugin reloads.

## How it works

1. **Open the view** — Click the calendar icon in the ribbon or run the command *Open weekly time-block view*.
2. **Browse your backlog** — The left sidebar lists incomplete tasks from your vault. Tasks already scheduled for the current week are hidden from the backlog.
3. **Schedule a task** — Drag a task from the backlog and drop it onto a day/time slot. A block is created with the default duration configured in settings.
4. **Adjust blocks** — Drag a block to move it to a different day or time. Drag the bottom edge of a block to resize it. Click the **×** button on a block to remove it from the schedule.
5. **View calendar events** — If a Google Calendar ICS URL is configured, events from that calendar appear as read-only blocks on the grid.
6. **Refresh** — Click the ↻ button or run the *Refresh time-block view* command to re-scan vault tasks and re-fetch calendar events.

## Settings

| Setting | Description | Default |
|---|---|---|
| **Calendar feed URL** | Private ICS feed URL from Google Calendar | *(empty)* |
| **Workday start** | First hour shown on the grid (0–12) | 8 |
| **Workday end** | Last hour shown on the grid (12–24) | 18 |
| **Default task duration** | Duration in minutes when a task is first dropped (15–240) | 30 |
| **Tag filter** | Only show tasks with this tag (e.g. `#work`). Leave blank for all. | *(empty)* |
| **Show completed tasks** | Include tasks marked done in the backlog | Off |
| **Task block color** | Background color for scheduled task blocks | `#7B61FF` |
| **Google calendar event color** | Background color for calendar event blocks | `#4285F4` |

## Known issues

- **Recurring calendar events are not expanded.** The ICS parser does not process `RRULE` recurrence rules, so recurring Google Calendar events only appear for their original occurrence date and are missing on subsequent weeks.
- **Timezone offsets in ICS feeds are approximated.** Events with `TZID` parameters are treated as local time rather than being converted from the specified timezone, which may cause events to display at incorrect times.

## Installing the plugin

Copy `main.js`, `styles.css`, and `manifest.json` into your vault at:

```
<vault>/.obsidian/plugins/time-blocks/
```

Then enable **Time Blocks** in *Settings → Community plugins*.

## Development

```bash
# Install dependencies
npm install

# Build for production (type-check + bundle)
npm run build

# Dev mode (watch for changes)
npm run dev

# Lint
npm run lint
```

Requires Node.js v16 or later.
