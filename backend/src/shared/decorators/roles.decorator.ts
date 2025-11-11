import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/enums/access.enums';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Re-export UserRole for other modules
export { UserRole };
