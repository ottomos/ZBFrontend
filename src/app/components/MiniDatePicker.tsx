import React, { useState, useRef, useEffect } from 'react'

type Props = {
  value: string | null
  onChange: (isoDate: string) => void
  minDate?: string // ISO date YYYY-MM-DD or full
  label?: string
}

const monthNames = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
]

function clampToMin(date: Date, min?: string) {
  if (!min) return date
  const minD = new Date(min)
  if (date < minD) return minD
  return date
}

export default function MiniDatePicker({ value, onChange, minDate, label }: Props) {
  const [open, setOpen] = useState(false)
  const parsed = value ? new Date(value) : null
  const [viewDate, setViewDate] = useState<Date>(parsed ? new Date(parsed) : clampToMin(new Date(), minDate))
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (parsed) setViewDate(parsed)
  }, [value])

  const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const startWeekDay = startOfMonth.getDay() // 0=Sun

  const days: Date[] = []
  // roll back to Sunday of first week
  const firstShown = new Date(startOfMonth)
  firstShown.setDate(firstShown.getDate() - startWeekDay)
  for (let i=0;i<42;i++) {
    const d = new Date(firstShown)
    d.setDate(firstShown.getDate()+i)
    days.push(d)
  }

  const isSameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()

  const handleSelect = (d: Date) => {
    const clamped = clampToMin(d, minDate)
    // Emit a local date/time string (no trailing Z) to avoid UTC shifts
    const pad = (n: number) => String(n).padStart(2, '0')
    const localStr = `${clamped.getFullYear()}-${pad(clamped.getMonth()+1)}-${pad(clamped.getDate())}T00:00`
    onChange(localStr)
    setOpen(false)
  }

  const selectedDate = value ? new Date(value) : null

  // enforce min date navigation and normalize comparisons (date-only)
  const minDateObj = minDate ? new Date(minDate) : null
  const minMonthStart = minDateObj ? new Date(minDateObj.getFullYear(), minDateObj.getMonth(), 1) : null
  const canNavigateTo = (year: number, month: number) => {
    if (!minMonthStart) return true
    const target = new Date(year, month, 1)
    return target >= minMonthStart
  }

  // enforce max date (today) — don't allow picking future dates
  const today = new Date()
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const maxMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const canNavigateForwardTo = (year: number, month: number) => {
    const target = new Date(year, month, 1)
    return target <= maxMonthStart
  }

  // Keep Custom date picker actions in the same blue as selected tab/entity controls.
  const primary = '#2C5680'
  const bg = 'var(--card-bg, #0A1929)'

  // text colors for dark theme
  const text = 'var(--text, #E6EEF2)'
  const muted = 'var(--muted, #9FB0BD)'
  const dim = 'var(--dim, #3A4A55)'

  // enforce the app's standard UI font for consistency
  const fontFamily = 'Segoe UI, Arial, sans-serif'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', fontFamily }}>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
          background: bg,
          color: text,
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 12, color: muted, fontWeight: 600, fontFamily }}>{label ?? ''}</div>
          <span style={{ fontSize: 13, fontFamily }}>{selectedDate ? selectedDate.toLocaleDateString('en-GB') : ''}</span>
        </div>
      </button>

      {open && (
        <div style={{ position: 'absolute', zIndex: 60, marginTop: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', borderRadius: 6, background: bg, color: text }}>
          <div style={{ padding: 8, width: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, color: text }}>
              <button
                aria-label="Previous month"
                onClick={() => setViewDate(d => {
                  const y = d.getFullYear(); const m = d.getMonth() - 1
                  if (!canNavigateTo(y, m)) return d
                  return new Date(y, m, 1)
                })}
                disabled={!canNavigateTo(viewDate.getFullYear(), viewDate.getMonth()-1)}
                style={{ background: 'transparent', border: 'none', color: primary, cursor: canNavigateTo(viewDate.getFullYear(), viewDate.getMonth()-1) ? 'pointer' : 'not-allowed', opacity: canNavigateTo(viewDate.getFullYear(), viewDate.getMonth()-1) ? 1 : 0.35 }}
              >&lt;</button>
              <div style={{ fontWeight: 600, fontFamily }}>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</div>
              <button
                aria-label="Next month"
                onClick={() => setViewDate(d => {
                  const y = d.getFullYear(); const m = d.getMonth() + 1
                  if (!canNavigateForwardTo(y, m)) return d
                  return new Date(y, m, 1)
                })}
                disabled={!canNavigateForwardTo(viewDate.getFullYear(), viewDate.getMonth()+1)}
                style={{ background: 'transparent', border: 'none', color: primary, cursor: canNavigateForwardTo(viewDate.getFullYear(), viewDate.getMonth()+1) ? 'pointer' : 'not-allowed', opacity: canNavigateForwardTo(viewDate.getFullYear(), viewDate.getMonth()+1) ? 1 : 0.35 }}
              >&gt;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontSize: 12, color: muted, fontFamily }}>
              {['S','M','T','W','T','F','S'].map((x, i) => <div key={`${x}-${i}`} style={{ fontWeight: 700 }}>{x}</div>)}
              {days.map((d, idx) => {
                const isCurrentMonth = d.getMonth() === viewDate.getMonth()
                // compare date-only to avoid timezone offsets
                const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
                const disabledLow = minDateObj ? (dayOnly < new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate())) : false
                const disabledHigh = dayOnly > todayDateOnly
                const disabled = disabledLow || disabledHigh
                const isSelected = selectedDate ? isSameDay(d, selectedDate) : false
                return (
                  <button
                    key={idx}
                    onClick={() => !disabled && handleSelect(d)}
                    disabled={disabled}
                    style={{
                      padding: '6px 4px',
                      borderRadius: 4,
                      border: 'none',
                      background: isSelected ? primary : 'transparent',
                      color: isSelected ? '#fff' : (isCurrentMonth ? text : dim),
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily
                    }}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button onClick={() => { const t = clampToMin(new Date(), minDate); const clamped = t > todayDateOnly ? todayDateOnly : t; const pad = (n: number) => String(n).padStart(2, '0'); const localStr = `${clamped.getFullYear()}-${pad(clamped.getMonth()+1)}-${pad(clamped.getDate())}T00:00`; onChange(localStr); setOpen(false) }} style={{ background: primary, color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6 }}>Today</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setViewDate(d => {
                    const y = d.getFullYear(); const m = d.getMonth() - 12
                    if (!canNavigateTo(y, m)) return d
                    return new Date(y, m, 1)
                  }) }}
                  disabled={!canNavigateTo(viewDate.getFullYear(), viewDate.getMonth()-12)}
                  style={{ background: 'transparent', border: 'none', color: primary, cursor: canNavigateTo(viewDate.getFullYear(), viewDate.getMonth()-12) ? 'pointer' : 'not-allowed', opacity: canNavigateTo(viewDate.getFullYear(), viewDate.getMonth()-12) ? 1 : 0.35 }}
                >◀◀</button>
                <button
                  onClick={() => { setViewDate(d => {
                    const y = d.getFullYear(); const m = d.getMonth() + 12
                    if (!canNavigateForwardTo(y, m)) return d
                    return new Date(y, m, 1)
                  }) }}
                  disabled={!canNavigateForwardTo(viewDate.getFullYear(), viewDate.getMonth()+12)}
                  style={{ background: 'transparent', border: 'none', color: primary, cursor: canNavigateForwardTo(viewDate.getFullYear(), viewDate.getMonth()+12) ? 'pointer' : 'not-allowed', opacity: canNavigateForwardTo(viewDate.getFullYear(), viewDate.getMonth()+12) ? 1 : 0.35 }}
                >▶▶</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
