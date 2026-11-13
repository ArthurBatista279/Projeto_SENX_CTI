# ==============================================================================
# SENX CTI 1.5.0.0 â€” Dockerfile para Deploy em Nuvem (Render, Railway, Koyeb, etc.)
# ==============================================================================

# EstÃ¡gio 1: Build & PublicaÃ§Ã£o
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restaura dependÃªncias do projeto da API
COPY ["BackEnd/SenxCti.Api/SenxCti.Api.csproj", "BackEnd/SenxCti.Api/"]
RUN dotnet restore "BackEnd/SenxCti.Api/SenxCti.Api.csproj"

# Copia todo o cÃ³digo-fonte (inclui os arquivos estÃ¡ticos da SPA em Aplicacao/SenxCti.Web/wwwroot)
COPY . .

# Compila e empacota a aplicaÃ§Ã£o em modo Release
WORKDIR "/src/BackEnd/SenxCti.Api"
RUN dotnet publish "SenxCti.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# EstÃ¡gio 2: Imagem Final de ExecuÃ§Ã£o (Leve e Segura)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Cria pasta de armazenamento privado de Ã¡udio
RUN mkdir -p /app/audio && chmod 777 /app/audio

# ConfiguraÃ§Ãµes de ambiente padrÃ£o para nuvem
ENV ASPNETCORE_HTTP_PORTS=8080
ENV SENX_AUDIO_ROOT=/app/audio
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

ENTRYPOINT ["dotnet", "SenxCti.Api.dll"]
