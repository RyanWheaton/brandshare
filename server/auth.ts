import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendPasswordResetEmail } from "./email";
import { requestPasswordResetSchema, resetPasswordSchema } from "@shared/schema";
import { changePasswordSchema } from "@shared/schema";
import { sendVerificationEmail } from "./email";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

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
    }, async (username, password, done) => {
      try {
        const user = await storage.getUserByEmail(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid email or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const verificationToken = randomBytes(32).toString('hex');
      const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const user = await storage.createUser({
        ...req.body,
        username: req.body.email,
        password: await hashPassword(req.body.password),
        emailVerified: false,
        verificationToken,
        verificationTokenExpiresAt,
      });

      console.log('Sending verification email to:', user.email);
      const emailSent = await sendVerificationEmail(user.email, verificationToken);

      if (!emailSent) {
        console.error('Failed to send verification email');
        // Still create the user but inform them about the email issue
        return res.status(201).json({
          ...user,
          message: "Account created but verification email failed to send. Please contact support.",
        });
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          ...user,
          message: "Please check your email to verify your account",
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          message: "Please verify your email address before logging in",
          needsVerification: true
        });
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/verify-email", async (req, res) => {
    const { token } = req.body;

    try {
      const user = await storage.verifyEmail(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      if (!req.isAuthenticated()) {
        req.login(user, (err) => {
          if (err) throw err;
        });
      }

      res.json({ message: "Email verified successfully" });
    } catch (error) {
      res.status(400).json({ message: "Failed to verify email" });
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

  app.post("/api/request-reset", async (req, res) => {
    try {
      const { email } = requestPasswordResetSchema.parse(req.body);
      const token = await storage.createPasswordResetToken(email);

      if (token) {
        await sendPasswordResetEmail(email, token);
      }

      res.json({
        message: "If an account exists with this email, you will receive password reset instructions."
      });
    } catch (error) {
      res.status(400).json({
        message: "If an account exists with this email, you will receive password reset instructions."
      });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      const user = await storage.getUserByResetToken(token);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updatePassword(user.id, hashedPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(req.user!.id);

      if (!user || !(await comparePasswords(currentPassword, user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updatePassword(user.id, hashedPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });
}