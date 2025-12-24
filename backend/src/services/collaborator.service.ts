import { User, Invite, Permission } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { emailService } from './email.service';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import crypto from 'crypto';

interface InviteCollaboratorData {
  email: string;
  name: string;
  cargo?: string;
  permissions: { page: string; canView: boolean; canEdit: boolean }[];
}

export class CollaboratorService {
  async inviteCollaborator(
    companyId: string,
    invitedById: string,
    data: InviteCollaboratorData
  ): Promise<Invite> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Este email já está cadastrado no sistema');
    }

    const existingInvite = await prisma.invite.findFirst({
      where: {
        email: data.email,
        companyId,
        status: 'PENDING',
      },
    });

    if (existingInvite) {
      throw new Error('Já existe um convite pendente para este email');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inviter = await prisma.user.findUnique({
      where: { id: invitedById },
      include: { company: true },
    });

    if (!inviter) {
      throw new Error('Usuário não encontrado');
    }

    const invite = await prisma.invite.create({
      data: {
        companyId,
        email: data.email,
        name: data.name,
        cargo: data.cargo,
        token,
        status: 'PENDING',
        invitedById,
        expiresAt,
        permissions: {
          create: data.permissions.map(p => ({
            page: p.page as any,
            canView: p.canView,
            canEdit: p.canEdit,
          })),
        },
      },
      include: {
        permissions: true,
      },
    });

    try {
      await emailService.sendInviteEmail(
        data.email,
        data.name,
        inviter.name,
        inviter.company.name,
        token
      );
    } catch (emailError) {
      throw new Error('Convite criado mas falha ao enviar email. Verifique configurações SMTP.');
    }

    return invite;
  }

  async acceptInvite(
    token: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { permissions: true },
    });

    if (!invite) {
      throw new Error('Convite inválido');
    }

    if (invite.status !== 'PENDING') {
      throw new Error('Este convite já foi usado ou cancelado');
    }

    if (new Date() > invite.expiresAt) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Este convite expirou');
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          cargo: invite.cargo,
          passwordHash,
          companyId: invite.companyId,
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      await tx.permission.updateMany({
        where: { inviteId: invite.id },
        data: { userId: newUser.id, inviteId: null },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          userId: newUser.id,
        },
      });

      return newUser;
    });

    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    });

    return { user, token: jwtToken };
  }

  async listCollaborators(companyId: string) {
    const [users, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        where: { companyId },
        include: {
          permissions: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invite.findMany({
        where: {
          companyId,
          status: 'PENDING',
        },
        include: {
          permissions: true,
          invitedBy: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { users, pendingInvites };
  }

  async updatePermissions(
    userId: string,
    companyId: string,
    permissions: { page: string; canView: boolean; canEdit: boolean }[]
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      throw new Error('Colaborador não encontrado');
    }

    await prisma.permission.deleteMany({
      where: { userId },
    });

    await prisma.permission.createMany({
      data: permissions.map(p => ({
        userId,
        page: p.page as any,
        canView: p.canView,
        canEdit: p.canEdit,
      })),
    });
  }

  async removeCollaborator(userId: string, companyId: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      throw new Error('Colaborador não encontrado');
    }

    if (user.role === 'ADMIN') {
      throw new Error('Não é possível remover um administrador');
    }

    await prisma.user.delete({
      where: { id: userId },
    });
  }

  async cancelInvite(inviteId: string, companyId: string): Promise<void> {
    const invite = await prisma.invite.findFirst({
      where: { id: inviteId, companyId },
    });

    if (!invite) {
      throw new Error('Convite não encontrado');
    }

    await prisma.invite.update({
      where: { id: inviteId },
      data: { status: 'CANCELLED' },
    });
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    return prisma.permission.findMany({
      where: { userId },
    });
  }
}

export const collaboratorService = new CollaboratorService();
