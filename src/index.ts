import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { cerbosAuthorize } from "@iof/service-core";

// Bun runtime type declaration for conditional execution
declare const Bun:
  | { serve: (options: { port: number; fetch: unknown }) => void }
  | undefined;

// ============================================================================
// Environment Guard — Demo/sandbox only
// Auth middleware intentionally omitted: this server runs exclusively in
// demo/sandbox environments (blocked in production by DEMO_SERVER_ENABLED).
// All demo endpoints return OBP-compatible sample data for integration testing.
// ============================================================================
const DEMO_SERVER_ENABLED =
  process.env.DEMO_SERVER_ENABLED !== "false" &&
  process.env.NODE_ENV !== "production";

if (!DEMO_SERVER_ENABLED) {
  process.stderr.write(
    JSON.stringify({
      service: "obp-demo-server",
      severity: "fatal",
      message:
        "OBP Demo Server is disabled in production. Set DEMO_SERVER_ENABLED=true to override.",
      timestamp: new Date().toISOString(),
    }) + "\n",
  );
  process.exit(1);
}

// ============================================================================
// Structured Audit Logger
// ============================================================================
function auditLog(
  action: string,
  details: Record<string, unknown>,
  requestId?: string,
): void {
  const log = {
    service: "obp-demo-server",
    env: process.env.NODE_ENV || "development",
    severity: "info" as const,
    action,
    request_id: requestId || "system",
    timestamp: new Date().toISOString(),
    ...details,
  };
  process.stdout.write(JSON.stringify(log) + "\n");
}

const app = new Hono();

// Enable CORS and logging
app.use("*", requestIdMiddleware);
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : [
          "https://islamicopenfinance.com",
          "http://localhost:3000",
          "http://localhost:3001",
        ],
    credentials: true,
  }),
);
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());
app.use("/obp/*", bodyLimit({ maxSize: 1024 * 1024 })); // 1MB body limit

// Audit logging middleware — log all data mutations
app.use("/obp/*", async (c, next) => {
  const method = c.req.method;
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    auditLog(
      "api_request",
      {
        method,
        path: c.req.path,
        user_agent: c.req.header("User-Agent"),
      },
      c.get("requestId") as string | undefined,
    );
  }
  await next();
});

// Global error handler — structured JSON, no stack traces to client
app.onError((_err, c) => {
  return c.json(
    {
      error: "Internal server error",
      requestId: c.get("requestId") || "unknown",
    },
    500,
  );
});

// In-memory store types — demo/sandbox only
interface DemoBank {
  id: string;
  short_name: string;
  full_name: string;
  logo: string;
  website: string;
  bank_routings: Array<{ scheme: string; address: string }>;
}

interface DemoAccount {
  id: string;
  bank_id: string;
  label: string;
  number: string;
  owners: Array<{ customer_id: string; linked_at: string }>;
  product_code: string;
  balance: { amount: string; currency: string };
  branch_id: string;
  account_routings: Array<{ scheme: string; address: string }>;
  views_available: Array<{
    id: string;
    short_name: string;
    is_public: boolean;
  }>;
  type: string;
  status: string;
  created_at: string;
}

