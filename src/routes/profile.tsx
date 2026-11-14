import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { LogOut, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { apiRequest, humanStatus, money } from '#/lib/api'
import type { MemberProfile, Order } from '#/lib/api'
import type { WebsiteCapabilities } from '#/lib/content-types'
import { useOrgAuth } from '#/lib/auth'
import { MemberGate } from '#/components/shop/MemberGate'
import { ProfileEditor } from '#/components/shop/ProfileEditor'
import { ShopShell } from '#/components/shop/ShopShell'
import { ProfileAdminLinks } from '#/components/shop/ProfileAdminLinks'

export const Route = createFileRoute('/profile')({
  head: () => ({
    meta: [
      { title: 'Member profile — ORG' },
      {
        name: 'description',
        content: 'Manage your ORG member details and offering requests.',
      },
    ],
  }),
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[1040px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/profile">
          <Profile />
        </MemberGate>
      </main>
    </ShopShell>
  )
}

function Profile() {
  const auth = useOrgAuth()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [capabilities, setCapabilities] = useState<WebsiteCapabilities | null>(
    null,
  )
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      const [nextProfile, nextOrders, nextCapabilities] = await Promise.all([
        apiRequest<MemberProfile>('/me', { token }),
        apiRequest<Order[]>('/orders', { token }),
        apiRequest<WebsiteCapabilities>('/me/capabilities', { token }).catch(
          () => null,
        ),
      ])
      setProfile(nextProfile)
      setOrders(nextOrders)
      setCapabilities(nextCapabilities)
      setEditing(
        !nextProfile.preferredName ||
          !nextProfile.email ||
          !nextProfile.contactHandle,
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Your profile did not load.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function removeShipping() {
    const token = await auth.getToken()
    if (!token) return
    const updated = await apiRequest<MemberProfile>('/me/shipping', {
      method: 'DELETE',
      token,
    })
    setProfile(updated)
  }

  if (loading) {
    return (
      <div className="grid min-h-72 place-items-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Opening the member record…
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="border border-[#c98b63]/50 p-5 text-[#e7c3a9]">
        {error || 'Member profile unavailable.'}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-5 border-b border-[#ece2c4]/18 pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9dcf83]">
            Member record
          </div>
          <h1 className="font-display mt-2 text-[clamp(52px,9vw,92px)] uppercase leading-[0.84] tracking-[0.01em] text-[#f6efd9]">
            {profile.preferredName || 'Complete profile'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void auth.logout()}
          className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#c98b63]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      {error ? (
        <div className="mt-6 border border-[#c98b63]/50 bg-[#c98b63]/10 p-4 text-sm text-[#e7c3a9]">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <section className="border border-[#ece2c4]/18 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#9f9676]">
                  Identity
                </div>
                <div className="mt-2 text-lg text-[#f3ead0]">
                  {profile.preferredName || auth.user?.name}
                </div>
                <div className="text-sm text-[#b8ad8d]">
                  {profile.email || auth.user?.email}
                </div>
              </div>
              <ShieldCheck size={20} className="text-[#9dcf83]" />
            </div>
            <div className="mt-5 border-t border-dashed border-[#ece2c4]/18 pt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-[#9f9676]">
              {profile.membershipType} member · {profile.contactMethod}
            </div>
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="mt-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#9dcf83]"
            >
              <Pencil size={12} /> {editing ? 'Close editor' : 'Edit profile'}
            </button>
          </section>

          <section className="border border-[#ece2c4]/18 p-6">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#9f9676]">
              Saved shipping
            </div>
            {profile.shippingAddress ? (
              <>
                <address className="mt-3 text-sm not-italic leading-6 text-[#b8ad8d]">
                  {profile.shippingAddress.recipientName}
                  <br />
                  {profile.shippingAddress.line1}
                  {profile.shippingAddress.line2 ? (
                    <>
                      <br />
                      {profile.shippingAddress.line2}
                    </>
                  ) : null}
                  <br />
                  {profile.shippingAddress.city},{' '}
                  {profile.shippingAddress.state}{' '}
                  {profile.shippingAddress.postalCode}
                </address>
                <button
                  type="button"
                  onClick={() => void removeShipping()}
                  className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[#c98b63]"
                >
                  <Trash2 size={12} /> Remove address
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#9f9676]">
                Add an address before requesting an offering.
              </p>
            )}
          </section>

          <Link
            to="/settings/notifications"
            className="block border border-[#ece2c4]/18 px-4 py-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[#9f9676] no-underline hover:border-[#9dcf83] hover:text-[#9dcf83]"
          >
            Email settings
          </Link>

          <ProfileAdminLinks capabilities={capabilities} />
        </aside>

        <div>
          {editing ? (
            <section className="border border-[#ece2c4]/18 p-6">
              <ProfileEditor
                profile={profile}
                onSaved={(saved) => {
                  setProfile(saved)
                  setEditing(false)
                }}
              />
            </section>
          ) : (
            <section>
              <div className="flex items-end justify-between border-b border-dashed border-[#ece2c4]/18 pb-4">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#9f9676]">
                    Offering history
                  </div>
                  <h2 className="font-display mt-1 text-3xl uppercase tracking-[0.04em]">
                    Your requests
                  </h2>
                </div>
                <Link
                  to="/offerings"
                  className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#9dcf83] no-underline"
                >
                  Browse offerings
                </Link>
              </div>
              {!orders.length ? (
                <div className="border-b border-[#ece2c4]/16 py-12 text-center text-sm text-[#9f9676]">
                  No requests yet.
                </div>
              ) : (
                <ul className="divide-y divide-[#ece2c4]/14">
                  {orders.map((order) => (
                    <li key={order._id}>
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: order._id }}
                        className="grid gap-3 py-5 text-inherit no-underline hover:bg-[#9dcf83]/[0.035] sm:grid-cols-[1fr_auto_auto]"
                      >
                        <div>
                          <div className="font-mono text-[10px] text-[#f3ead0]">
                            {order.orderNumber}
                          </div>
                          <div className="mt-1 text-xs text-[#9f9676]">
                            {order.items
                              .map((item) => item.productName)
                              .join(', ')}
                          </div>
                        </div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#9dcf83]">
                          {humanStatus(order.status)}
                        </div>
                        <div className="text-right font-mono text-[10px] text-[#b8ad8d]">
                          {money(order.suggestedTotalCents)}
                          <br />
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
