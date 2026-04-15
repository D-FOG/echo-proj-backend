import cors from "cors";
import express from "express";

import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import { setupSwagger } from "./config/swagger";
import userRoutes from "./routes/user.routes";
import { errorHandler } from "./middleware/error.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupSwagger(app);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Echo backend is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
