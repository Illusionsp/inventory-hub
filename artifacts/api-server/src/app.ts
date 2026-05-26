import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
  }
}

const PgStore = connectPgSimple(session);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min
    }),
    secret: process.env.SESSION_SECRET ?? "inventory-pro-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

export default app;
