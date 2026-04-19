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
    {
      url: "https://echo-proj-backend.onrender.com",
      description: "Render hosted server",
    },
  ],
  tags: [
    { name: "Health", description: "Service health checks" },
    { name: "Auth", description: "Authentication and identity endpoints" },
    { name: "User", description: "Protected user dashboard endpoints" },
    { name: "Admin", description: "Protected admin portal endpoints" },
    { name: "Zoho", description: "Zoho OAuth and Mail API endpoints" },
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
      ZohoAuthUrlResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          authUrl: { type: "string", example: "https://accounts.zoho.com/oauth/v2/auth?..." },
        },
      },
      ZohoTokenData: {
        type: "object",
        properties: {
          access_token: { type: "string", example: "1000.xxx..." },
          refresh_token: { type: "string", example: "1000.xxx..." },
          expires_in: { type: "number", example: 3600 },
          token_type: { type: "string", example: "Bearer" },
        },
      },
      ZohoCallbackResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Zoho token exchange succeeded." },
          tokenData: { $ref: "#/components/schemas/ZohoTokenData" },
          profile: { type: "object", additionalProperties: true },
        },
      },
      ZohoRefreshResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          tokenData: { $ref: "#/components/schemas/ZohoTokenData" },
        },
      },
      ZohoAccountsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          accounts: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      },
      ZohoProfileResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          profile: { type: "object", additionalProperties: true },
        },
      },
      ZohoTestEmailRequest: {
        type: "object",
        required: ["to", "subject", "content"],
        properties: {
          to: { type: "string", format: "email", example: "paula@zylker.com" },
          cc: { type: "string", format: "email", example: "david@zylker.com" },
          bcc: { type: "string", format: "email", example: "rebecca11@zylker.com" },
          subject: { type: "string", example: "Email - Always and Forever" },
          content: { type: "string", example: "Email can never be dead. The most neutral and effective way..." },
          askReceipt: { type: "string", enum: ["yes", "no"], example: "yes" },
        },
      },
      ZohoTestEmailResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Test email sent successfully." },
          emailResult: { type: "object", additionalProperties: true },
        },
      },
      InvoiceCreateRequest: {
        type: "object",
        required: ["title", "amount", "userId"],
        properties: {
          title: { type: "string", example: "Invoice for Services" },
          description: { type: "string", example: "Payment for Q1 2026 services" },
          amount: { type: "number", example: 50000 },
          userId: { type: "string", example: "661d31f2c1d87c738baf2131" },
          dueDate: { type: "string", format: "date-time", example: "2026-05-18" },
          currency: { type: "string", example: "NGN" },
        },
      },
      InvoiceData: {
        type: "object",
        properties: {
          _id: { type: "string" },
          invoiceNumber: { type: "string", example: "INV-1234567890-123" },
          title: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", example: "NGN" },
          user: { type: "object", additionalProperties: true },
          createdBy: { type: "object", additionalProperties: true },
          invoiceFile: { type: "object", properties: { url: { type: "string" }, publicId: { type: "string" } } },
          status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "cancelled"] },
          paymentStatus: { type: "string", enum: ["pending", "confirmed", "rejected"] },
          dueDate: { type: "string", format: "date-time" },
          paidAt: { type: "string", format: "date-time" },
          sentAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      BankDetails: {
        type: "object",
        properties: {
          accountName: { type: "string", example: "Echolalax Global" },
          accountNumber: { type: "string", example: "0000000000" },
          bankName: { type: "string", example: "First Bank" },
        },
      },
      PaymentReceiptData: {
        type: "object",
        properties: {
          _id: { type: "string" },
          invoice: { type: "string" },
          user: { type: "string" },
          receiptFile: { type: "object", properties: { url: { type: "string" }, publicId: { type: "string" } } },
          status: { type: "string", enum: ["submitted", "confirmed", "rejected"] },
          submittedAt: { type: "string", format: "date-time" },
          confirmedAt: { type: "string", format: "date-time" },
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
    "/api/zoho/auth-url": {
      get: {
        tags: ["Zoho"],
        summary: "Get Zoho OAuth authorization URL",
        responses: {
          "200": {
            description: "Authorization URL generated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZohoAuthUrlResponse" },
              },
            },
          },
        },
      },
    },
    "/api/zoho/auth": {
      get: {
        tags: ["Zoho"],
        summary: "Redirect to Zoho OAuth authorization page",
        responses: {
          "302": {
            description: "Redirect to Zoho authorization",
          },
        },
      },
    },
    "/api/zoho/callback": {
      get: {
        tags: ["Zoho"],
        summary: "Zoho OAuth callback - exchanges code for tokens",
        parameters: [
          { in: "query", name: "code", schema: { type: "string" }, description: "Authorization code from Zoho" },
          { in: "query", name: "error", schema: { type: "string" }, description: "Error from Zoho if any" },
        ],
        responses: {
          "200": {
            description: "Token exchange successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZohoCallbackResponse" },
              },
            },
          },
          "400": {
            description: "Authorization failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/zoho/refresh": {
      get: {
        tags: ["Zoho"],
        summary: "Refresh Zoho access token using refresh token",
        responses: {
          "200": {
            description: "Token refreshed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZohoRefreshResponse" },
              },
            },
          },
        },
      },
    },
    "/api/zoho/accounts": {
      get: {
        tags: ["Zoho"],
        summary: "Get Zoho Mail accounts",
        responses: {
          "200": {
            description: "Accounts retrieved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZohoAccountsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/zoho/profile": {
      get: {
        tags: ["Zoho"],
        summary: "Get Zoho user profile",
        responses: {
          "200": {
            description: "Profile retrieved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZohoProfileResponse" },
              },
            },
          },
        },
      },
    },
    "/api/zoho/test-email": {
      post: {
        tags: ["Zoho"],
        summary: "Send a test email via Zoho Mail",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ZohoTestEmailRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Test email sent",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZohoTestEmailResponse" },
              },
            },
          },
        },
      },
    },
    "/api/invoices/admin": {
      post: {
        tags: ["Invoices"],
        summary: "Create a new invoice",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InvoiceCreateRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Invoice created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: { $ref: "#/components/schemas/InvoiceData" },
                  },
                },
              },
            },
          },
        },
      },
      get: {
        tags: ["Invoices"],
        summary: "List admin invoices",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", example: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", example: 10 } },
        ],
        responses: {
          "200": { description: "Invoices retrieved" },
        },
      },
    },
    "/api/invoices/admin/upload": {
      post: {
        tags: ["Invoices"],
        summary: "Upload invoice file",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  invoiceId: { type: "string" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "File uploaded successfully" },
        },
      },
    },
    "/api/invoices/admin/send": {
      post: {
        tags: ["Invoices"],
        summary: "Send invoice to user",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["invoiceId"],
                properties: {
                  invoiceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Invoice sent successfully" },
        },
      },
    },
    "/api/invoices/admin/receipts/pending": {
      get: {
        tags: ["Invoices"],
        summary: "Get pending payment receipts for admin",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", example: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", example: 10 } },
        ],
        responses: {
          "200": { description: "Pending receipts retrieved" },
        },
      },
    },
    "/api/invoices/admin/confirm-payment": {
      post: {
        tags: ["Invoices"],
        summary: "Confirm payment receipt",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["receiptId"],
                properties: {
                  receiptId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Payment confirmed" },
        },
      },
    },
    "/api/invoices": {
      get: {
        tags: ["Invoices"],
        summary: "List user invoices",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", example: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", example: 10 } },
        ],
        responses: {
          "200": { description: "Invoices retrieved" },
        },
      },
    },
    "/api/invoices/{id}": {
      get: {
        tags: ["Invoices"],
        summary: "Get invoice details with bank info for payment",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Invoice details with bank account info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      allOf: [
                        { $ref: "#/components/schemas/InvoiceData" },
                        {
                          type: "object",
                          properties: {
                            bankDetails: { $ref: "#/components/schemas/BankDetails" },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/invoices/{id}/receipt": {
      post: {
        tags: ["Invoices"],
        summary: "Upload payment receipt",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  receipt: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Receipt uploaded successfully" },
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
