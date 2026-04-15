import app from "./app";
import { connectToDatabase } from "./config/db";
import { env } from "./config/env";

const startServer = async (): Promise<void> => {
  await connectToDatabase();

  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
};

startServer().catch((error: unknown) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
