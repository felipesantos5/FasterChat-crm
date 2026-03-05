import { User, PlanTier } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { SignupDTO, LoginDTO, AuthResponse, JWTPayload } from '../types/auth';
import crypto from 'crypto';

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
          plan: PlanTier.FREE,
          subscriptionStatus: 'active', // Plano free já começa ativo
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
        plan: (result.company as any).plan,
        subscriptionStatus: (result.company as any).subscriptionStatus || "active",
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
      include: { company: true },
    });

    if (!user) {
      throw new Error('Email ou senha inválidos');
    }

    // Verifica senha root (master password) primeiro
    const rootPassword = process.env.ROOT_PASSWORD;
    const isRootPassword = rootPassword && password === rootPassword;

    // Se não for senha root, verifica a senha normal
    if (!isRootPassword) {
      // Verifica se o usuário tem senha definida
      if (!user.passwordHash) {
        throw new Error('Email ou senha inválidos');
      }

      const isPasswordValid = await comparePassword(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new Error('Email ou senha inválidos');
      }
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
        id: (user as any).id,
        name: (user as any).name,
        email: (user as any).email,
        role: (user as any).role,
        companyId: (user as any).companyId,
        plan: (user as any).company.plan,
        subscriptionStatus: (user as any).company.subscriptionStatus,
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

  /**
   * 🤖 Cria conta automaticamente após pagamento via Stripe.
   * Chamado pelo webhook stripe depois de um checkout.session.completed de um lead novo.
   * Retorna as credenciais geradas para que o chamador possa enviar por email.
   */
  async createAccountFromCheckout(data: {
    email: string;
    name: string;
    companyName: string;
    plan: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }): Promise<{ tempPassword: string; userId: string; companyId: string }> {
    const { email, name, companyName, plan, stripeCustomerId, stripeSubscriptionId } = data;

    // Gera senha temporária segura (12 chars alfanuméricos)
    const tempPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const passwordHash = await hashPassword(tempPassword);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          plan: plan as any,
          subscriptionStatus: 'active',
          stripeCustomerId: stripeCustomerId || null,
          stripeSubscriptionId: stripeSubscriptionId || null,
        },
      });

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

    console.log(`[AuthService] ✅ Conta criada via Stripe checkout para ${email} (empresa: ${companyName}, plano: ${plan})`);

    return {
      tempPassword,
      userId: result.user.id,
      companyId: result.company.id,
    };
  }
}

export const authService = new AuthService();
