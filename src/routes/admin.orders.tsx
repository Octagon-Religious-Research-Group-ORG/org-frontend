import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import {
  ApiError,
  apiRequest,
  humanStatus,
  money,
} from '#/lib/api'
import type { Order, OrderStatus } from '#/lib/api'
import { useOrgAuth } from '#/lib/auth'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/admin/orders')({
  head: () => ({
    meta: [
      { title: 'Order queue — ORG' },
      {
        name: 'description',
        content: 'Review and fulfill ORG offering requests.',
      },
    ],
  }),
  component: AdminOrdersPage,
})

const STATUSES: OrderStatus[] = [
  'awaiting_donation',
  'donation_reported',
  'donation_confirmed',
  'preparing',
  'shipped',
  'completed',
  'cancelled',
]

function AdminOrdersPage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[1180px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/admin/orders">
          <AdminQueue />
        </MemberGate>
      </main>
    </ShopShell>
  )
}

function AdminQueue() {
  const auth = useOrgAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')

  async function load(nextFilter = filter) {
    setLoading(true)
    setDenied(false)
    setError('')
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      const query = nextFilter === 'all' ? '' : `?status=${nextFilter}`
      setOrders(await apiRequest<Order[]>(`/admin/orders${query}`, { token }))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setDenied(true)
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'The order queue did not load.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function updateOrder(
    order: Order,
    status: OrderStatus,
    trackingNumber: string,
  ) {
    setError('')
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      await apiRequest<Order>(`/admin/orders/${order._id}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          status,
          trackingNumber: trackingNumber || undefined,
        }),
      })
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The order was not updated.',
      )
    }
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-2xl border border-[#c98b63]/50 p-8 text-center">
        <LockKeyhole size={28} className="mx-auto text-[#c98b63]" />
        <h1 className="font-display mt-5 text-5xl uppercase tracking-[0.03em]">
          Admin permission required.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#b8ad8d]">
          Ask an ORG administrator to add your email to the admin allowlist,
          then sign in again.
        </p>
        <Link
          to="/profile"
          className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] no-underline"
        >
          <ArrowLeft size={13} /> Return to profile
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-5 border-b border-[#ece2c4]/18 pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9dcf83]">
            Host operations
          </div>
          <h1 className="font-display mt-2 text-[clamp(52px,9vw,92px)] uppercase leading-[0.84] tracking-[0.01em] text-[#f6efd9]">
            Order queue.
          </h1>
        </div>
        <select
          value={filter}
          onChange={(event) => {
            const value = event.target.value as OrderStatus | 'all'
            setFilter(value)
            void load(value)
          }}
          className="border border-[#ece2c4]/22 bg-[#0b0d12] px-3 py-2 font-mono text-[10px] uppercase text-[#b8ad8d]"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanStatus(status)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mt-6 border border-[#c98b63]/50 bg-[#c98b63]/10 p-4 text-sm text-[#e7c3a9]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-72 place-items-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
          Reading the queue…
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {!orders.length ? (
            <div className="border border-[#ece2c4]/18 p-10 text-center text-sm text-[#9f9676]">
              No orders match this filter.
            </div>
          ) : null}
          {orders.map((order) => (
            <AdminOrderCard
              key={order._id}
              order={order}
              onUpdate={updateOrder}
            />
          ))}
        </div>
      )}
    </>
  )
}

function AdminOrderCard({
  order,
  onUpdate,
}: {
  order: Order
  onUpdate: (
    order: Order,
    status: OrderStatus,
    trackingNumber: string,
  ) => Promise<void>
}) {
  const [status, setStatus] = useState(order.status)
  const [tracking, setTracking] = useState(order.trackingNumber || '')
  const [saving, setSaving] = useState(false)

  return (
    <article className="border border-[#ece2c4]/18 bg-[#0b0d12]">
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_220px_240px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-[#f3ead0]">
              {order.orderNumber}
            </span>
            <span className="border border-[#9dcf83]/35 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-[#9dcf83]">
              {humanStatus(order.status)}
            </span>
          </div>
          <div className="mt-3 text-sm text-[#b8ad8d]">
            {order.contact.preferredName} · {order.contact.email}
          </div>
          <div className="mt-2 text-xs text-[#9f9676]">
            {order.items
              .map((item) => `${item.quantity} × ${item.productName}`)
              .join(' · ')}
          </div>
          <div className="mt-3 font-mono text-[10px] text-[#9dcf83]">
            {money(order.suggestedTotalCents)} suggested ·{' '}
            {order.donationReport
              ? `${order.donationReport.method} report`
              : 'no donation report'}
          </div>
        </div>
        <address className="text-xs not-italic leading-5 text-[#9f9676]">
          {order.shippingAddress.recipientName}
          <br />
          {order.shippingAddress.line1}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
          {order.shippingAddress.postalCode}
        </address>
        <div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as OrderStatus)}
            className="w-full border border-[#ece2c4]/22 bg-[#11141a] px-3 py-2 font-mono text-[9px] uppercase text-[#ece2c4]"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanStatus(value)}
              </option>
            ))}
          </select>
          <input
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            placeholder="Tracking number"
            className="mt-2 w-full border border-[#ece2c4]/22 bg-transparent px-3 py-2 font-mono text-[9px]"
          />
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onUpdate(order, status, tracking)
              } finally {
                setSaving(false)
              }
            }}
            className="mt-2 w-full bg-[#9dcf83] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[#0b0d12] disabled:opacity-45"
          >
            {saving ? 'Updating…' : 'Update order'}
          </button>
        </div>
      </div>
    </article>
  )
}
