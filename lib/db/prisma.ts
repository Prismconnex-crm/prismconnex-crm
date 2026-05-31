import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });
}

// Ensure global.prisma is set in dev
if (process.env.NODE_ENV !== "production") {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
}

const client = global.prisma || createPrismaClient();

// Export a proxy that catches "Connection has not been opened" and automatically re-creates the client!
export const prisma = new Proxy(client, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    
    if (typeof value === "function" && !["$connect", "$disconnect"].includes(prop as string)) {
      return async function (...args: any[]) {
        try {
          return await value.apply(target, args);
        } catch (error: any) {
          const errMsg = error?.message || "";
          if (
            errMsg.includes("Connection has not been opened") ||
            errMsg.includes("engine is not running") ||
            errMsg.includes("Connection closed")
          ) {
            console.warn("⚠️ Prisma query engine connection lost. Re-initializing client...");
            const newClient = createPrismaClient();
            if (process.env.NODE_ENV !== "production") {
              global.prisma = newClient;
            }
            target = newClient;
            const newFunc = Reflect.get(newClient, prop);
            return await newFunc.apply(newClient, args);
          }
          throw error;
        }
      };
    }
    
    // For nested property access like prisma.company.findMany, wrap the model delegate dynamically
    if (value && typeof value === "object" && prop !== "_custom") {
      return new Proxy(value, {
        get(modelTarget, modelProp) {
          const modelValue = Reflect.get(modelTarget, modelProp);
          if (typeof modelValue === "function") {
            return async function (...args: any[]) {
              try {
                return await modelValue.apply(modelTarget, args);
              } catch (error: any) {
                const errMsg = error?.message || "";
                if (
                  errMsg.includes("Connection has not been opened") ||
                  errMsg.includes("engine is not running") ||
                  errMsg.includes("Connection closed")
                ) {
                  console.warn("⚠️ Prisma model query engine connection lost. Re-initializing client...");
                  const newClient = createPrismaClient();
                  if (process.env.NODE_ENV !== "production") {
                    global.prisma = newClient;
                  }
                  const freshModel = Reflect.get(newClient, prop);
                  const freshFunc = Reflect.get(freshModel, modelProp);
                  return await freshFunc.apply(freshModel, args);
                }
                throw error;
              }
            };
          }
          return modelValue;
        }
      });
    }

    return value;
  }
});
