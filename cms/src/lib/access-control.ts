/**
 * Access Control Helpers
 *
 * Centralized role-based access control for all collections.
 */

import type { Access, FieldAccess } from 'payload'

/**
 * Check if user is an admin (not read-only API user)
 */
export const isAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  // Admin role or no role (for backwards compatibility with existing admins)
  return user.role === 'admin' || !user.role
}

/**
 * Check if user is authenticated (any role)
 */
export const isAuthenticated: Access = ({ req: { user } }) => {
  return Boolean(user)
}

export const adminsOnly = {
  create: isAdmin,
  read: isAuthenticated,
  update: isAdmin,
  delete: isAdmin,
}

export const adminFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'admin' || !user.role
}
