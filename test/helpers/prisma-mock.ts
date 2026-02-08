/**
 * Prisma Mock Helper
 *
 * Creates a deeply-mocked PrismaService for unit tests.
 * Every model delegate (user, moodEntry, etc.) returns jest mocks.
 */
import { PrismaService } from '../../src/prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export type MockPrisma = DeepMockProxy<PrismaService>;

export function createMockPrisma(): MockPrisma {
  return mockDeep<PrismaService>();
}
