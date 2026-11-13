import { PageHeader } from "@/shared/ui";
import { ServerAdmin } from "@/features/admin/components/ServerAdmin";
import { Mailings } from "@/features/admin/components/Mailings";

export default function MailPage() {
  return (
    <>
      <PageHeader title="Рассылки и уведомления" />
      <ServerAdmin>
        <Mailings />
      </ServerAdmin>
    </>
  );
}
