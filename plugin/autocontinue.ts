import type { Plugin } from "@opencode-ai/plugin"

type AutoContinueState = {
  deadlineAt: number
  durationMs: number
  sending: boolean
}

const COMMAND_NAME = "autocontinue"
const CONTINUE_TEXT = "つづけて"

const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
}

function parseDurationToMs(raw: string): number | null {
  const input = raw.trim().toLowerCase()
  if (!input) return null

  let total = 0
  let consumed = ""
  const re = /(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)/g

  for (const match of input.matchAll(re)) {
    const value = Number(match[1])
    const unit = match[2]
    const multiplier = UNIT_TO_MS[unit]

    if (!Number.isFinite(value) || value <= 0 || !multiplier) continue

    total += value * multiplier
    consumed += match[0]
  }

  if (total > 0) {
    const compactInput = input.replace(/\s+/g, "")
    const compactConsumed = consumed.replace(/\s+/g, "")
    if (compactInput === compactConsumed) {
      return Math.floor(total)
    }
  }

  if (/^\d+$/.test(input)) {
    return Number(input) * 60_000
  }

  return null
}

function formatDuration(durationMs: number): string {
  if (durationMs % 3_600_000 === 0) return `${durationMs / 3_600_000}h`
  if (durationMs % 60_000 === 0) return `${durationMs / 60_000}min`
  if (durationMs % 1000 === 0) return `${durationMs / 1000}s`
  return `${durationMs}ms`
}

export const Autocontinue: Plugin = async ({ client }) => {
  const stateBySession = new Map<string, AutoContinueState>()

  return {
    event: async ({ event }) => {
      if (event.type === "command.executed") {
        const { name, sessionID, arguments: args } = event.properties
        if (name !== COMMAND_NAME) return

        const parsed = parseDurationToMs(args ?? "")
        if (!parsed) {
          await client.tui.showToast({
            body: {
              title: "autocontinue",
              message: "時間指定を解釈できませんでした。例: /autocontinue 30s",
              variant: "warning",
              duration: 3000,
            },
          })
          return
        }

        const now = Date.now()
        stateBySession.set(sessionID, {
          deadlineAt: now + parsed,
          durationMs: parsed,
          sending: false,
        })

        await client.tui.showToast({
          body: {
            title: "autocontinue observed",
            message: `/autocontinue ${args} を観測。${formatDuration(parsed)} の間、自動で「${CONTINUE_TEXT}」を送信します。`,
            variant: "success",
            duration: 3500,
          },
        })

        return
      }

      if (event.type !== "session.idle") return

      const { sessionID } = event.properties
      const state = stateBySession.get(sessionID)
      if (!state) return

      if (Date.now() > state.deadlineAt) {
        stateBySession.delete(sessionID)
        await client.tui.showToast({
          body: {
            title: "autocontinue finished",
            message: `自動継続を停止しました（${formatDuration(state.durationMs)} 経過）。`,
            variant: "info",
            duration: 2500,
          },
        })
        return
      }

      if (state.sending) return
      state.sending = true

      try {
        await client.session.promptAsync({
          path: { id: sessionID },
          body: {
            parts: [
              {
                type: "text",
                text: CONTINUE_TEXT,
              },
            ],
          },
        })
      } catch {
        stateBySession.delete(sessionID)
        await client.tui.showToast({
          body: {
            title: "autocontinue error",
            message: "自動送信に失敗したため停止しました。",
            variant: "error",
            duration: 3000,
          },
        })
      } finally {
        const next = stateBySession.get(sessionID)
        if (next) next.sending = false
      }
    },
  }
}
