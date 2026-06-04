import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentMembersController } from './department-members.controller';
import { DepartmentsService } from './departments.service';
import { PermissionsCatalogController } from './permissions-catalog.controller';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  // AuthModule exports PermissionsService (used to invalidate the perm cache
  // whenever a role assignment or a role's permission set changes).
  imports: [AuthModule],
  controllers: [
    AdminUsersController,
    RolesController,
    PermissionsCatalogController,
    DepartmentsController,
    DepartmentMembersController,
  ],
  providers: [AdminUsersService, RolesService, DepartmentsService],
})
export class AdminModule {}
