import { Plus, X } from 'lucide-react'
import { CONTACT_METHODS } from '#/lib/membership-api'
import type { ContactEntry, ContactMethod } from '#/lib/membership-api'

export const field =
  'w-full border border-[rgba(236,226,196,0.22)] bg-[#0f1219] px-3 py-2 text-sm text-[#f6efd9] placeholder:text-[#6f6852] focus:border-[#78aea2] focus:outline-none'

/** Editable list of contact rows (method + handle). */
export function ContactRows({
  label,
  rows,
  onChange,
  max = 5,
  placeholder = '@handle, number or address',
}: {
  label: string
  rows: ContactEntry[]
  onChange: (rows: ContactEntry[]) => void
  max?: number
  placeholder?: string
}) {
  const update = (index: number, patch: Partial<ContactEntry>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[130px_1fr_auto] gap-2">
          <select
            aria-label={`${label} ${index + 1} method`}
            value={row.method}
            onChange={(event) =>
              update(index, { method: event.target.value as ContactMethod })
            }
            className={field}
          >
            {CONTACT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
          <input
            aria-label={`${label} ${index + 1}`}
            value={row.value}
            maxLength={200}
            placeholder={placeholder}
            onChange={(event) => update(index, { value: event.target.value })}
            className={field}
          />
          <button
            type="button"
            aria-label={`Remove ${label} ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="grid w-9 place-items-center border border-[rgba(236,226,196,0.22)] text-[#b8ad8d] hover:text-[#f6efd9]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button
          type="button"
          onClick={() => onChange([...rows, { method: 'telegram', value: '' }])}
          className="flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2] hover:text-[#9cc9be]"
        >
          <Plus size={13} /> Add {label.toLowerCase()}
        </button>
      )}
    </div>
  )
}
