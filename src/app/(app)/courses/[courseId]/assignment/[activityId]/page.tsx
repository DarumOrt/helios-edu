"use client";

import { use } from "react";
import { PageHeader, Breadcrumbs } from "@/shared/ui";
import { SubmissionForm } from "@/features/assignment/components/SubmissionForm";

export default function AssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = use(params);
  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <PageHeader
        title="Задание"
        subtitle="Загрузите работу для проверки"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Курсы", href: "/courses" },
              { label: "Курс", href: `/courses/${courseId}` },
              { label: "Задание" },
            ]}
          />
        }
      />
      <SubmissionForm assignmentId={activityId} />
    </div>
  );
}
