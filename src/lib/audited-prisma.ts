import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { setAuditContext } from "@/lib/audit";

type AuditActor = { id?: string; name?: string | null };
type Client = PrismaClient | Prisma.TransactionClient;

const AUDITED_MODELS = new Set([
  "person", "personAlias", "entityAttribute", "event", "personEvent", "parentChild",
  "partnership", "media", "mediaLink", "note", "tag", "tagLink", "place", "personPlace",
  "contact", "savedView", "user", "sourceFile", "importRun", "importIssue", "propertyArticle", "amendment",
]);

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/**
 * A request-scoped Prisma facade that places each write and its revision trigger
 * in the same transaction. Interactive transactions set the context once and
 * keep all callback writes together. Never store this facade between requests.
 */
export function auditedPrisma(actor: AuditActor, reason: string): PrismaClient {
  return createAuditedClient(prisma, actor, reason, false) as PrismaClient;
}

function createAuditedClient(client: Client, actor: AuditActor, reason: string, contextSet: boolean): Client {
  return new Proxy(client, {
    get(target, property) {
      if (property === "$transaction") {
        if (contextSet) return undefined;
        return (operation: unknown, options?: unknown) => {
          if (typeof operation !== "function") {
            throw new Error("Audited Prisma transactions must use an interactive callback.");
          }
          const prismaClient = target as PrismaClient;
          return prismaClient.$transaction(async (tx) => {
            await setAuditContext(tx, actor, reason);
            return operation(createAuditedClient(tx, actor, reason, true));
          }, options as Parameters<PrismaClient["$transaction"]>[1]);
        };
      }

      const value = Reflect.get(target, property, target) as unknown;
      if (!value || typeof value !== "object" || typeof property !== "string" || !AUDITED_MODELS.has(property)) {
        return typeof value === "function" ? value.bind(target) : value;
      }

      return new Proxy(value, {
        get(delegate, operation) {
          const method = Reflect.get(delegate, operation, delegate) as unknown;
          if (typeof operation !== "string" || typeof method !== "function") return method;
          if (!WRITE_OPERATIONS.has(operation)) return method.bind(delegate);

          return (...args: unknown[]) => {
            if (contextSet) return method.apply(delegate, args);
            const prismaClient = target as PrismaClient;
            return prismaClient.$transaction(async (tx) => {
              await setAuditContext(tx, actor, reason);
              const txMethod = modelDelegate(tx, property, operation);
              return txMethod(...args);
            });
          };
        },
      });
    },
  }) as Client;
}

function modelDelegate(tx: Prisma.TransactionClient, model: string, operation: string) {
  const delegate = (tx as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>)[model];
  const method = delegate?.[operation];
  if (!method) throw new Error(`Unsupported audited Prisma operation: ${model}.${operation}`);
  return method.bind(delegate);
}
