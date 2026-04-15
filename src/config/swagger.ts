import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

const bearerSecurityScheme = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
};

const commonSuccess = {
  success: true,
};

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Echolalax Global API",
    version: "1.0.0",
    description:
      "REST API documentation for the Echolalax Global backend built with Node.js, Express, TypeScript, and MongoDB.",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local development server",
    },
  ],
  tags: [
    { name: "Health", description: "Service health checks" },
    { name: "Auth", description: "Authentication and identity endpoints" },
    { name: "User", description: "Protected user dashboard endpoints" },
    { name: "Admin", description: "Protected admin portal endpoints" },
  ],
  components: {
    securitySchemes: bearerSecurityScheme,
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Authentication required" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Jane Doe" },
          email: { type: "string", format: "email", example: "jane@example.com" },
          password: { type: "string", format: "password", example: "StrongPassword123" },
          phone: { type: "string", example: "+2348000000000" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@example.com" },
          password: { type: "string", format: "password", example: "StrongPassword123" },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "jane@example.com" },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          id: { type: "string", example: "661d31f2c1d87c738baf2131" },
          name: { type: "string", example: "Jane Doe" },
          email: { type: "string", example: "jane@example.com" },
          phone: { type: "string", nullable: true, example: "+2348000000000" },
          avatar: { type: "string", nullable: true, example: "https://example.com/avatar.png" },
          role: { type: "string", enum: ["user", "admin"], example: "user" },
          status: { type: "string", enum: ["active", "suspended", "banned"], example: "active" },
          walletBalance: { type: "number", example: 2500 },
          monthlySpend: { type: "number", example: 1500 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Login successful" },
          data: {
            type: "object",
            properties: {
              token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
              user: { $ref: "#/components/schemas/AuthUser" },
            },
          },
        },
      },
      AutomationRequest: {
        type: "object",
        required: ["serviceName", "planName", "amount"],
        properties: {
          serviceName: { type: "string", example: "Data Subscription" },
          provider: { type: "string", example: "MTN" },
          planName: { type: "string", example: "2GB Monthly Plan" },
          amount: { type: "number", example: 1500 },
          frequency: { type: "string", enum: ["daily", "weekly", "monthly", "custom"], example: "monthly" },
          nextRunAt: { type: "string", format: "date-time" },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      AutomationStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["active", "paused"], example: "paused" },
        },
      },
      ProfileUpdateRequest: {
        type: "object",
        properties: {
          name: { type: "string", example: "Jane Doe" },
          phone: { type: "string", example: "+2348000000000" },
          avatar: { type: "string", example: "https://example.com/avatar.png" },
        },
      },
      PasswordChangeRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", format: "password" },
          newPassword: { type: "string", format: "password" },
        },
      },
      WalletFundRequest: {
        type: "object",
        required: ["amount"],
        properties: {
          amount: { type: "number", example: 5000 },
        },
      },
      UserStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["active", "suspended", "banned"], example: "suspended" },
        },
      },
      MessageReplyRequest: {
        type: "object",
        required: ["replyMessage"],
        properties: {
          replyMessage: { type: "string", example: "We have received your request and are working on it." },
        },
      },
      SettingsUpdateRequest: {
        type: "object",
        properties: {
          platformName: { type: "string", example: "Echolalax Global" },
          defaultCurrency: { type: "string", example: "NGN" },
          supportEmail: { type: "string", format: "email", example: "support@example.com" },
          maintenanceMode: { type: "boolean", example: false },
        },
      },
      NotificationRequest: {
        type: "object",
        required: ["title", "message", "channel"],
        properties: {
          title: { type: "string", example: "System Update" },
          message: { type: "string", example: "We will be undergoing maintenance tonight." },
          channel: { type: "string", enum: ["email", "push", "in_app"], example: "email" },
          audience: { type: "string", enum: ["all", "users", "admins"], example: "all" },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "Echo backend is running" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Account created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate a user or admin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout the current user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Logout successful",
          },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the authenticated profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Current session profile",
          },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Initiate password reset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Reset flow initiated",
          },
        },
      },
    },
    "/api/user/overview": {
      get: {
        tags: ["User"],
        summary: "Get user dashboard overview",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Overview retrieved" },
        },
      },
    },
    "/api/user/transactions": {
      get: {
        tags: ["User"],
        summary: "Get wallet and billing transactions",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", example: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", example: 10 } },
        ],
        responses: {
          "200": { description: "Transactions retrieved" },
        },
      },
    },
    "/api/user/wallet/fund": {
      post: {
        tags: ["User"],
        summary: "Initialize wallet funding",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WalletFundRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Funding initialized" },
        },
      },
    },
    "/api/user/automations": {
      get: {
        tags: ["User"],
        summary: "List user automations",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Automations retrieved" },
        },
      },
      post: {
        tags: ["User"],
        summary: "Create a new automation",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AutomationRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Automation created" },
        },
      },
    },
    "/api/user/automations/{id}": {
      get: {
        tags: ["User"],
        summary: "Get one automation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        responses: {
          "200": { description: "Automation retrieved" },
        },
      },
      delete: {
        tags: ["User"],
        summary: "Cancel an automation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        responses: {
          "200": { description: "Automation cancelled" },
        },
      },
    },
    "/api/user/automations/{id}/status": {
      put: {
        tags: ["User"],
        summary: "Pause or resume an automation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AutomationStatusRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Automation status updated" },
        },
      },
    },
    "/api/user/profile": {
      get: {
        tags: ["User"],
        summary: "Get profile details",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Profile retrieved" },
        },
      },
      put: {
        tags: ["User"],
        summary: "Update profile details",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProfileUpdateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Profile updated" },
        },
      },
    },
    "/api/user/password": {
      put: {
        tags: ["User"],
        summary: "Change the current password",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PasswordChangeRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Password changed" },
        },
      },
    },
    "/api/admin/overview": {
      get: {
        tags: ["Admin"],
        summary: "Get admin overview metrics",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Admin overview retrieved" },
        },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List all users",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "search", schema: { type: "string", example: "jane" } },
          { in: "query", name: "page", schema: { type: "integer", example: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", example: 10 } },
        ],
        responses: {
          "200": { description: "Users retrieved" },
        },
      },
    },
    "/api/admin/users/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Get a single user detail",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        responses: {
          "200": { description: "User detail retrieved" },
        },
      },
    },
    "/api/admin/users/{id}/status": {
      put: {
        tags: ["Admin"],
        summary: "Update user account status",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserStatusRequest" },
            },
          },
        },
        responses: {
          "200": { description: "User status updated" },
        },
      },
    },
    "/api/admin/automations": {
      get: {
        tags: ["Admin"],
        summary: "List platform automations",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "service", schema: { type: "string", example: "Data" } },
          { in: "query", name: "status", schema: { type: "string", example: "active" } },
        ],
        responses: {
          "200": { description: "Automations retrieved" },
        },
      },
    },
    "/api/admin/messages": {
      get: {
        tags: ["Admin"],
        summary: "List support messages",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Messages retrieved" },
        },
      },
    },
    "/api/admin/messages/{id}/resolve": {
      put: {
        tags: ["Admin"],
        summary: "Resolve a support message",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        responses: {
          "200": { description: "Message resolved" },
        },
      },
    },
    "/api/admin/messages/{id}/reply": {
      post: {
        tags: ["Admin"],
        summary: "Reply to a support message",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", example: "661d31f2c1d87c738baf2131" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageReplyRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Reply recorded" },
        },
      },
    },
    "/api/admin/logs": {
      get: {
        tags: ["Admin"],
        summary: "List audit logs",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Logs retrieved" },
        },
      },
    },
    "/api/admin/settings": {
      get: {
        tags: ["Admin"],
        summary: "Get platform settings",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Settings retrieved" },
        },
      },
      put: {
        tags: ["Admin"],
        summary: "Update platform settings",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SettingsUpdateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Settings updated" },
        },
      },
    },
    "/api/admin/notifications": {
      get: {
        tags: ["Admin"],
        summary: "List broadcast notifications",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Notifications retrieved" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Create a new broadcast notification",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NotificationRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Notification created" },
        },
      },
    },
  },
} as const;

export const setupSwagger = (app: Express): void => {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.get("/api/docs-json", (_req, res) => {
    res.status(200).json(openApiDocument);
  });
};

export { openApiDocument, commonSuccess };
