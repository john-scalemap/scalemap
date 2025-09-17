# Role-Based Access Control Expansion Patterns

This document outlines the RBAC framework design and expansion patterns for future multi-user support in ScaleMap.

## Current MVP Implementation

### System Roles
- **Admin**: Full company access, single user per company
- **User**: Standard assessment access (reserved for future use)
- **Viewer**: Read-only access (reserved for future use)

### Key Constraints
- Single user per company for MVP
- All users have 'admin' role by default
- Company-scoped permissions only

## Database Schema for Role Expansion

### Current Structure
```
User Record:
PK: USER#{userId}
SK: METADATA
GSI1PK: USER#{cognitoUserId}  (for auth lookups)
GSI1SK: COMPANY#{companyId}
Data: { role: 'admin', status: 'active', ... }
```

### Future Multi-User Structure
```
Company Roles:
PK: COMPANY#{companyId}
SK: ROLE#{roleId}
Data: { name, description, permissions[], customPermissions?, isActive: true }

User-Role Assignments:
PK: USER#{userId}
SK: ROLE#{roleId}
GSI2PK: COMPANY#{companyId}#ROLES
GSI2SK: USER#{userId}
Data: { assignedAt, assignedBy, expiresAt?, conditions? }

Role Hierarchies (Future):
PK: COMPANY#{companyId}
SK: ROLE_HIERARCHY#{parentRoleId}#{childRoleId}
Data: { inheritanceType: 'full' | 'partial', restrictions? }
```

## Expansion Phases

### Phase 1: Multi-User Support (Post-MVP)
1. **Remove single-user constraint**
2. **Add user invitation system**
3. **Implement role assignment UI**
4. **Add user management for admins**

Required Changes:
- Remove `validateSingleUserPerCompany` constraint
- Add invitation Lambda functions
- Create user management interface
- Update billing to support multiple users

### Phase 2: Custom Roles
1. **Company-specific role creation**
2. **Permission customization**
3. **Role templates**

Required Changes:
- Add role management Lambda functions
- Create role editor UI
- Implement custom permission validation
- Add role audit logging

### Phase 3: Advanced RBAC
1. **Resource-level permissions**
2. **Conditional access rules**
3. **Time-based access**
4. **Role hierarchies**

Required Changes:
- Resource-specific permission checks
- Condition evaluation engine
- Scheduled access management
- Hierarchy inheritance logic

## Permission System Architecture

### Current Permissions
```typescript
// Resource-based permissions
'company:read' | 'company:write' | 'company:delete'
'assessments:read' | 'assessments:write' | 'assessments:delete'
'agents:read' | 'agents:write' | 'agents:delete'
'users:read' | 'users:write' | 'users:delete'
'analytics:read'
'billing:read' | 'billing:write'
```

### Future Permission Patterns
```typescript
// Granular resource permissions
'assessments:create' | 'assessments:read' | 'assessments:update' | 'assessments:delete'
'assessments:share' | 'assessments:export' | 'assessments:archive'

// Conditional permissions
'assessments:read:own' | 'assessments:read:team' | 'assessments:read:all'
'users:invite:department' | 'users:manage:junior_roles'

// Resource-specific permissions
'assessment:{id}:read' | 'project:{id}:write'
'department:{id}:manage' | 'team:{id}:lead'
```

## Migration Strategy

### Database Migration for Multi-User
```typescript
// Migration script outline
async function migrateToMultiUser() {
  // 1. Create role assignments for existing users
  const companies = await getExistingCompanies();

  for (const company of companies) {
    const users = await getUsersByCompany(company.id);

    // All existing users become admins
    for (const user of users) {
      await createRoleAssignment(user.id, 'admin', company.id);
    }
  }

  // 2. Update JWT generation to include role assignments
  // 3. Update auth middleware to handle multiple roles per user
  // 4. Add role validation to all endpoints
}
```

### API Compatibility
- Current JWT structure remains compatible
- New fields added without breaking existing flows
- Gradual migration of endpoints to new permission checks

## Frontend Architecture for Role Management

### Component Structure
```
/components/admin/
  ├── UserManagement/
  │   ├── UserList.tsx
  │   ├── UserInvite.tsx
  │   └── UserRoleEditor.tsx
  ├── RoleManagement/
  │   ├── RoleList.tsx
  │   ├── RoleEditor.tsx
  │   └── PermissionMatrix.tsx
  └── AccessControl/
      ├── RoleBasedNavigation.tsx
      └── PermissionGates.tsx
```

### State Management
```typescript
// Zustand store structure for RBAC
interface RBACStore {
  currentUser: AuthUser;
  availableRoles: Role[];
  companyUsers: CompanyUser[];
  permissions: Permission[];

  // Actions
  assignRole: (userId: string, roleId: string) => Promise<void>;
  revokeRole: (userId: string, roleId: string) => Promise<void>;
  createCustomRole: (roleData: CreateRoleRequest) => Promise<void>;
  updatePermissions: (roleId: string, permissions: string[]) => Promise<void>;
}
```

## Security Considerations

### Permission Validation
- Server-side validation on every request
- JWT contains minimal role info, full permissions loaded server-side
- Role changes invalidate existing tokens
- Audit logging for all permission changes

### Attack Prevention
- Rate limiting on role management endpoints
- Input validation for custom permissions
- Prevent privilege escalation (users can't assign roles higher than their own)
- Company isolation enforced at database level

## Testing Strategy for RBAC

### Unit Tests
- Permission checking logic
- Role inheritance calculations
- Resource access validation

### Integration Tests
- Multi-user invitation flows
- Role assignment and revocation
- Cross-company access prevention

### End-to-End Tests
- Complete user management workflows
- Permission boundary testing
- Role-based UI rendering

## Monitoring and Analytics

### Metrics to Track
- Permission denial rates by resource
- Role distribution across companies
- Custom role adoption rates
- Access pattern analysis

### Alerts
- Unusual permission escalation attempts
- Failed authorization spikes
- Orphaned role assignments
- Cross-company access attempts

## Implementation Checklist for Phase 1

- [ ] Remove single user per company constraint
- [ ] Create user invitation system
- [ ] Add user management Lambda functions
- [ ] Build user management UI components
- [ ] Update authentication flows for multi-user
- [ ] Add role-based navigation
- [ ] Implement user audit logging
- [ ] Update billing for multiple users
- [ ] Create admin onboarding flow
- [ ] Add user deactivation/suspension features

This framework provides a clear path for expanding from the current single-user MVP to a full multi-user RBAC system while maintaining security and data isolation.