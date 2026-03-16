import type { Plugin } from "@opencode-ai/plugin"

export const TerminalBell: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        // Play a system sound (audible bell)
        try {
          await $`paplay /usr/share/sounds/freedesktop/stereo/bell.oga`
        } catch (err) {
          console.warn("Failed to play audible bell:", err)
        }
      }
    }
  }
}
