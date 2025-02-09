import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { requestPasswordResetSchema, resetPasswordSchema } from "@shared/schema";
import { changePasswordSchema } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || req.user!.email !== process.env.VITE_ADMIN_USERNAME) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        // Check for admin login with environment variables
        if (email === process.env.VITE_ADMIN_USERNAME) {
          if (password === process.env.VITE_ADMIN_PASSWORD) {
            const adminUser = {
              id: 0,
              email: process.env.VITE_ADMIN_USERNAME,
              username: process.env.VITE_ADMIN_USERNAME,
              password: '',
              emailVerified: true,
              dropboxToken: null,
              resetToken: null,
              resetTokenExpiresAt: null,
              verificationToken: null,
              verificationTokenExpiresAt: null
            };
            return done(null, adminUser);
          }
          return done(null, false, { message: "Invalid admin credentials" });
        }

        // Regular user login
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid email or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id: number, done) => {
    try {
      // Special handling for admin user
      if (id === 0) {
        const adminUser = {
          id: 0,
          email: process.env.VITE_ADMIN_USERNAME,
          username: process.env.VITE_ADMIN_USERNAME,
          password: '',
          emailVerified: true,
          dropboxToken: null,
          resetToken: null,
          resetTokenExpiresAt: null,
          verificationToken: null,
          verificationTokenExpiresAt: null
        };
        return done(null, adminUser);
      }

      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser({
        ...req.body,
        username: req.body.email,
        password: await hashPassword(req.body.password),
        emailVerified: true,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsersWithStats();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // New admin endpoints for user management
  app.post("/api/admin/users/:userId/reset-password", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: "Invalid password. Must be at least 6 characters." });
      }

      const hashedPassword = await hashPassword(newPassword);
      const user = await storage.updatePassword(parseInt(userId), hashedPassword);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.delete("/api/admin/users/:userId", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const parsedId = parseInt(userId);

      if (isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      await storage.deleteUser(parsedId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
}