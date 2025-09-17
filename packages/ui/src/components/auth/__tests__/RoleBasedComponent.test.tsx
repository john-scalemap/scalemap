import { AuthUser } from '@scalemap/shared';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { RoleBasedComponent, PermissionGate, RoleGate, AdminOnly } from '../RoleBasedComponent';


// Mock auth user data
const mockAdminUser: AuthUser = {
  id: 'user-123',
  email: 'admin@company.com',
  firstName: 'Admin',
  lastName: 'User',
  companyId: 'company-123',
  role: 'admin',
  emailVerified: true,
  permissions: [
    'company:read',
    'company:write',
    'assessments:read',
    'assessments:write',
    'users:read',
    'users:write'
  ]
};

const mockViewerUser: AuthUser = {
  id: 'user-456',
  email: 'viewer@company.com',
  firstName: 'Viewer',
  lastName: 'User',
  companyId: 'company-123',
  role: 'viewer',
  emailVerified: true,
  permissions: [
    'company:read',
    'assessments:read',
    'agents:read',
    'analytics:read'
  ]
};

const mockRegularUser: AuthUser = {
  id: 'user-789',
  email: 'user@company.com',
  firstName: 'Regular',
  lastName: 'User',
  companyId: 'company-123',
  role: 'user',
  emailVerified: true,
  permissions: [
    'company:read',
    'assessments:read',
    'assessments:write',
    'agents:read',
    'analytics:read'
  ]
};