interface DemoTransaction {
  id: string;
  bank_id: string;
  account_id: string;
  counterparty: unknown;
  details: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface DemoCustomer {
  customer_id: string;
  bank_id: string;
  customer_number: string;
  legal_name: string;
  mobile_phone_number: string;
  email: string;
  face_image: unknown;
  date_of_birth: string;
  relationship_status: string;
  dependants: number;
  dob_of_dependants: string[];
  highest_education_attained: string;
  employment_status: string;
  kyc_status: boolean;
  last_ok_date: string;
  title: string;
  branch_id: string;
  name_suffix: string;
}

interface DemoProduct {
  bank_id: string;
  product_code: string;
  name: string;
  category: string;
  super_family: string;
  family: string;
  more_info_url: string;
  details: string;
  description: string;
  meta: Record<string, unknown>;
}

// In-memory stores — demo/sandbox only (data lost on restart)
const banks = new Map<string, DemoBank>();
const accounts = new Map<string, DemoAccount>();
const transactions = new Map<string, DemoTransaction>();
const customers = new Map<string, DemoCustomer>();
const products = new Map<string, DemoProduct>();
const tokens = new Map<string, { userId: string; expiresAt: number }>();

// Initialize demo data
function initializeDemoData() {
  // Demo bank
  banks.set("iof-bank-001", {
    id: "iof-bank-001",
    short_name: "IOF Bank",
    full_name: "Islamic Open Finance Demo Bank",
    logo: "https://islamicopenfinance.com/logo.png",
    website: "https://islamicopenfinance.com",
    bank_routings: [
      { scheme: "BIC", address: "IOFBSARI" },
      { scheme: "IBAN", address: "SA00IOFB0000000000001" },
    ],
  });

  // Demo products
  const productTypes = [
    { id: "murabaha-001", name: "Murabaha Financing", category: "FINANCING" },
    { id: "ijarah-001", name: "Ijarah Lease", category: "LEASING" },
    {
      id: "musharakah-001",
      name: "Musharakah Partnership",
      category: "PARTNERSHIP",
    },
    { id: "sukuk-001", name: "Sukuk Investment", category: "INVESTMENT" },
    { id: "takaful-001", name: "Takaful Insurance", category: "INSURANCE" },
  ];

  productTypes.forEach((p) => {
    products.set(p.id, {
      bank_id: "iof-bank-001",
      product_code: p.id,
      name: p.name,
      category: p.category,
      super_family: "Islamic Finance",
      family: "Shariah Compliant",
      more_info_url: `https://islamicopenfinance.com/products/${p.id}`,
      details: `${p.name} - Shariah compliant financial product`,
      description: `A fully Shariah compliant ${p.name.toLowerCase()} product`,
      meta: { shariah_compliant: true, aaoifi_standard: "SS-8" },
    });
  });
}

initializeDemoData();

// Request validation schemas (defense-in-depth for demo/sandbox)
const createAccountSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  number: z.string().max(50).optional(),
  owners: z
    .array(z.object({ customer_id: z.string(), linked_at: z.string() }))
    .max(20)
    .optional(),
  product_code: z.string().max(100).optional(),
  balance: z.object({ currency: z.string().length(3) }).optional(),
  branch_id: z.string().max(100).optional(),
  type: z.string().max(50).optional(),
});

const createTransactionSchema = z.object({
  counterparty: z.unknown().optional(),
  type: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
  amount: z
    .object({
      amount: z
        .string()
        .regex(/^\d+(\.\d{1,4})?$/)
        .optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createCustomerSchema = z.object({
  customer_number: z.string().min(1).max(100).optional(),
  legal_name: z.string().min(1).max(500).optional(),
  mobile_phone_number: z.string().max(50).optional(),
  email: z.string().email().max(254).optional(),
  date_of_birth: z.string().max(20).optional(),
  title: z.string().max(50).optional(),
  branch_id: z.string().max(100).optional(),
  face_image: z.unknown().optional(),
  relationship_status: z.string().max(50).optional(),
  dependants: z.number().int().min(0).max(100).optional(),
  dob_of_dependants: z.array(z.string()).max(100).optional(),
  highest_education_attained: z.string().max(100).optional(),
  employment_status: z.string().max(100).optional(),
  kyc_status: z.boolean().optional(),
  name_suffix: z.string().max(50).optional(),
});

const startTime = Date.now();

// DirectLogin authentication
app.post("/obp/v5.1.0/my/logins/direct", async (c) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("DirectLogin")) {
    return c.json({ error: { message: "Invalid authorization header" } }, 401);
  }

  // Parse DirectLogin credentials
  const credentials = authHeader.replace("DirectLogin ", "");
  const params = Object.fromEntries(
    credentials.split(",").map((p) => {
      const [key, value] = p.split("=");
      return [key.trim(), value?.replace(/"/g, "").trim()];
    }),
  );

  // Generate token
  const token = `obp_token_${randomUUID()}`;
  tokens.set(token, {
    userId: params.username || "demo_user",
    expiresAt: Date.now() + 3600000, // 1 hour
  });

  return c.json({
    token,
    user: {
      user_id: params.username || "demo_user",
      email: `${params.username || "demo"}@islamicopenfinance.com`,
      provider_id: "iof",
      provider: "Islamic Open Finance",
    },
  });
});

// Get banks
app.get("/obp/v5.1.0/banks", (c) => {
  return c.json({
    banks: Array.from(banks.values()),
  });
});

app.get("/obp/v5.1.0/banks/:bankId", (c) => {
  const bank = banks.get(c.req.param("bankId"));
  if (!bank) {
    return c.json({ error: { message: "Bank not found" } }, 404);
  }
  return c.json(bank);
});

// Account operations
app.post(
  "/obp/v5.1.0/banks/:bankId/accounts",
  cerbosAuthorize({ resourceKind: "obp", actions: ["obp:write"] }),
  async (c) => {
    const bankId = c.req.param("bankId");
    const raw = await c.req.json();
    const parsed = createAccountSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: "Invalid request body",
            details: parsed.error.issues,
          },
        },
        400,
      );
    }
    const body = parsed.data;

    const accountId = `acc_${randomUUID().substring(0, 8)}`;
    const account = {
      id: accountId,
      bank_id: bankId,
      label: body.label || "New Account",
      number: body.number || `IOF${Date.now()}`,
      owners: body.owners || [],
      product_code: body.product_code || "current",
      balance: { amount: "0.00", currency: body.balance?.currency || "USD" },
      branch_id: body.branch_id || "main",
      account_routings: [
        { scheme: "IBAN", address: `SA00IOFB${accountId.toUpperCase()}` },
      ],
      views_available: [{ id: "owner", short_name: "Owner", is_public: false }],
      type: body.type || "CURRENT",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    };

    accounts.set(accountId, account);

    return c.json(account, 201);
  },
);

