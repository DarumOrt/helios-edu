import { PageHeader } from "@/shared/ui";
import { ServerAdmin } from "@/features/admin/components/ServerAdmin";
import { ImportUsers } from "@/features/admin/components/ImportUsers";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Импорт пользователей из CSV" />
      <ServerAdmin>
        <ImportUsers />
      </ServerAdmin>
    </>
  );
}
