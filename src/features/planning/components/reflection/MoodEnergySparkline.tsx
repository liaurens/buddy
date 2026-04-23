import React, { useMemo } from 'react'
import type { MoodEnergyPoint } from '../../services/moodHistory'

interface Props {
  points: MoodEnergyPoint[]
  width?: number
  height?: number
}

/**
 * Inline 14-day sparkline rendering two thin lines (mood + energy).
 * Missing values create a gap — we don't interpolate, to avoid inventing data.
 */
const MoodEnergySparkline: React.FC<Props> = ({ points, width = 280, height = 64 }) => {
  const hasAny = useMemo(
    () => points.some(p => p.mood !== null || p.energy !== null),
    [points]
  )
  if (points.length === 0 || !hasAny) {
    return (
      <div className="text-xs text-slate-400 italic">
        Not enough data yet — log mood & energy from the planner to see a trend.
      </div>
    )
  }

  const pad = 4
  const n = points.length
  const xAt = (i: number) => pad + (i * (width - 2 * pad)) / Math.max(1, n - 1)
  const yAt = (v: number) => {
    // scale 1..10 → (height-pad)..pad
    const clamped = Math.max(1, Math.min(10, v))
    return height - pad - ((clamped - 1) / 9) * (height - 2 * pad)
  }

  const buildPath = (sel: (p: MoodEnergyPoint) => number | null): string => {
    let d = ''
    let started = false
    points.forEach((p, i) => {
      const v = sel(p)
      if (v === null) {
        started = false
        return
      }
      const cmd = started ? 'L' : 'M'
      d += `${cmd}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} `
      started = true
    })
    return d.trim()
  }

  const moodPath = buildPath(p => p.mood)
  const energyPath = buildPath(p => p.energy)

  return (
    <div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        <line x1={pad} x2={width - pad} y1={yAt(5)} y2={yAt(5)} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="2 3" />
        {moodPath && (
          <path d={moodPath} fill="none" stroke="#6366f1" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {energyPath && (
          <path d={energyPath} fill="none" stroke="#10b981" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <div className="flex gap-4 text-[11px] text-slate-500 mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-indigo-500" /> Mood</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Energy</span>
      </div>
    </div>
  )
}

export default MoodEnergySparkline
