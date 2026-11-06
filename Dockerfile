# ==============================================================================
# SENX CTI 1.0.0.0 — Dockerfile para Deploy em Nuvem (Render, Railway, Koyeb, etc.)
# ==============================================================================

# Estágio 1: Build & Publicação
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restaura dependências do projeto da API
COPY ["BackEnd/SenxCti.Api/SenxCti.Api.csproj", "BackEnd/SenxCti.Api/"]
RUN dotnet restore "BackEnd/SenxCti.Api/SenxCti.Api.csproj"

# Copia todo o código-fonte (inclui os arquivos estáticos da SPA em Aplicacao/SenxCti.Web/wwwroot)
COPY . .

# Compila e empacota a aplicação em modo Release
WORKDIR "/src/BackEnd/SenxCti.Api"
RUN dotnet publish "SenxCti.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Estágio 2: Imagem Final de Execução (Leve e Segura)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Cria pasta de armazenamento privado de áudio
RUN mkdir -p /app/audio && chmod 777 /app/audio

# Configurações de ambiente padrão para nuvem
ENV ASPNETCORE_HTTP_PORTS=8080
ENV SENX_AUDIO_ROOT=/app/audio
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

ENTRYPOINT ["dotnet", "SenxCti.Api.dll"]
