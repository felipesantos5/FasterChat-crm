-- DropIndex
DROP INDEX "customers_is_group_idx";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "is_group";

┌─────────────────────────────────────────────────────────┐
│  Update available 5.10.2 -> 7.0.1                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
