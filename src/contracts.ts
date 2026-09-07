export const plugin = {
  id: '@kober-basket/dsh-cachescope', namespace: 'cachescope',
  dashboardPath: '/cachescope', dataPath: '/cachescope/api', inputPath: '/cachescope/api/input',
} as const
export interface RecordingSettings {
  recordingEnabled: boolean
  captureInput: 'metadata' | 'full'
  logAttempts: boolean
}
