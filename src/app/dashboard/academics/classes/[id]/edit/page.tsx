"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClassForm } from "../../ClassForm";
import { CardGridSkeleton } from "@/components/ui/skeleton";

export default function ClassEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/classes/${id}`).then(r => r.json()).then(d => {
      if (d.success) setInitialData({ id: d.data.id, name: d.data.name, academicYearId: d.data.academicYear.id, status: d.data.status });
      else { toast.error("Class not found"); router.push("/dashboard/academics/classes"); }
    }).catch(() => toast.error("Failed to load"));
  }, [id, router]);

  if (!initialData) return <div className="flex items-center justify-center h-64"><CardGridSkeleton count={2} /></div>;

  return <ClassForm initialData={initialData} isEdit />;
}
