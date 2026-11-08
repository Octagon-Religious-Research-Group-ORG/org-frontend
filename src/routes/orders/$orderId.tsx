import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, Clipboard, ExternalLink, PackageCheck } from 'lucide-react'
import { apiRequest, humanStatus, money } from '#/lib/api'
import type { DonationConfig, Order } from '#/lib/api'
import { useOrgAuth } from '#/lib/auth'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/orders/$orderId')({
  head: () => ({
    meta: [
      { title: 'Offering request — ORG' },
      {
        name: 'description',
        content: 'Review an ORG offering request and report a donation.',
      },
    ],
  }),
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[980px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo={`/orders/${orderId}`}>
          <OrderReceipt orderId={orderId} />
        </MemberGate>
      </main>
    </ShopShell>
  )
}

function OrderReceipt({ orderId }: { orderId: string }) {
  const auth = useOrgAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [donations, setDonations] = useState<DonationConfig | null>(null)
  const [method, setMethod] = useState<'paypal' | 'venmo'>('paypal')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [reporting, setReporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    auth
      .getToken()
      .then((token) => {
        if (!token) throw new Error('Your sign-in session has expired.')
        return Promise.all([
          apiRequest<Order>(`/orders/${orderId}`, { token }),
          apiRequest<DonationConfig>('/donation-config'),
        ])
      })
      .then(([nextOrder, nextDonations]) => {
        setOrder(nextOrder)
        setDonations(nextDonations)
        setMethod(nextOrder.donationReport?.method || 'paypal')
        setAmount(
          (
            (nextOrder.donationReport?.amountCents ??
              nextOrder.declaredDonationCents ??
              nextOrder.suggestedTotalCents) / 100
          ).toFixed(2),
        )
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : 'The order did not load.',
        ),
      )
      .finally(() => setLoading(false))
  }, [auth, orderId])

  async function copyMemo() {
    if (!order) return
    await navigator.clipboard.writeText(order.donationMemo)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function report() {
    if (!order) return
    setReporting(true)
    setError('')
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      const amountCents = amount.trim()
        ? Math.round(Number(amount) * 100)
        : undefined
      const updated = await apiRequest<Order>(
        `/orders/${order._id}/donation-report`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ method, amountCents }),
        },
      )
      setOrder(updated)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The donation report was not recorded.',
      )
    } finally {
      setReporting(false)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-72 place-items-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Reading the request…
      </div>
    )
  }

  if (!order) {
    return (
      <div className="border border-[#c98b63]/50 p-5 text-[#e7c3a9]">
        {error || 'Order not found.'}
      </div>
    )
  }

  const reportable = ['awaiting_donation', 'donation_reported'].includes(
    order.status,
  )
  const paymentUrl =
    method === 'paypal' ? donations?.paypalUrl : donations?.venmoUrl

  return (
    <>
      <div className="flex flex-col justify-between gap-5 border-b border-[#ece2c4]/18 pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9dcf83]">
            Request recorded
          </div>
          <h1 className="font-display mt-2 text-[clamp(52px,9vw,92px)] uppercase leading-[0.84] tracking-[0.01em] text-[#f6efd9]">
            Thank you.
          </h1>
        </div>
        <div className="font-mono text-right text-[10px] leading-6 text-[#9f9676]">
          <div>{order.orderNumber}</div>
          <div>{new Date(order.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      {error ? (
        <div className="mt-6 border border-[#c98b63]/50 bg-[#c98b63]/10 p-4 text-sm text-[#e7c3a9]">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="border border-[#ece2c4]/18 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl uppercase tracking-[0.04em]">
                Current status
              </h2>
              <span className="border border-[#9dcf83]/45 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[#9dcf83]">
                {humanStatus(order.status)}
              </span>
            </div>
            <ol className="mt-5 space-y-3">
              {order.statusHistory.map((event, index) => (
                <li
                  key={`${event.status}-${event.at}`}
                  className="grid grid-cols-[22px_1fr_auto] items-center gap-3 text-xs text-[#b8ad8d]"
                >
                  <span className="grid h-5 w-5 place-items-center border border-[#9dcf83]/50 font-mono text-[8px] text-[#9dcf83]">
                    {index + 1}
                  </span>
                  <span className="capitalize">
                    {humanStatus(event.status)}
                  </span>
                  <span className="font-mono text-[9px] text-[#7f775f]">
                    {new Date(event.at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ol>
            {order.trackingNumber ? (
              <div className="mt-5 border-t border-dashed border-[#ece2c4]/18 pt-4 font-mono text-xs text-[#9dcf83]">
                Tracking: {order.trackingNumber}
              </div>
            ) : null}
          </section>

          <section className="border border-[#ece2c4]/18 p-6">
            <h2 className="font-display text-2xl uppercase tracking-[0.04em]">
              Requested offerings
            </h2>
            <ul className="mt-5 space-y-4">
              {order.items.map((item) => (
                <li
                  key={`${item.productSlug}-${item.variantId}`}
                  className="grid grid-cols-[62px_1fr_auto] gap-4 border-b border-dashed border-[#ece2c4]/16 pb-4"
                >
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="aspect-square w-[62px] object-cover"
                  />
                  <div>
                    <div className="text-sm text-[#f3ead0]">
                      {item.quantity} × {item.productName}
                    </div>
                    <div className="font-mono text-[9px] text-[#9f9676]">
                      {item.variantLabel}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-[#9dcf83]">
                    {item.lineSuggestedDonationCents
                      ? money(item.lineSuggestedDonationCents)
                      : 'Optional'}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="h-fit border border-[#9dcf83]/35 bg-[#11141a] p-6 lg:sticky lg:top-36">
          <PackageCheck size={26} className="text-[#9dcf83]" />
          <h2 className="font-display mt-4 text-3xl uppercase tracking-[0.03em]">
            Complete a donation
          </h2>
          <p className="mt-3 text-xs leading-6 text-[#aaa082]">
            This step happens directly in PayPal or Venmo. ORG verifies the
            matching memo manually.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(['paypal', 'venmo'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] ${
                  method === value
                    ? 'border-[#9dcf83] text-[#9dcf83]'
                    : 'border-[#ece2c4]/22 text-[#9f9676]'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#9f9676]">
              Donation amount
            </span>
            <div className="mt-2 flex border border-[#ece2c4]/22">
              <span className="grid w-10 place-items-center text-[#9f9676]">
                $
              </span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="w-full bg-transparent px-2 py-2.5 font-mono text-sm"
              />
            </div>
          </label>
          <div className="mt-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#9f9676]">
              Required memo
            </div>
            <button
              type="button"
              onClick={() => void copyMemo()}
              className="mt-2 flex w-full items-center justify-between border border-dashed border-[#9dcf83]/45 px-3 py-3 text-left font-mono text-[10px] text-[#f3ead0] hover:border-[#9dcf83]"
            >
              {order.donationMemo}
              {copied ? (
                <Check size={14} className="text-[#9dcf83]" />
              ) : (
                <Clipboard size={14} />
              )}
            </button>
          </div>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex w-full items-center justify-between bg-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0b0d12] no-underline hover:bg-[#b8e7a0]"
          >
            Open {method}
            <ExternalLink size={14} />
          </a>
          <button
            type="button"
            disabled={!reportable || reporting}
            onClick={() => void report()}
            className="mt-3 w-full border border-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9dcf83] hover:bg-[#9dcf83] hover:text-[#0b0d12] disabled:opacity-40"
          >
            {order.status === 'donation_reported'
              ? 'Update donation report'
              : reporting
                ? 'Recording…'
                : 'I sent this donation'}
          </button>
          <div className="mt-5 border-t border-dashed border-[#ece2c4]/18 pt-4 text-[10px] leading-5 text-[#7f775f]">
            Reporting a donation does not verify it. The host confirms it after
            checking the external account.
          </div>
        </aside>
      </div>

      <div className="mt-10 text-center">
        <Link
          to="/profile"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] no-underline"
        >
          Return to member profile
        </Link>
      </div>
    </>
  )
}