app.get("/obp/v5.1.0/banks/:bankId/accounts", (c) => {
  const bankId = c.req.param("bankId");
  const bankAccounts = Array.from(accounts.values()).filter(
    (a) => a.bank_id === bankId,
  );

  return c.json({ accounts: bankAccounts });
});

app.get("/obp/v5.1.0/banks/:bankId/accounts/:accountId", (c) => {
  const account = accounts.get(c.req.param("accountId"));
  if (!account) {
    return c.json({ error: { message: "Account not found" } }, 404);
  }
  return c.json(account);
});

app.get("/obp/v5.1.0/my/accounts", (c) => {
  return c.json({ accounts: Array.from(accounts.values()) });
});

app.put(
  "/obp/v5.1.0/banks/:bankId/accounts/:accountId/close",
  cerbosAuthorize({ resourceKind: "obp", actions: ["obp:write"] }),
  (c) => {
    const account = accounts.get(c.req.param("accountId"));
    if (!account) {
      return c.json({ error: { message: "Account not found" } }, 404);
    }
    account.status = "CLOSED";
    return c.json({ message: "Account closed successfully" });
  },
);

// Transaction operations
app.post(
  "/obp/v5.1.0/banks/:bankId/accounts/:accountId/transactions",
  cerbosAuthorize({ resourceKind: "obp", actions: ["obp:write"] }),
  async (c) => {
    const accountId = c.req.param("accountId");
    const raw = await c.req.json();
    const parsed = createTransactionSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: "Invalid request body",
            details: parsed.error.issues,
          },
        },
        400,
      );
    }
    const body = parsed.data;

    const transactionId = `txn_${randomUUID().substring(0, 8)}`;
    const transaction = {
      id: transactionId,
      bank_id: c.req.param("bankId"),
      account_id: accountId,
      counterparty: body.counterparty || null,
      details: {
        type: body.type || "TRANSFER",
        description: body.description || "Transaction",
        posted: new Date().toISOString(),
        completed: new Date().toISOString(),
        new_balance: {
          amount: body.amount?.amount || "0.00",
          currency: body.amount?.currency || "USD",
        },
        value: {
          amount: body.amount?.amount || "0.00",
          currency: body.amount?.currency || "USD",
        },
      },
      metadata: body.metadata || {},
    };

    transactions.set(transactionId, transaction);

    return c.json(transaction, 201);
  },
);

app.get("/obp/v5.1.0/banks/:bankId/accounts/:accountId/transactions", (c) => {
  const accountId = c.req.param("accountId");
  const accountTransactions = Array.from(transactions.values()).filter(
    (t) => t.account_id === accountId,
  );

  return c.json({ transactions: accountTransactions });
});

app.get(
  "/obp/v5.1.0/banks/:bankId/accounts/:accountId/transactions/:transactionId",
  (c) => {
    const transaction = transactions.get(c.req.param("transactionId"));
    if (!transaction) {
      return c.json({ error: { message: "Transaction not found" } }, 404);
    }
    return c.json(transaction);
  },
);

// Customer operations
app.post(
  "/obp/v5.1.0/banks/:bankId/customers",
  cerbosAuthorize({ resourceKind: "obp", actions: ["obp:write"] }),
  async (c) => {
    const bankId = c.req.param("bankId");
    const raw = await c.req.json();
    const parsed = createCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: "Invalid request body",
            details: parsed.error.issues,
          },
        },
        400,
      );
    }
    const body = parsed.data;

    const customerId = `cust_${randomUUID().substring(0, 8)}`;
    const customer = {
      customer_id: customerId,
      bank_id: bankId,
      customer_number: body.customer_number || `CUST${Date.now()}`,
      legal_name: body.legal_name || "Customer",
      mobile_phone_number: body.mobile_phone_number || "",
      email: body.email || "",
      face_image: body.face_image || null,
      date_of_birth: body.date_of_birth || "",
      relationship_status: body.relationship_status || "",
      dependants: body.dependants || 0,
      dob_of_dependants: body.dob_of_dependants || [],
      highest_education_attained: body.highest_education_attained || "",
      employment_status: body.employment_status || "",
      kyc_status: body.kyc_status || false,
      last_ok_date: new Date().toISOString(),
      title: body.title || "",
      branch_id: body.branch_id || "main",
      name_suffix: body.name_suffix || "",
    };

    customers.set(customerId, customer);

    return c.json(customer, 201);
  },
);

