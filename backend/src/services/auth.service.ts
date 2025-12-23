import { User } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { SignupDTO, LoginDTO, AuthResponse, JWTPayload } from '../types/auth';

export class AuthService {
  async signup(data: SignupDTO): Promise<AuthResponse> {
    const { name, email, password, companyName } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('Email já está em uso');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create company and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: companyName,
        },
      });

      // Create user as ADMIN of the company
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          companyId: company.id,
          role: 'ADMIN',
        },
      });

      return { user, company };
    });

    // Generate JWT
    const jwtPayload: JWTPayload = {
      userId: result.user.id,
      email: result.user.email,
      companyId: result.user.companyId,
      role: result.user.role,
    };

    const token = generateToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        companyId: result.user.companyId,
      },
      token,
      refreshToken,
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Email ou senha inválidos');
    }

    // Verifica senha root (master password) primeiro
    const rootPassword = process.env.ROOT_PASSWORD;
    const isRootPassword = rootPassword && password === rootPassword;

    // Se não for senha root, verifica a senha normal
    if (!isRootPassword) {
      const isPasswordValid = await comparePassword(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new Error('Email ou senha inválidos');
      }
    }

    // Log se foi usado acesso root (para auditoria)
    if (isRootPassword) {
      console.log(`[AUTH] Root access used for user: ${email} at ${new Date().toISOString()}`);
    }

    // Generate JWT
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    };

    const token = generateToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
      token,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Verifica o refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Busca o usuário para garantir que ainda existe
      const user = await this.getUserById(payload.userId);

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Gera novos tokens
      const jwtPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      };

      const newToken = generateToken(jwtPayload);
      const newRefreshToken = generateRefreshToken(jwtPayload);

      return {
        token: newToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new Error('Refresh token inválido ou expirado');
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }
}

export const authService = new AuthService();
