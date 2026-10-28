using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace HeliosEdu.Api.Files;

/// <summary>Настройки хранилища (раздел Storage, см. compose.yaml и docs/adr/0001-object-storage.md).</summary>
public sealed class StorageOptions
{
    /// <summary>Адрес S3 для C# (в Docker — http://storage:8333). Пусто — хранилище не подключено.</summary>
    public string? ServiceUrl { get; set; }
    /// <summary>Адрес S3, который видит браузер: на него выписываются временные ссылки.</summary>
    public string? PublicUrl { get; set; }
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string Bucket { get; set; } = "helios-media";
    /// <summary>Сайты, с которых браузер загружает файлы напрямую (CORS), через запятую.</summary>
    public string AllowedOrigins { get; set; } = "";
    /// <summary>Как часто фоновая задача убирает брошенные загрузки и корзину.</summary>
    public int CleanupMinutes { get; set; } = 60;
}

/// <summary>
/// Работа с хранилищем только по протоколу S3 — сменить SeaweedFS на другое S3-хранилище можно без изменения кода.
/// Два клиента: внутренний (запросы C# к хранилищу) и публичный — только подписывает ссылки на адрес для браузера
/// (подпись включает адрес, поэтому ссылку на http://storage:8333 браузер открыть не смог бы).
/// </summary>
public sealed class FileStorage : IDisposable
{
    private readonly StorageOptions options;
    private readonly AmazonS3Client? client;
    private readonly AmazonS3Client? signer;

    public FileStorage(IConfiguration configuration)
    {
        options = configuration.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions();
        if (string.IsNullOrWhiteSpace(options.ServiceUrl)) return;
        var credentials = new BasicAWSCredentials(options.AccessKey, options.SecretKey);
        client = new AmazonS3Client(credentials, Config(options.ServiceUrl));
        signer = new AmazonS3Client(credentials, Config(options.PublicUrl ?? options.ServiceUrl));
    }

    public bool IsConfigured => client is not null;
    public StorageOptions Options => options;

    private static AmazonS3Config Config(string url) => new()
    {
        ServiceURL = url,
        ForcePathStyle = true,
        AuthenticationRegion = "us-east-1",
        // контрольные суммы по умолчанию (SDK 4) поддерживает не каждое S3-совместимое хранилище
        RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
        ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
    };

    private AmazonS3Client Client => client ?? throw new InvalidOperationException("Хранилище файлов не подключено.");
    private AmazonS3Client Signer => signer ?? throw new InvalidOperationException("Хранилище файлов не подключено.");

    private Protocol PublicProtocol =>
        (options.PublicUrl ?? options.ServiceUrl ?? "").StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? Protocol.HTTPS : Protocol.HTTP;

    /// <summary>Создать хранилище для файлов (если нет) и разрешить браузеру загрузку с адресов сайта.</summary>
    public async Task EnsureBucketAsync(CancellationToken token)
    {
        var buckets = await Client.ListBucketsAsync(token);
        if (buckets.Buckets?.Any(bucket => bucket.BucketName == options.Bucket) != true)
            await Client.PutBucketAsync(new PutBucketRequest { BucketName = options.Bucket }, token);
        var origins = options.AllowedOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (origins.Length == 0) return;
        await Client.PutCORSConfigurationAsync(new PutCORSConfigurationRequest
        {
            BucketName = options.Bucket,
            Configuration = new CORSConfiguration
            {
                Rules =
                [
                    new CORSRule
                    {
                        AllowedOrigins = [.. origins], AllowedMethods = ["PUT", "GET", "HEAD"],
                        AllowedHeaders = ["*"], ExposeHeaders = ["ETag"], MaxAgeSeconds = 3600,
                    },
                ],
            },
        }, token);
    }

    /// <summary>Временная ссылка на загрузку: браузер отправляет файл PUT с этим Content-Type.</summary>
    public Task<string> UploadUrlAsync(string key, string contentType, DateTime expires) =>
        Signer.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = options.Bucket, Key = key, Verb = HttpVerb.PUT, ContentType = contentType,
            Expires = expires, Protocol = PublicProtocol,
        });

    /// <summary>Временная ссылка на чтение; имя файла — для «Сохранить как».</summary>
    public Task<string> DownloadUrlAsync(string key, string fileName, string contentType, DateTime expires)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = options.Bucket, Key = key, Verb = HttpVerb.GET, Expires = expires, Protocol = PublicProtocol,
        };
        request.ResponseHeaderOverrides.ContentType = contentType;
        request.ResponseHeaderOverrides.ContentDisposition =
            $"inline; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
        return Signer.GetPreSignedURLAsync(request);
    }

    /// <summary>Размер загруженного объекта; null — объекта нет.</summary>
    public async Task<long?> SizeAsync(string key, CancellationToken token)
    {
        try
        {
            var head = await Client.GetObjectMetadataAsync(options.Bucket, key, token);
            return head.ContentLength;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public Task DeleteAsync(string key, CancellationToken token) => Client.DeleteObjectAsync(options.Bucket, key, token);

    /// <summary>Все объекты хранилища с датой изменения — для поиска «осиротевших» файлов.</summary>
    public async Task<List<(string Key, DateTimeOffset Modified)>> ListAsync(CancellationToken token)
    {
        var result = new List<(string, DateTimeOffset)>();
        var request = new ListObjectsV2Request { BucketName = options.Bucket };
        ListObjectsV2Response response;
        do
        {
            response = await Client.ListObjectsV2Async(request, token);
            foreach (var item in response.S3Objects ?? [])
                result.Add((item.Key, item.LastModified is { } modified ? new DateTimeOffset(modified.ToUniversalTime()) : DateTimeOffset.MinValue));
            request.ContinuationToken = response.NextContinuationToken;
        } while (response.IsTruncated == true);
        return result;
    }

    public void Dispose()
    {
        client?.Dispose();
        signer?.Dispose();
    }
}
