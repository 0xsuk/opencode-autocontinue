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
    if (compactInput === compactConsumed || compactInput.startsWith(compactConsumed)) {
      return Math.floor(total)
    }
  }

  if (/^\d+$/.test(input)) {
    return Number(input) * 60_000
  }

  return null
}

function splitDurationAndRemainder(raw: string): { durationMs: number; remainder: string } | null {
  const input = raw.trim()
  if (!input) return null

  const tokenPattern = "(?:ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)"
  const durationPrefix = new RegExp(`^\\s*((?:\\d+(?:\\.\\d+)?\\s*${tokenPattern}\\s*)+)(.*)$`, "i")
  const matched = input.match(durationPrefix)
  if (matched) {
    const durationPart = matched[1].trim()
    const remainder = (matched[2] ?? "").trim()
    const durationMs = parseDurationToMs(durationPart)
    if (durationMs) return { durationMs, remainder }
  }

  const numericPrefix = input.match(/^\s*(\d+)(?:\s+(.*))?$/)
  if (numericPrefix) {
    const durationMs = Number(numericPrefix[1]) * 60_000
    const remainder = (numericPrefix[2] ?? "").trim()
    if (durationMs > 0) return { durationMs, remainder }
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

  const startAutoContinue = async (sessionID: string, args: string) => {
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
  }

  return {
    "command.execute.before": async (input, output) => {
      if (input.command !== COMMAND_NAME) return

      const parsed = splitDurationAndRemainder(input.arguments ?? "")
      if (parsed) {
        const baseText = `${formatDuration(parsed.durationMs)}稼働しつづけて`
        const commandText = parsed.remainder ? `${baseText} ${parsed.remainder}` : baseText

        await client.session.promptAsync({
          path: { id: input.sessionID },
          body: {
            noReply: true,
            parts: [
              {
                type: "text",
                text: commandText,
              },
            ],
          },
        })

        if (output.parts.length > 0 && output.parts[0]?.type === "text") {
          ;(output.parts[0] as { text?: string }).text = commandText
          output.parts = output.parts.slice(0, 1)
        } else {
          output.parts = [{ type: "text", text: commandText } as never]
        }
      } else {
        output.parts = []
      }

      await startAutoContinue(input.sessionID, input.arguments ?? "")
    },

    event: async ({ event }) => {
      if (event.type === "session.error") {
        const err = event.properties.error
        if (!err) return

        const isInterruptLike =
          err.name === "MessageAbortedError" ||
          (err.name === "APIError" && /abort|cancel|interrupt|stopped/i.test(err.data?.message ?? ""))
        if (!isInterruptLike) return

        const sessionID = event.properties.sessionID
        if (sessionID) {
          const state = stateBySession.get(sessionID)
          if (!state) return

          stateBySession.delete(sessionID)
          await client.tui.showToast({
            body: {
              title: "autocontinue stopped",
              message: `セッション中断を検知したため自動継続を停止しました（${formatDuration(state.durationMs)}）。`,
              variant: "info",
              duration: 2500,
            },
          })
          return
        }

        for (const [activeSessionID, state] of stateBySession) {
          stateBySession.delete(activeSessionID)
          await client.tui.showToast({
            body: {
              title: "autocontinue stopped",
              message: `セッション中断を検知したため自動継続を停止しました（${formatDuration(state.durationMs)}）。`,
              variant: "info",
              duration: 2500,
            },
          })
        }
        return
      }

      if (event.type === "tui.command.execute") {
        if (event.properties.command !== "session.interrupt") return

        for (const [sessionID, state] of stateBySession) {
          stateBySession.delete(sessionID)
          await client.tui.showToast({
            body: {
              title: "autocontinue stopped",
              message: `割り込み操作を検知したため自動継続を停止しました（${formatDuration(state.durationMs)}）。`,
              variant: "info",
              duration: 2500,
            },
          })
        }
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
