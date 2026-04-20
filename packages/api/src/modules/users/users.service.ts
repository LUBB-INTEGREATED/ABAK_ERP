import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    return {
      message: 'Users endpoint — to be implemented with Prisma (Issue #004)',
      users: [],
    };
  }
}
