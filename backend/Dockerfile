FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY HeliosEdu.Api/HeliosEdu.Api.csproj HeliosEdu.Api/
COPY HeliosEdu.Api/packages.lock.json HeliosEdu.Api/
RUN dotnet restore HeliosEdu.Api/HeliosEdu.Api.csproj --locked-mode
COPY HeliosEdu.Api/ HeliosEdu.Api/
RUN dotnet publish HeliosEdu.Api/HeliosEdu.Api.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_HTTP_PORTS=8080
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "HeliosEdu.Api.dll"]
