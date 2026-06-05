import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Never touches the DB. */
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  /**
   * Readiness: the process can serve traffic — i.e. the DB is reachable.
   * Runs a cheap `SELECT 1`. Returns `{ status: 'ok', database: 'up' }` when the
   * DB answers, or throws so the controller can map it to a 503 and the load
   * balancer can route away from a dead-DB instance (A-21).
   */
  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
