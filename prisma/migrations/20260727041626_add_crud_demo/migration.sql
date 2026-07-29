-- CreateTable
CREATE TABLE "crud_demos" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crud_demos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crud_demos_school_id_idx" ON "crud_demos"("school_id");

-- AddForeignKey
ALTER TABLE "crud_demos" ADD CONSTRAINT "crud_demos_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
