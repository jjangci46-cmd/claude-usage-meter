import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'usage-meter', component: 'AbovePrompt', props: { hasSurvey: false } } as const

test('세션 막대와 주간 사용량을 한 줄로 그린다', async ($, on) => {
  const in2h = new Date(Date.now() + (2 * 60 + 13) * 60000).toISOString()
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 96, resetsAt: in2h },
        { kind: 'seven_day', percentUsed: 18, resetsAt: in2h },
      ],
    },
  }))
  on('clock.now', () => ({ value: Date.now() }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface } as never)
    expect((await ui.find({ type: 'Text', text: /^96%$/ }))?.props.color).toBe('#ef4444')
    expect((await ui.find({ type: 'Text', text: /^18%$/ }))?.props.color).toBe('text')
    expect(await ui.find({ type: 'Text', text: /^2h 1[23]m 후 초기화$/ })).toBeTruthy()
    if (surface !== 'terminal') expect(await ui.find({ type: 'Svg' })).toBeTruthy()
    await ui.unmount()
  }
})

test('주간 초기화 시각은 한국 시간 오전/오후로 표시한다', async ($, on) => {
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 }, rateLimits: [{ kind: 'seven_day', percentUsed: 30, resetsAt: '2026-11-29T09:00:00Z' }] },
  }))
  on('clock.now', () => ({ value: Date.parse('2026-11-26T05:00:00Z') }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'mobile' } as never)
  expect((await ui.find({ type: 'Text', text: /초기화/ }))?.text).toBe('일 오후 6:00 초기화')
  await ui.unmount()
})
