export type ProductCategory =
  'vaporizer-accessories' | '3d-printed-parts' | 'laboratory-tools'

export interface ProductVariant {
  id: string
  label: string
  suggestedDonationCents?: number
  options: Record<string, string>
}

export interface Product {
  _id: string
  slug: string
  name: string
  category: ProductCategory
  summary: string
  description: string
  specifications: string[]
  imageUrl: string
  imageAlt: string
  availability: 'active' | 'made-to-order' | 'paused'
  variants: ProductVariant[]
}

export interface CartLine {
  itemId: string
  productSlug: string
  productName: string
  imageUrl: string
  imageAlt: string
  variantId: string
  variantLabel: string
  quantity: number
  note?: string
  unitSuggestedDonationCents: number
  lineSuggestedDonationCents: number
}

export interface Cart {
  id: string
  items: CartLine[]
  suggestedItemsCents: number
  suggestedShippingCents: number
  suggestedTotalCents: number
  updatedAt?: string
}

export interface ShippingAddress {
  recipientName: string
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: 'US'
  phone?: string
}

export interface MemberProfile {
  _id?: string
  auth0Sub: string
  authEmail?: string
  authEmailVerified: boolean
  isAdmin: boolean
  preferredName: string
  email: string
  membershipType: 'public' | 'private' | 'anonymous'
  contactMethod: 'email' | 'signal' | 'telegram'
  contactHandle: string
  beliefsSummary: string
  shippingAddress?: ShippingAddress
}

export type OrderStatus =
  | 'awaiting_donation'
  | 'donation_reported'
  | 'donation_confirmed'
  | 'preparing'
  | 'shipped'
  | 'completed'
  | 'cancelled'

export interface Order {
  _id: string
  orderNumber: string
  donationMemo: string
  items: Array<{
    productSlug: string
    productName: string
    variantId: string
    variantLabel: string
    quantity: number
    note?: string
    unitSuggestedDonationCents: number
    lineSuggestedDonationCents: number
    imageUrl: string
  }>
  contact: {
    preferredName: string
    email: string
    contactMethod: string
    contactHandle: string
  }
  shippingAddress: ShippingAddress
  suggestedItemsCents: number
  suggestedShippingCents: number
  suggestedTotalCents: number
  declaredDonationCents?: number
  status: OrderStatus
  statusHistory: Array<{
    status: OrderStatus
    at: string
    actor: 'member' | 'admin' | 'system'
  }>
  donationReport?: {
    method: 'paypal' | 'venmo'
    amountCents?: number
    reportedAt: string
  }
  trackingNumber?: string
  createdAt: string
  updatedAt: string
}

export interface DonationConfig {
  currency: 'USD'
  suggestedShippingCents: number
  paypalUrl: string
  venmoUrl: string
  paypalHandle: string
  venmoHandle: string
  verification: 'manual'
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The server's machine-readable reason, when it sends one. */
    readonly code?: string,
  ) {
    super(message)
  }
}

type ApiOptions = RequestInit & {
  token?: string
  guestToken?: string
  /** Give up after this long. Opt-in: no other caller's behaviour changes. */
  timeoutMs?: number
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { token, guestToken, headers, timeoutMs, ...init } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(guestToken ? { 'X-Cart-Token': guestToken } : {}),
      ...headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`
    let code: string | undefined
    try {
      const payload = (await response.json()) as {
        message?: string | string[]
        code?: string
      }
      code = payload.code
      if (Array.isArray(payload.message)) message = payload.message.join(' ')
      else if (payload.message) message = payload.message
    } catch {
      // Keep the status-based message when the API did not return JSON.
    }
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function money(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function humanStatus(status: OrderStatus) {
  return status.replaceAll('_', ' ')
}
