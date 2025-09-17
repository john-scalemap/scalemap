import { AuthUser } from '@scalemap/shared';
import React from 'react';

interface RoleBasedComponentProps {
  user: AuthUser;
  allowedRoles?: string[];
  requiredPermissions?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions. If false, ANY permission is sufficient.
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Role-based component that conditionally renders children based on user roles and permissions
 */
export function RoleBasedComponent({
  user,
  allowedRoles,
  requiredPermissions,
  requireAll = false,
  children,
  fallback = null
}: RoleBasedComponentProps) {
  const hasRequiredRole = !allowedRoles || allowedRoles.includes(user.role);

  let hasRequiredPermissions = true;
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (requireAll) {
      // User must have ALL required permissions
      hasRequiredPermissions = requiredPermissions.every(permission =>
        user.permissions.includes(permission)
      );
    } else {
      // User must have ANY of the required permissions
      hasRequiredPermissions = requiredPermissions.some(permission =>
        user.permissions.includes(permission)
      );
    }
  }

  const hasAccess = hasRequiredRole && hasRequiredPermissions;

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

interface PermissionGateProps {
  permissions: string[];
  user: AuthUser;
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Simple permission gate component
 */
export function PermissionGate({
  permissions,
  user,
  requireAll = false,
  children,
  fallback = null
}: PermissionGateProps) {
  return (
    <RoleBasedComponent
      user={user}
      requiredPermissions={permissions}
      requireAll={requireAll}
      fallback={fallback}
    >
      {children}
    </RoleBasedComponent>
  );
}

interface RoleGateProps {
  roles: string[];
  user: AuthUser;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Simple role gate component
 */
export function RoleGate({
  roles,
  user,
  children,
  fallback = null
}: RoleGateProps) {
  return (
    <RoleBasedComponent
      user={user}
      allowedRoles={roles}
      fallback={fallback}
    >
      {children}
    </RoleBasedComponent>
  );
}

interface AdminOnlyProps {
  user: AuthUser;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Admin-only component shortcut
 */
export function AdminOnly({ user, children, fallback = null }: AdminOnlyProps) {
  return (
    <RoleGate roles={['admin']} user={user} fallback={fallback}>
      {children}
    </RoleGate>
  );
}