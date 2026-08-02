/**
 * EA System — Enrollment Backfill Script
 * 
 * Purpose: Create Enrollment records for all existing students
 * who have academic placement (classId, sectionId, academicYearId).
 * 
 * Idempotent: Safe to rerun — skips students that already have
 * an Enrollment record for the same academic year.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

async function main() {
  console.log("=== Enrollment Backfill Script ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  // 1. Find all students with legacy academic placement
  const students = await prisma.student.findMany({
    where: {
      classId: { not: null },
      sectionId: { not: null },
      academicYearId: { not: null },
      isDeleted: false,
    },
    select: {
      id: true,
      schoolId: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      classId: true,
      sectionId: true,
      academicYearId: true,
      createdAt: true,
    },
  });

  console.log(`Found ${students.length} students with legacy academic placement`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const student of students) {
    try {
      // Check if an active enrollment already exists for this student+year
      const existing = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          academicYearId: student.academicYearId!,
          status: "ACTIVE",
        },
      });

      if (existing) {
        console.log(`  SKIP ${student.admissionNumber}: enrollment already exists for academic year`);
        skipped++;
        continue;
      }

      // Create enrollment record
      await prisma.enrollment.create({
        data: {
          schoolId: student.schoolId,
          studentId: student.id,
          academicYearId: student.academicYearId!,
          classId: student.classId!,
          sectionId: student.sectionId!,
          status: "ACTIVE",
          joinedAt: student.createdAt,
        },
      });

      console.log(`  CREATE ${student.admissionNumber} (${student.firstName} ${student.lastName})`);
      created++;
    } catch (e: any) {
      console.error(`  ERROR ${student.admissionNumber}: ${e.message}`);
      errors++;
    }
  }

  // 2. Verify counts
  const totalEnrollments = await prisma.enrollment.count();
  const totalStudents = await prisma.student.count({ where: { isDeleted: false } });

  console.log(`\n=== Backfill Complete ===`);
  console.log(`Created:  ${created}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Errors:   ${errors}`);
  console.log(`\nDatabase State:`);
  console.log(`  Students:    ${totalStudents}`);
  console.log(`  Enrollments: ${totalEnrollments}`);
  console.log(`  Backfilled:  ${created + skipped} of ${students.length} legacy students`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
