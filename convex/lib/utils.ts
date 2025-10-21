import { ConvexError } from "convex/values"
import { QueryCtx, MutationCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { hasFullAccess } from "./permissions"

// Utility per ottenere l'utente corrente autenticato
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError("Authentication required")
  }
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
    .unique()
    
  if (!user) {
    throw new ConvexError("User not found")
  }
  
  return user
}

// Richiede utente autenticato e ritorna user + role
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx)
  const role = await ctx.db.get(user.roleId)
  if (!role) {
    throw new ConvexError("User role not found")
  }
  return { user, role }
}

// Richiede permesso specifico
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: string
) {
  const { user, role } = await requireUser(ctx)
  if (!role.permissions?.includes(permission) && !role.permissions?.includes("full_access")) {
    throw new ConvexError(`Permission denied: ${permission} required`)
  }
  return { user, role }
}

// Richiede ownership della risorsa
export async function requireOwnership(
  ctx: QueryCtx | MutationCtx,
  resourceUserId: Id<"users">,
  role: any
) {
  const { user } = await requireUser(ctx)
  if (user._id !== resourceUserId && !hasFullAccess(role)) {
    throw new ConvexError("Not authorized to access this resource")
  }
  return { user }
}

// Richiede appartenenza alla stessa clinica
export async function requireSameClinic(
  ctx: QueryCtx | MutationCtx,
  targetClinicId: Id<"clinics">
) {
  const { user } = await requireUser(ctx)
  if (user.clinicId !== targetClinicId) {
    throw new ConvexError("Access denied: different clinic")
  }
  return { user }
}

// Utility per verificare se un utente esiste
export async function getUserById(ctx: QueryCtx | MutationCtx, userId: string) {
  const user = await ctx.db.get(userId as any)
  if (!user) {
    throw new ConvexError("User not found")
  }
  return user
}

// Utility per verificare se una clinica esiste
export async function getClinicById(ctx: QueryCtx | MutationCtx, clinicId: string) {
  const clinic = await ctx.db.get(clinicId as any)
  if (!clinic) {
    throw new ConvexError("Clinic not found")
  }
  return clinic
}

// Utility per verificare se un ruolo esiste
export async function getRoleById(ctx: QueryCtx | MutationCtx, roleId: string) {
  const role = await ctx.db.get(roleId as any)
  if (!role) {
    throw new ConvexError("Role not found")
  }
  return role
}

// Utility per validare email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Utility per validare codice clinica (alfanumerico, 3-10 caratteri)
export function isValidClinicCode(code: string): boolean {
  const codeRegex = /^[A-Za-z0-9]{3,10}$/
  return codeRegex.test(code)
}

// Utility per generare slug da stringa
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Utility per calcolare deadline SLA
export function calculateSlaDeadline(hours: number): number {
  return Date.now() + (hours * 60 * 60 * 1000)
}

// Utility per verificare se SLA è scaduto
export function isSlaExpired(deadline?: number): boolean {
  if (!deadline) return false
  return Date.now() > deadline
}

// Utility per verificare se SLA è in scadenza (entro 2 ore)
export function isSlaExpiring(deadline?: number, warningHours: number = 2): boolean {
  if (!deadline) return false
  const warningTime = deadline - (warningHours * 60 * 60 * 1000)
  return Date.now() > warningTime && Date.now() < deadline
}