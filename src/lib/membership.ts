export type MembershipType = 'public' | 'private' | 'anonymous'

export interface Member {
  id: string
  name: string
  email: string
  type: MembershipType
  contactMethod: 'email' | 'signal' | 'telegram'
  contactHandle: string
  beliefsSummary: string
  joinedAt: string
}

const STORAGE_KEY = 'org-members'
const CURRENT_USER_KEY = 'org-current-user'

function loadMembers(): Member[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMembers(members: Member[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
}

function loadCurrentUser(): Member | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveCurrentUser(member: Member | null) {
  if (member) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(member))
  } else {
    localStorage.removeItem(CURRENT_USER_KEY)
  }
}

export function getCurrentUser(): Member | null {
  return loadCurrentUser()
}

export function login(email: string, _password: string): Member | null {
  const members = loadMembers()
  const member = members.find(
    (m) => m.email.toLowerCase() === email.toLowerCase(),
  )
  if (member) {
    saveCurrentUser(member)
    return member
  }
  return null
}

export function logout() {
  saveCurrentUser(null)
}

export function createMember(data: {
  name: string
  email: string
  type: MembershipType
  contactMethod: 'email' | 'signal' | 'telegram'
  contactHandle: string
  beliefsSummary: string
}): Member {
  const members = loadMembers()

  // Prevent duplicate emails for demo
  if (members.some((m) => m.email.toLowerCase() === data.email.toLowerCase())) {
    // If already exists, just log them in
    const existing = members.find(
      (m) => m.email.toLowerCase() === data.email.toLowerCase(),
    )!
    saveCurrentUser(existing)
    return existing
  }

  const newMember: Member = {
    id: 'm_' + Date.now().toString(36),
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    type: data.type,
    contactMethod: data.contactMethod,
    contactHandle: data.contactHandle.trim(),
    beliefsSummary: data.beliefsSummary.trim(),
    joinedAt: new Date().toISOString(),
  }

  members.push(newMember)
  saveMembers(members)
  saveCurrentUser(newMember)
  return newMember
}

export function submitBelief(beliefText: string): boolean {
  const user = getCurrentUser()
  if (!user) return false

  const key = `org-beliefs-${user.id}`
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.unshift({
    id: 'b_' + Date.now(),
    text: beliefText.trim(),
    date: new Date().toISOString(),
  })
  localStorage.setItem(key, JSON.stringify(existing))
  return true
}

export function getMyBeliefs(): Array<{
  id: string
  text: string
  date: string
}> {
  const user = getCurrentUser()
  if (!user) return []
  const key = `org-beliefs-${user.id}`
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}