app.get("/obp/v5.1.0/banks/:bankId/customers", (c) => {
  const bankId = c.req.param("bankId");
  const bankCustomers = Array.from(customers.values()).filter(
    (cu) => cu.bank_id === bankId,
  );

  return c.json({ customers: bankCustomers });
});

app.get("/obp/v5.1.0/banks/:bankId/customers/:customerId", (c) => {
  const customer = customers.get(c.req.param("customerId"));
  if (!customer) {
    return c.json({ error: { message: "Customer not found" } }, 404);
  }
  return c.json(customer);
});

app.post(
  "/obp/v5.1.0/banks/:bankId/accounts/:accountId/link-customer",
  cerbosAuthorize({ resourceKind: "obp", actions: ["obp:write"] }),
  async (c) => {
    const accountId = c.req.param("accountId");
    const body = await c.req.json();

    const account = accounts.get(accountId);
    if (!account) {
      return c.json({ error: { message: "Account not found" } }, 404);
    }

    const customer = customers.get(body.customer_id);
    if (!customer) {
      return c.json({ error: { message: "Customer not found" } }, 404);
    }

    // Link customer to account
    if (!account.owners) account.owners = [];
    account.owners.push({
      customer_id: customer.customer_id,
      linked_at: new Date().toISOString(),
    });

    return c.json({
      message: "Customer linked to account successfully",
      account_id: accountId,
      customer_id: customer.customer_id,
    });
  },
);

// Product operations
app.get("/obp/v5.1.0/banks/:bankId/products", (c) => {
  const bankId = c.req.param("bankId");
  const bankProducts = Array.from(products.values()).filter(
    (p) => p.bank_id === bankId,
  );

  return c.json({ products: bankProducts });
});

app.get("/obp/v5.1.0/banks/:bankId/products/:productCode", (c) => {
  const product = products.get(c.req.param("productCode"));
  if (!product) {
    return c.json({ error: { message: "Product not found" } }, 404);
  }
  return c.json(product);
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: "obp-demo-server",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    stats: {
      banks: banks.size,
      accounts: accounts.size,
      transactions: transactions.size,
      customers: customers.size,
      products: products.size,
    },
  });
});

// Readiness check - verifies service is ready to accept traffic
app.get("/health/ready", (c) => {
  const memUsage = process.memoryUsage();
  const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const memoryHealthy = heapPercentage < 90;
  const dataInitialized = banks.size > 0 && products.size > 0;

  const isReady = memoryHealthy && dataInitialized;
  const status = isReady ? "healthy" : "degraded";

  return c.json(
    {
      status,
      service: "obp-demo-server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        memory: {
          status: memoryHealthy ? "healthy" : "degraded",
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        dataStore: {
          status: dataInitialized ? "healthy" : "initializing",
          banks: banks.size,
          products: products.size,
        },
      },
    },
    isReady ? 200 : 503,
  );
});

// Liveness check - indicates if the process is running
app.get("/health/live", (c) => {
  return c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// API info
app.get("/", (c) => {
  return c.json({
    name: "Open Bank Project Demo Server",
    version: "5.1.0",
    description: "Demo OBP API for Islamic Open Finance development",
    endpoints: {
      banks: "/obp/v5.1.0/banks",
      accounts: "/obp/v5.1.0/banks/{bankId}/accounts",
      transactions:
        "/obp/v5.1.0/banks/{bankId}/accounts/{accountId}/transactions",
      customers: "/obp/v5.1.0/banks/{bankId}/customers",
      products: "/obp/v5.1.0/banks/{bankId}/products",
      auth: "/obp/v5.1.0/my/logins/direct",
    },
  });
});

// Start server
const port = parseInt(
  process.env.OBP_MOCK_PORT || process.env.PORT || "3005",
  10,
);

export default {
  port,
  fetch: app.fetch,
};

// For direct execution
if (typeof Bun !== "undefined") {
  Bun.serve({
    port,
    fetch: app.fetch,
  });
} else {
  // Node.js fallback
  import("@hono/node-server").then(({ serve }) => {
    serve({ fetch: app.fetch, port });
  });
}
