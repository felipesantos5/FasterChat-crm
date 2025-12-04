import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const url = req.originalUrl || req.url;

    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log(`[Auth] ❌ No authorization header provided for ${req.method} ${url}`);
      res.status(401).json({
        success: false,
        message: 'Token não fornecido',
        code: 'NO_TOKEN',
      });
      return;
    }

    // Check if token starts with Bearer
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log(`[Auth] ❌ Invalid token format for ${req.method} ${url}`);
      res.status(401).json({
        success: false,
        message: 'Formato de token inválido',
        code: 'INVALID_FORMAT',
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const payload = verifyToken(token);

    // Attach user to request
    (req as any).user = payload;

    console.log(`[Auth] ✅ User ${payload.userId} (${payload.email}) authenticated for ${req.method} ${url}`);
    next();
  } catch (error: any) {
    const url = req.originalUrl || req.url;
    console.log(`[Auth] ❌ Token verification failed for ${req.method} ${url}:`, error.message);
    res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado',
      code: 'INVALID_TOKEN',
    });
  }
};

// Optional: Middleware to check specific roles
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Não autenticado',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Sem permissão para acessar este recurso',
      });
      return;
    }

    next();
  };
};
