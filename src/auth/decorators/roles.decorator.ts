import { SetMetadata } from '@nestjs/common';
import { roleEnum } from '../../user/enums/roleEnum.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: roleEnum[]) => SetMetadata(ROLES_KEY, roles);
