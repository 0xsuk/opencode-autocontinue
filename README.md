# opencode-autocontinue

OpenCode plugin that supports `/autocontinue 3min` style duration control.

During the configured duration, whenever the assistant becomes idle (`session.idle`),
the plugin sends `つづけて` as a user message automatically.

It also shows a TUI toast as soon as `/autocontinue ...` is observed.

## Features

- Detects `/autocontinue <duration>` via `command.executed`
- Shows immediate toast feedback when detected
- Auto-sends `つづけて` on every `session.idle` while active
- Stops automatically at deadline and shows a finish toast

## Supported duration examples

- `30s`
- `3min`
- `1h`
- `1m30s`
- `500ms`
- `5` (interpreted as 5 minutes)

## Usage in OpenCode config

Add this plugin and command configuration in your `opencode.json`:

```json
{
  "plugin": ["autocontinue"],
  "command": {
    "autocontinue": {
      "description": "Auto-send つづけて for a duration",
      "template": "This /autocontinue command is handled by a plugin. Reply with exactly: 自動継続を設定しました。"
    }
  }
}
```

Then run:

```text
/autocontinue 3min
```

## Plugin entry

`plugin/autocontinue.ts` exports `Autocontinue`.
