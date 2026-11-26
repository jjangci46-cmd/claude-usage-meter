import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Reading, Window } from '../types'

const REFRESH_MS = 3 * 60 * 1000 // 3분마다 다시 읽기

const reading = atom({ plugin: 'usage-meter', key: 'reading' } as const, null)
const now = atom({ plugin: 'usage-meter', key: 'now' } as const, 0)

const pick = (limits: readonly SessionRateLimit[], kind: string): Window | null => {
  const w = limits.find(l => l.kind === kind)
  return w ? { percent: w.percentUsed, resetsAt: w.resetsAt } : null
}

// 설정의 사용량 페이지처럼: 배경 없이 테마 글자색, 둥근 얇은 막대
const BLUE = '#2c84db'
const ORANGE = '#f59e0b'
const RED = '#ef4444'
const tone = (p: number) => (p >= 95 ? RED : p >= 80 ? ORANGE : BLUE)
const BAR_H = 6

// 막대 폭은 칸에 맞춰 퍼센트로 잡고, 늘이기(scale) 없이 그려서 rx 둥근 끝이 찌그러지지 않게 한다
function barSvg(p: number) {
  const c = tone(p)
  const r = BAR_H / 2
  const filled =
    p > 0
      ? `<rect x="0" y="0" width="${Math.max(p, 1).toFixed(1)}%" height="${BAR_H}" rx="${r}" ry="${r}" fill="${c}"/>`
      : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${BAR_H}"><rect x="0" y="0" width="100%" height="${BAR_H}" rx="${r}" ry="${r}" fill="${c}" fill-opacity="0.18"/>${filled}</svg>`
}

const untilReset = (iso: string | undefined, t: number) => {
  if (!iso) return null
  const ms = Date.parse(iso) - t
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return '곧'
  const m = Math.ceil(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}d ${pad(h)}h` : h > 0 ? `${h}h ${pad(mm)}m` : `${mm}m`
}

// 모드는 UTC 시간대의 클라우드 컨테이너에서 돌아가므로 한국 시간(UTC+9)으로 직접 바꾼다
const TZ_OFFSET_MIN = 9 * 60

const weekday = (iso: string | undefined) => {
  if (!iso) return null
  const d = new Date(Date.parse(iso) + TZ_OFFSET_MIN * 60000)
  if (Number.isNaN(d.getTime())) return null
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const h = d.getUTCHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${days[d.getUTCDay()]} ${ampm} ${h12}:${mm}`
}

async function save($: EngineInterface, limits: readonly SessionRateLimit[]) {
  const t = await $.clock.now()
  const next: Reading = { session: pick(limits, 'five_hour'), weekly: pick(limits, 'seven_day'), at: t }
  await update($, now, () => t)
  // 새 값이 비어 있으면 마지막으로 읽은 값을 유지한다
  if (next.session || next.weekly) await update($, reading, () => next)
}

export const register: Register = on => {
  let stop: (() => void) | undefined

  on('session.start', async ($, e, next) => {
    const refresh = async () => save($, (await $.session.usage()).rateLimits)
    await refresh()
    stop?.()
    stop = $.clock.every(REFRESH_MS, () => void refresh()).cancel
    return next(e)
  })

  // 엔진이 사용량을 새로 측정할 때마다(턴 종료, 1%p 변화) 즉시 반영
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await save($, e.rateLimits)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, reading)
    if (e.props.hasSurvey || !r) return next(e)
    const t = (await read($, now)) || r.at
    const table = $.ui.resolve(e)
    const { Box, Text } = table
    const Svg = 'Svg' in table ? table.Svg : undefined

    const pct = (p: number) => (
      <Text color={p >= 80 ? tone(p) : 'text'} weight={p >= 80 ? 'semibold' : 'medium'}>
        {Math.round(p)}%
      </Text>
    )

    // 칸마다 고정 폭: 숫자·시간 길이가 바뀌어도 자리가 흔들리지 않는다
    const cells = []
    if (r.session) {
      const p = Math.max(0, Math.min(100, r.session.percent))
      const left = untilReset(r.session.resetsAt, t)
      cells.push(
        <Box key="sl" width={5} flexShrink={0}>
          <Text weight="medium">세션</Text>
        </Box>,
      )
      cells.push(
        <Box key="bar" flexGrow={1} flexShrink={1} marginLeft={1} alignItems="center">
          {Svg ? (
            <Svg source={barSvg(p)} alt={`세션 ${Math.round(p)}% 사용`} height={BAR_H} />
          ) : (
            <Text>
              <Text color={tone(p)}>{'━'.repeat(Math.round((p / 100) * 30))}</Text>
              <Text dimColor>{'━'.repeat(30 - Math.round((p / 100) * 30))}</Text>
            </Text>
          )}
        </Box>,
      )
      cells.push(
        <Box key="sp" width={5} flexShrink={0} justifyContent="flex-end">
          {pct(p)}
        </Box>,
      )
      cells.push(
        <Box key="sr" width={15} flexShrink={0} justifyContent="flex-end">
          <Text dimColor>{left ? `${left} 후 초기화` : ''}</Text>
        </Box>,
      )
    }
    if (r.weekly) {
      const p = r.weekly.percent
      const when = weekday(r.weekly.resetsAt)
      cells.push(
        <Box key="sep" width={5} flexShrink={0} justifyContent="center">
          <Text dimColor>│</Text>
        </Box>,
      )
      cells.push(
        <Box key="wl" width={5} flexShrink={0}>
          <Text weight="medium">주간</Text>
        </Box>,
      )
      cells.push(
        <Box key="wp" width={5} flexShrink={0} justifyContent="flex-end">
          {pct(p)}
        </Box>,
      )
      cells.push(
        <Box key="wr" width={18} flexShrink={0} justifyContent="flex-end">
          <Text dimColor>{when ? `${when} 초기화` : ''}</Text>
        </Box>,
      )
    }

    return (
      <Box flexDirection="row" alignItems="center" paddingX={1}>
        {cells}
      </Box>
    )
  })
}
