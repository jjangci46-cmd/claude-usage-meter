export type Window = { percent: number; resetsAt?: string }
export type Reading = { session: Window | null; weekly: Window | null; at: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { reading: Reading | null; now: number }
  }
}
