import { prisma } from '../utils/prisma';
import { QuickMessageType } from '@prisma/client';

interface CreateQuickMessageData {
  title: string;
  type: QuickMessageType;
  content: string;
  caption?: string;
}

interface UpdateQuickMessageData {
  title?: string;
  content?: string;
  caption?: string;
}

export const quickMessageService = {
  async findAll(companyId: string) {
    return prisma.quickMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        caption: true,
        createdAt: true,
      },
    });
  },

  async create(companyId: string, data: CreateQuickMessageData) {
    return prisma.quickMessage.create({
      data: {
        companyId,
        title: data.title,
        type: data.type,
        content: data.content,
        caption: data.caption,
      },
    });
  },

  async update(id: string, companyId: string, data: UpdateQuickMessageData) {
    const existing = await prisma.quickMessage.findFirst({ where: { id, companyId } });
    if (!existing) return null;

    return prisma.quickMessage.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.caption !== undefined && { caption: data.caption }),
      },
    });
  },

  async delete(id: string, companyId: string): Promise<boolean> {
    const existing = await prisma.quickMessage.findFirst({ where: { id, companyId } });
    if (!existing) return false;

    await prisma.quickMessage.delete({ where: { id } });
    return true;
  },
};
