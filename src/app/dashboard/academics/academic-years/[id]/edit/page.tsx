"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AcademicYearForm } from "../../AcademicYearForm";
import { CardGridSkeleton } from "@/components/ui/skeleton";

export default function AcademicYearEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/academic-years/${id}`).then(r => r.json()).then(d => {
      if (d.success) {
        setInitialData({
          id: d.data.id,
          name: d.data.name,
          startDate: d.data.startDate.split("T")[0],
          endDate: d.data.endDate.split("T")[0],
          isActive: d.data.isActive,
        });
      } else { toast.error("Academic year not found"); router.push("/dashboard/academics/academic-years"); }
    }).catch(() => toast.error("Failed to load"));
  }, [id, router]);

  if (!initialData) return <div className="flex items-center justify-center h-64"><CardGridSkeleton count={2} /></div>;
  return <AcademicYearForm initialData={initialData} isEdit />;
}