describe('RoleBasedComponent', () => {
  it('should render children when user has required role', () => {
    render(
      <RoleBasedComponent
        user={mockAdminUser}
        allowedRoles={['admin']}
      >
        <div>Admin content</div>
      </RoleBasedComponent>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('should not render children when user lacks required role', () => {
    render(
      <RoleBasedComponent
        user={mockViewerUser}
        allowedRoles={['admin']}
      >
        <div>Admin content</div>
      </RoleBasedComponent>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('should render children when user has required permission', () => {
    render(
      <RoleBasedComponent
        user={mockAdminUser}
        requiredPermissions={['company:write']}
      >
        <div>Write access content</div>
      </RoleBasedComponent>
    );

    expect(screen.getByText('Write access content')).toBeInTheDocument();
  });

  it('should not render children when user lacks required permission', () => {
    render(
      <RoleBasedComponent
        user={mockViewerUser}
        requiredPermissions={['company:write']}
      >
        <div>Write access content</div>
      </RoleBasedComponent>
    );

    expect(screen.queryByText('Write access content')).not.toBeInTheDocument();
  });

  it('should require all permissions when requireAll is true', () => {
    render(
      <RoleBasedComponent
        user={mockAdminUser}
        requiredPermissions={['company:write', 'users:write']}
        requireAll={true}
      >
        <div>Multiple permissions content</div>
      </RoleBasedComponent>
    );

    expect(screen.getByText('Multiple permissions content')).toBeInTheDocument();
  });

  it('should fail when requireAll is true and user lacks one permission', () => {
    render(
      <RoleBasedComponent
        user={mockViewerUser}
        requiredPermissions={['company:read', 'company:write']}
        requireAll={true}
      >
        <div>Multiple permissions content</div>
      </RoleBasedComponent>
    );

    expect(screen.queryByText('Multiple permissions content')).not.toBeInTheDocument();
  });

  it('should pass when requireAll is false and user has any permission', () => {
    render(
      <RoleBasedComponent
        user={mockViewerUser}
        requiredPermissions={['company:read', 'company:write']}
        requireAll={false}
      >
        <div>Any permission content</div>
      </RoleBasedComponent>
    );

    expect(screen.getByText('Any permission content')).toBeInTheDocument();
  });

  it('should check both role and permissions', () => {
    render(
      <RoleBasedComponent
        user={mockAdminUser}
        allowedRoles={['admin']}
        requiredPermissions={['company:write']}
      >
        <div>Admin with write access</div>
      </RoleBasedComponent>
    );

    expect(screen.getByText('Admin with write access')).toBeInTheDocument();
  });

  it('should fail if user has role but not permission', () => {
    render(
      <RoleBasedComponent
        user={mockAdminUser}
        allowedRoles={['admin']}
        requiredPermissions={['billing:write']}
      >
        <div>Admin without billing access</div>
      </RoleBasedComponent>
    );

    expect(screen.queryByText('Admin without billing access')).not.toBeInTheDocument();
  });

  it('should render fallback when access is denied', () => {
    render(
      <RoleBasedComponent
        user={mockViewerUser}
        allowedRoles={['admin']}
        fallback={<div>Access denied</div>}
      >
        <div>Admin content</div>
      </RoleBasedComponent>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('should work with multiple allowed roles', () => {
    render(
      <RoleBasedComponent
        user={mockRegularUser}
        allowedRoles={['admin', 'user']}
      >
        <div>Admin or user content</div>
      </RoleBasedComponent>
    );

    expect(screen.getByText('Admin or user content')).toBeInTheDocument();
  });
});

describe('PermissionGate', () => {
  it('should render children when user has required permission', () => {
    render(
      <PermissionGate
        permissions={['company:read']}
        user={mockViewerUser}
      >
        <div>Read access content</div>
      </PermissionGate>
    );

    expect(screen.getByText('Read access content')).toBeInTheDocument();
  });

  it('should not render children when user lacks required permission', () => {
    render(
      <PermissionGate
        permissions={['company:write']}
        user={mockViewerUser}
      >
        <div>Write access content</div>
      </PermissionGate>
    );

    expect(screen.queryByText('Write access content')).not.toBeInTheDocument();
  });

  it('should handle requireAll parameter', () => {
    render(
      <PermissionGate
        permissions={['company:read', 'assessments:read']}
        user={mockViewerUser}
        requireAll={true}
      >
        <div>Multiple permissions content</div>
      </PermissionGate>
    );

    expect(screen.getByText('Multiple permissions content')).toBeInTheDocument();
  });

  it('should render fallback when permission check fails', () => {
    render(
      <PermissionGate
        permissions={['billing:write']}
        user={mockViewerUser}
        fallback={<div>Insufficient permissions</div>}
      >
        <div>Billing content</div>
      </PermissionGate>
    );

    expect(screen.queryByText('Billing content')).not.toBeInTheDocument();
    expect(screen.getByText('Insufficient permissions')).toBeInTheDocument();
  });
});

describe('RoleGate', () => {
  it('should render children when user has required role', () => {
    render(
      <RoleGate
        roles={['admin']}
        user={mockAdminUser}
      >
        <div>Admin role content</div>
      </RoleGate>
    );

    expect(screen.getByText('Admin role content')).toBeInTheDocument();
  });

  it('should not render children when user lacks required role', () => {
    render(
      <RoleGate
        roles={['admin']}
        user={mockViewerUser}
      >
        <div>Admin role content</div>
      </RoleGate>
    );

    expect(screen.queryByText('Admin role content')).not.toBeInTheDocument();
  });

  it('should handle multiple roles', () => {
    render(
      <RoleGate
        roles={['admin', 'user']}
        user={mockRegularUser}
      >
        <div>Admin or user content</div>
      </RoleGate>
    );

    expect(screen.getByText('Admin or user content')).toBeInTheDocument();
  });

  it('should render fallback when role check fails', () => {
    render(
      <RoleGate
        roles={['admin']}
        user={mockViewerUser}
        fallback={<div>Insufficient role</div>}
      >
        <div>Admin content</div>
      </RoleGate>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByText('Insufficient role')).toBeInTheDocument();
  });
});

describe('AdminOnly', () => {
  it('should render children for admin user', () => {
    render(
      <AdminOnly user={mockAdminUser}>
        <div>Admin only content</div>
      </AdminOnly>
    );

    expect(screen.getByText('Admin only content')).toBeInTheDocument();
  });

  it('should not render children for non-admin user', () => {
    render(
      <AdminOnly user={mockViewerUser}>
        <div>Admin only content</div>
      </AdminOnly>
    );

    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument();
  });

  it('should not render children for regular user', () => {
    render(
      <AdminOnly user={mockRegularUser}>
        <div>Admin only content</div>
      </AdminOnly>
    );

    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument();
  });

  it('should render fallback for non-admin user', () => {
    render(
      <AdminOnly
        user={mockViewerUser}
        fallback={<div>Admin access required</div>}
      >
        <div>Admin only content</div>
      </AdminOnly>
    );

    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument();
    expect(screen.getByText('Admin access required')).toBeInTheDocument();
  });
});