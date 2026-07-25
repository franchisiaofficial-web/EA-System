-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN');

-- CreateTable
CREATE TABLE "parent_student_links" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "parent_membership_id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "relationship" "Relationship" NOT NULL DEFAULT 'FATHER',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parent_student_links_school_id_idx" ON "parent_student_links"("school_id");

-- CreateIndex
CREATE INDEX "parent_student_links_parent_membership_id_idx" ON "parent_student_links"("parent_membership_id");

-- CreateIndex
CREATE INDEX "parent_student_links_student_membership_id_idx" ON "parent_student_links"("student_membership_id");

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_membership_id_fkey" FOREIGN KEY ("parent_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
