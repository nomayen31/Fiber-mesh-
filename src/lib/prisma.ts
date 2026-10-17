import { PrismaClient } from "@prisma/client";

/**
 * Prisma is instantiated once and cached on `globalThis` so that Next.js
 * hot-reload in development does not open a new connection pool on every
 * render (which quickly exhausts Postgres connections).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** True when a database connection string has been configured. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Never throw a raw Prisma error at the user — log it and check the code. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
