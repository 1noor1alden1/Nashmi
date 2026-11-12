import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";

const app: Express = express();

// Allowed frontend origins
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CORS configuration
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin rejected"));
    },
    credentials: true,
  })
);

// Request body parsers
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// API routes
app.use("/api", router);

export default app;
