FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

COPY Ticketee.csproj .

RUN dotnet restore Ticketee.csproj

COPY . .

RUN dotnet publish Ticketee.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0

WORKDIR /app

COPY --from=build /app .

RUN mkdir -p /app/keys && chown app:app /app/keys

ENV ASPNETCORE_HTTP_PORTS=3000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DATA_PROTECTION_KEYS_PATH=/app/keys

USER app

EXPOSE 3000

ENTRYPOINT ["dotnet", "Ticketee.dll"]
