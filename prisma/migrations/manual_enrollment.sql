-- ============================================================
-- EA SYSTEM ENROLLMENT MIGRATION
-- ============================================================

-- 1. ALTER TYPE: Add new enum values
ALTER TYPE "EnrollmentStatus" ADD VALUE 'PROMOTED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'GRADUATED';

-- 2. ALTER TABLE students: Add back legacy academic placement columns (read-only)
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "academic_year_id" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "class_id" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "section_id" TEXT;

-- 3. ALTER TABLE academic_years: Add is_current column
ALTER TABLE \"academic_years\" ADD COLUMN IF NOT EXISTS \"is_current\" BOOLEAN NOT NULL DEFAULT false;

-- 3. CREATE TABLE enrollments
CREATE TABLE IF NOT EXISTS \"enrollments\" (
    \"id\" TEXT NOT NULL,
    \"school_id\" TEXT NOT NULL,
    \"student_id\" TEXT NOT NULL,
    \"academic_year_id\" TEXT NOT NULL,
    \"class_id\" TEXT NOT NULL,
    \"section_id\" TEXT NOT NULL,
    \"roll_number\" TEXT,
    \"status\" \"EnrollmentStatus\" NOT NULL DEFAULT 'ACTIVE',
    \"joined_at\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \"left_at\" TIMESTAMP(3),
    \"created_at\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \"updated_at\" TIMESTAMP(3) NOT NULL,

    CONSTRAINT \"enrollments_pkey\" PRIMARY KEY (\"id\")
);

-- 4. Foreign Keys
ALTER TABLE \"enrollments\" ADD CONSTRAINT \"enrollments_school_id_fkey\" FOREIGN KEY (\"school_id\") REFERENCES \"schools\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \"enrollments\" ADD CONSTRAINT \"enrollments_student_id_fkey\" FOREIGN KEY (\"student_id\") REFERENCES \"students\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \"enrollments\" ADD CONSTRAINT \"enrollments_academic_year_id_fkey\" FOREIGN KEY (\"academic_year_id\") REFERENCES \"academic_years\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \"enrollments\" ADD CONSTRAINT \"enrollments_class_id_fkey\" FOREIGN KEY (\"class_id\") REFERENCES \"classes\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \"enrollments\" ADD CONSTRAINT \"enrollments_section_id_fkey\" FOREIGN KEY (\"section_id\") REFERENCES \"sections\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Partial Unique Indexes (PostgreSQL raw SQL — not supported by Prisma @@unique)
-- Constraint: Only ONE ACTIVE Enrollment per Student per Academic Year
CREATE UNIQUE INDEX IF NOT EXISTS \"enrollments_student_year_active_key\" ON \"enrollments\" (\"student_id\", \"academic_year_id\") WHERE (\"status\" = 'ACTIVE');

-- Constraint: Only ONE current Academic Year per School
CREATE UNIQUE INDEX IF NOT EXISTS \"academic_years_school_id_is_current_key\" ON \"academic_years\" (\"school_id\", \"is_current\") WHERE (\"is_current\" = true);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS \"enrollments_school_id_idx\" ON \"enrollments\"(\"school_id\");
CREATE INDEX IF NOT EXISTS \"enrollments_student_id_idx\" ON \"enrollments\"(\"student_id\");
CREATE INDEX IF NOT EXISTS \"enrollments_academic_year_id_idx\" ON \"enrollments\"(\"academic_year_id\");
CREATE INDEX IF NOT EXISTS \"enrollments_class_id_idx\" ON \"enrollments\"(\"class_id\");
CREATE INDEX IF NOT EXISTS \"enrollments_section_id_idx\" ON \"enrollments\"(\"section_id\");
CREATE INDEX IF NOT EXISTS \"enrollments_student_id_academic_year_id_idx\" ON \"enrollments\"(\"student_id\", \"academic_year_id\");
