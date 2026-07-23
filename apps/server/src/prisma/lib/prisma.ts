import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/generated/prisma/client';
import 'dotenv/config';
const connectionString = `${process.env.PG_DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter, transactionOptions: { timeout: 10000 } });

export { adapter, prisma, Prisma };
