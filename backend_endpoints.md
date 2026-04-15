# Echolalax Global API Endpoints Specification

Based on the frontend architecture constructed for both the **User** and **Admin** portals, here is the comprehensive list of RESTful API endpoints you will need to implement on your backend (e.g., Node.js/Express, Python/Django, Laravel).

---

## 1. Authentication & Identity
These handle sessions and onboarding for both regular users and administrators.

| Method | Endpoint | Description | Expected Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Create a new user account | `{ name, email, password, phone? }` |
| `POST` | `/api/auth/login` | Authenticate user/admin (returns JWT or sets cookie) | `{ email, password }` |
| `POST` | `/api/auth/logout` | Invalidate current session/token | None |
| `GET` | `/api/auth/me` | Fetch authenticated user's active session profile | Authorization Header |
| `POST` | `/api/auth/reset-password` | Initiate password reset via email link | `{ email }` |

---

## 2. User Dashboard (Protected user routes)
Endpoints serving the standard `/dashboard/*` frontend routes.

### Overview & Wallet
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/overview` | Fetch high-level stats: Active automations count, total monthly spend, wallet balance. |
| `GET` | `/api/user/transactions` | Fetch billing/wallet history (with pagination). |
| `POST` | `/api/user/wallet/fund` | Initialize a payment gateway session (Paystack/Flutterwave) to fund wallet. |

### Automations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/automations` | Fetch all automations owned by the user. |
| `POST` | `/api/user/automations` | Create a new subscription automation (e.g., adding MTN data plan). |
| `GET` | `/api/user/automations/:id` | Get specifics for a single automation schedule. |
| `PUT` | `/api/user/automations/:id/status`| Pause or Resume an active automation. |
| `DELETE`| `/api/user/automations/:id` | Cancel/delete an automation entirely. |

### Profile
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/profile` | Fetch user settings and preferences. |
| `PUT` | `/api/user/profile` | Update profile data (name, phone, avatar). |
| `PUT` | `/api/user/password` | Change user password explicitly. |

---

## 3. Admin Portal (Protected admin routes)
Endpoints serving the `/admin/*` frontend routes. Requires Admin-level authorization.

### Global Overview
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | Fetch system health metrics (Total Users, Total Automations, Expiring Soon, Active). |

### User Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/users` | List all users (supports `?search=` and `?page=` queries). |
| `GET` | `/api/admin/users/:id` | Fetch complete profile, wallet balance, and automation history for a specific user. |
| `PUT` | `/api/admin/users/:id/status` | Suspend, Ban, or Reactivate a user account. |

### Global Automations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/automations` | List platform-wide automations (supports `?service=` and `?status=` filters). |

### Contact & Support Messages
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/messages` | Fetch all support tickets and contact form submissions. |
| `PUT` | `/api/admin/messages/:id/resolve` | Mark a ticket as read/resolved. |
| `POST` | `/api/admin/messages/:id/reply` | Send a direct email reply to the user from the admin dashboard. |

### System Logs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/logs` | Fetch immutable audit records of system events (user logins, automation failures, credential updates). |

### Platform Settings
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/settings` | Fetch global configs (Platform Name, Default Currency, Maintenance Mode status). |
| `PUT` | `/api/admin/settings` | Save global changes. Expected payload e.g. `{ maintenanceMode: true, supportEmail: '...' }` |

### Push Notifications & Broadcasts
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/notifications` | Fetch history of broadcasts sent. |
| `POST` | `/api/admin/notifications` | Trigger a new broadcast via email or in-app push to target audiences. |

---

## Next Steps for You

When you begin writing the backend:
1. Start with the **Auth logic**, as every other route requires parsing a signed token (JWT) to identify the `req.user.id` or `req.admin.role`.
2. As you build an endpoint (e.g., `GET /api/user/automations`), locate the correlating page in the Next.js frontend, comment out the dummy data variable, and use `useEffect` + `axios`/`fetch` to retrieve from your live API.
