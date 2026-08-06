import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const PORT = process.env.PORT ?? 3000;
// connect to database

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Closing database...");

  // await database.disconnect();

  server.close(() => {
    process.exit(0);
  });
});