using System.Net;
using System.Net.Sockets;

namespace HeliosEdu.Api.Auth;

/// <summary>
/// Адрес пользователя для лимитов. Все запросы приходят от сервера Next, поэтому настоящий адрес он передаёт
/// в заголовке. Верим заголовку только при Auth__TrustClientAddressHeader=true — когда API закрыт от интернета
/// (compose.prod.yaml): иначе его подставил бы кто угодно.
/// </summary>
public static class ClientAddress
{
    public const string Header = "X-Helios-Client-Ip";

    public static string Of(HttpContext context)
    {
        var trusted = context.RequestServices.GetRequiredService<IConfiguration>()
            .GetValue<bool>("Auth:TrustClientAddressHeader");
        var address = trusted && IPAddress.TryParse(context.Request.Headers[Header].ToString(), out var forwarded)
            ? forwarded
            : context.Connection.RemoteIpAddress;
        if (address is null) return "unknown";
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.AddressFamily != AddressFamily.InterNetworkV6) return address.ToString();
        // IPv6: у одного абонента целая сеть /64 — считаем её одним адресом, иначе лимит обходится сменой адреса
        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes).ToString();
    }
}
