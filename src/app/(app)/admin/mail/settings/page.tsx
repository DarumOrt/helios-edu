import { PageHeader } from "@/shared/ui";
import { ServerAdmin } from "@/features/admin/components/ServerAdmin";
import { SmtpSettings } from "@/features/admin/components/SmtpSettings";

export default function MailSettingsPage() {
  return (
    <>
      <PageHeader
        title="Настройки SMTP"
        subtitle="Пароль хранится зашифрованным на сервере и не возвращается в браузер"
      />
      <ServerAdmin>
        <SmtpSettings />
      </ServerAdmin>
    </>
  );
}
