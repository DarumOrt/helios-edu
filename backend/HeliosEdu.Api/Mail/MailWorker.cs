using HeliosEdu.Api.Data;
using MailKit.Net.Smtp;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Mail;

// Один отправитель на всю БД: advisory lock действует и между несколькими экземплярами API.
public sealed class MailWorker(IServiceScopeFactory scopes, ILogger<MailWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var handled = false;
            try { handled = await Tick(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch { logger.LogWarning("Очередь email временно недоступна; следующая проверка через секунду."); }
            if (!handled) await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }

    private async Task<bool> Tick(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<LearningDbContext>();
        var mail = scope.ServiceProvider.GetRequiredService<MailService>();
        await db.Database.OpenConnectionAsync(ct);
        // Сессионная блокировка остаётся между фиксацией sending и ответом SMTP.
        var acquired = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_lock(74982101) AS \"Value\"").SingleAsync(ct);
        if (!acquired) return false;
        var attempted = false;
        try
        {
            // После аварии судьба отправки неизвестна. Автоматический повтор мог бы продублировать письмо.
            await db.Set<MailRecipient>().Where(r => r.Status == "sending").ExecuteUpdateAsync(s =>
                s.SetProperty(r => r.Status, "failed").SetProperty(r => r.Error, "Отправка прервана; результат SMTP неизвестен. Проверьте сервер перед повтором."), ct);
            var recipient = await db.Set<MailRecipient>().Where(r => r.Status == "queued" && r.NextAttemptAt <= DateTimeOffset.UtcNow)
                .OrderBy(r => r.NextAttemptAt).ThenBy(r => r.Id).FirstOrDefaultAsync(ct);
            if (recipient is null) return false;
            attempted = true;
            var campaign = await db.Set<MailCampaign>().SingleAsync(c => c.Id == recipient.CampaignId, ct);
            var user = await db.Accounts.SingleOrDefaultAsync(u => u.Id == recipient.UserId && u.TenantId == campaign.TenantId &&
                u.Status == "active" && u.NormalizedEmail == recipient.Email.ToUpperInvariant(), ct);
            var settings = await MailService.Settings(db, campaign.TenantId, ct);
            recipient.Attempts++;
            recipient.Status = "sending";
            await db.SaveChangesAsync(ct);
            var sending = false;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            try
            {
                if (user is null) throw new InvalidOperationException("Получатель больше недоступен.");
                if (settings is null || settings.Host.Length == 0) throw new InvalidOperationException("SMTP не настроен.");
                using var client = await mail.Connect(settings, timeout.Token);
                sending = true;
                await mail.Send(client, settings, campaign, recipient, timeout.Token);
                recipient.Status = "sent";
                recipient.Error = null;
            }
            catch (Exception error) when (error is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                // Текст исключений SMTP может содержать адреса и секреты. Сохраняем только безопасную категорию.
                var temporary = error is SmtpCommandException smtp && (int)smtp.StatusCode is >= 400 and < 500 ||
                    !sending && error is IOException or System.Net.Sockets.SocketException or TimeoutException or OperationCanceledException;
                recipient.Status = temporary && recipient.Attempts < 3 ? "queued" : "failed";
                recipient.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(30 * recipient.Attempts);
                recipient.Error = temporary ? "Временная ошибка SMTP" : sending ? "SMTP не подтвердил отправку" : "Проверьте SMTP, ключ шифрования и получателя";
            }
            await db.SaveChangesAsync(ct);
            return true;
        }
        finally
        {
            // Интервал под общей блокировкой действует и при нескольких экземплярах API.
            if (attempted) await Task.Delay(TimeSpan.FromSeconds(1), CancellationToken.None);
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock(74982101)", CancellationToken.None);
            await db.Database.CloseConnectionAsync();
        }
    }
}
