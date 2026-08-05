-- CreateEnum
CREATE TYPE "PromotionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PromotionJobBatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "promotion_jobs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "from_academic_year_id" TEXT NOT NULL,
    "to_academic_year_id" TEXT NOT NULL,
    "class_id" TEXT,
    "retry_class_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PromotionJobStatus" NOT NULL DEFAULT 'PENDING',
    "eligible_students" INTEGER NOT NULL DEFAULT 0,
    "processed_students" INTEGER NOT NULL DEFAULT 0,
    "promoted_students" INTEGER NOT NULL DEFAULT 0,
    "passed_out_students" INTEGER NOT NULL DEFAULT 0,
    "failed_students" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_job_batches" (
    "id" TEXT NOT NULL,
    "promotion_job_id" TEXT NOT NULL,
    "source_class_id" TEXT,
    "source_class_name" TEXT NOT NULL,
    "target_class_id" TEXT,
    "target_class_name" TEXT NOT NULL,
    "transition" TEXT NOT NULL,
    "eligible" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "promoted" INTEGER NOT NULL DEFAULT 0,
    "passed_out" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" "PromotionJobBatchStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_job_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_jobs_school_id_status_idx" ON "promotion_jobs"("school_id", "status");

-- CreateIndex
CREATE INDEX "promotion_jobs_school_id_created_at_idx" ON "promotion_jobs"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "promotion_jobs_school_id_from_academic_year_id_idx" ON "promotion_jobs"("school_id", "from_academic_year_id");

-- CreateIndex
CREATE INDEX "promotion_job_batches_promotion_job_id_idx" ON "promotion_job_batches"("promotion_job_id");

-- CreateIndex
CREATE INDEX "promotion_job_batches_promotion_job_id_status_idx" ON "promotion_job_batches"("promotion_job_id", "status");

-- AddForeignKey
ALTER TABLE "promotion_jobs" ADD CONSTRAINT "promotion_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_jobs" ADD CONSTRAINT "promotion_jobs_from_academic_year_id_fkey" FOREIGN KEY ("from_academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_jobs" ADD CONSTRAINT "promotion_jobs_to_academic_year_id_fkey" FOREIGN KEY ("to_academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_job_batches" ADD CONSTRAINT "promotion_job_batches_promotion_job_id_fkey" FOREIGN KEY ("promotion_job_id") REFERENCES "promotion_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
