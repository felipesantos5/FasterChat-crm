import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const ADMIN_JWT_SECRET = process.env.JWT_SECRET || "admin-secret-key";

interface AdminJwtPayload {
  isAdmin: boolean;
  username: string;
}

// Middleware para verificar autenticação admin
export function adminAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Token não fornecido",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as AdminJwtPayload;

    if (!decoded.isAdmin) {
      res.status(403).json({
        error: "Acesso negado",
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({
      error: "Token inválido ou expirado",
    });
  }
}
