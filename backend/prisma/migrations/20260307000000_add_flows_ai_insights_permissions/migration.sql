-- AlterEnum
-- Adiciona os valores FLOWS e AI_INSIGHTS ao enum PermissionPage

ALTER TYPE "PermissionPage" ADD VALUE IF NOT EXISTS 'FLOWS';
ALTER TYPE "PermissionPage" ADD VALUE IF NOT EXISTS 'AI_INSIGHTS';
