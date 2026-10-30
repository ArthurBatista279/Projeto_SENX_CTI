using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Npgsql;

namespace SenxCti.Api.Auth;

public sealed record UserAccount(Guid Id, string Name, string Email, string Job, string Profile, Guid TeamId, string Team)
{
    [JsonIgnore] public string CredentialVersion { get; init; } = "";
}
public sealed record ProfileInput(string? Name, string? Email, string? CurrentPassword, string? NewPassword);
public sealed record UserInput(string? Name, string? Email, string? Password, Guid TeamId, string? Job, string? Profile);
public sealed record SetupInput(string? Name, string? Email, string? Password, Guid? TeamId, string? TeamName, string? Department);
public sealed record LoginInput(string? Email, string? Password);

public sealed class AuthRepository(Database.DatabaseConnection database, IPasswordHasher<UserAccount> hasher)
{
    public static bool ValidEmail(string? email) => email is not null && email.Trim().Length <= 255 &&
        MailAddress.TryCreate(email.Trim(), out var parsed) && parsed.Address == email.Trim();
    public static bool ValidPassword(string? password) => password is { Length: >= 12 and <= 128 };
    public static bool ValidName(string? name) => !string.IsNullOrWhiteSpace(name) && name.Trim().Length <= 200;
    public static bool ValidText(string? text) => !string.IsNullOrWhiteSpace(text) && text.Trim().Length <= 255;
    public static bool ValidUser(UserInput input) => ValidName(input.Name) && ValidEmail(input.Email) && ValidPassword(input.Password) &&
        input.TeamId != Guid.Empty && ValidText(input.Job) && input.Profile is "Administrador" or "Colaborador";
    public static bool ValidSetup(SetupInput input) => ValidName(input.Name) && ValidEmail(input.Email) && ValidPassword(input.Password) &&
        (input.TeamId is { } id ? id != Guid.Empty : ValidText(input.TeamName) && ValidText(input.Department));
    public static bool ValidProfile(ProfileInput input) => ValidName(input.Name) && ValidEmail(input.Email) &&
        input.CurrentPassword is { Length: > 0 and <= 128 } &&
        (string.IsNullOrEmpty(input.NewPassword) || ValidPassword(input.NewPassword));
    public static ClaimsPrincipal Principal(UserAccount user) => new(new ClaimsIdentity([
        new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Name, user.Name),
        new(ClaimTypes.Email, user.Email), new(ClaimTypes.Role, user.Profile), new("teamId", user.TeamId.ToString()),
        new("credentialVersion", user.CredentialVersion)
    ], CookieAuthenticationDefaults.AuthenticationScheme));

    public async Task<object> SetupStatus(CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var count = new NpgsqlCommand("""SELECT count(*) FROM public."Usuario" """, connection);
        var required = (long)(await count.ExecuteScalarAsync(token))! == 0;
        var teams = new List<object>();
        if (required)
        {
            await using var command = new NpgsqlCommand("""SELECT "IdEquipe", "Nome" FROM public."Equipe" ORDER BY "Nome" LIMIT 1000""", connection);
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) teams.Add(new { id = reader.GetGuid(0), name = reader.GetString(1) });
        }
        return new { setupRequired = required, teams };
    }

    private const string SelectUser = """
        SELECT u."IdUsuario",u."Nome",u."Email",u."Cargo",u."Perfil",u."IdEquipe",e."Nome",u."Senha",u."VersaoAcesso"
        FROM public."Usuario" u JOIN public."Equipe" e ON e."IdEquipe"=u."IdEquipe"
        """;
    private static UserAccount ReadUser(NpgsqlDataReader reader) => new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2),
        reader.GetString(3), reader.GetString(4), reader.GetGuid(5), reader.GetString(6))
        { CredentialVersion = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(reader.GetString(7) + reader.GetGuid(8).ToString()))) };

    public async Task<UserAccount?> Find(Guid id, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var command = new NpgsqlCommand(SelectUser + """ WHERE u."IdUsuario"=@id AND u."Ativo" """, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(token);
        return await reader.ReadAsync(token) ? ReadUser(reader) : null;
    }

    // Mantém o custo da verificação mesmo quando o e-mail não existe.
    private readonly string dummyHash = hasher.HashPassword(new(Guid.Empty,"","","","",Guid.Empty,""), Guid.NewGuid().ToString());
    public async Task<UserAccount?> Login(LoginInput input, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var command = new NpgsqlCommand(SelectUser + """ WHERE lower(btrim(u."Email"))=@email AND u."Ativo" """, connection);
        command.Parameters.AddWithValue("email", input.Email!.Trim().ToLowerInvariant());
        UserAccount? user = null;
        var hash = dummyHash;
        await using (var reader = await command.ExecuteReaderAsync(token))
        {
            if (await reader.ReadAsync(token)) { user = ReadUser(reader); hash = reader.GetString(7); }
        }
        PasswordVerificationResult result;
        try { result = hasher.VerifyHashedPassword(user ?? new(Guid.Empty,"","","","",Guid.Empty,""), hash, input.Password!); }
        catch (FormatException) { return null; } // Senhas legadas nunca são aceitas como texto puro.
        if (user is null || result == PasswordVerificationResult.Failed) return null;
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            await using var update = new NpgsqlCommand("""UPDATE public."Usuario" SET "Senha"=@hash WHERE "IdUsuario"=@id AND "Senha"=@old""", connection);
            update.Parameters.AddWithValue("id", user.Id);
            update.Parameters.AddWithValue("hash", hasher.HashPassword(user, input.Password!));
            update.Parameters.AddWithValue("old", hash);
            await update.ExecuteNonQueryAsync(token);
        }
        return await Find(user.Id,token);
    }

    public async Task<UserAccount?> SaveProfile(Guid id, ProfileInput input, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        UserAccount user;
        string hash;
        await using (var command = new NpgsqlCommand(SelectUser + """ WHERE u."IdUsuario"=@id FOR UPDATE OF u""",connection,transaction))
        {
            command.Parameters.AddWithValue("id",id);
            await using var reader = await command.ExecuteReaderAsync(token);
            if (!await reader.ReadAsync(token)) return null;
            user = ReadUser(reader);
            hash = reader.GetString(7);
        }
        try
        {
            if (hasher.VerifyHashedPassword(user,hash,input.CurrentPassword!) == PasswordVerificationResult.Failed) return null;
        }
        catch (FormatException) { return null; }
        var nextHash = string.IsNullOrEmpty(input.NewPassword) ? hash : hasher.HashPassword(user,input.NewPassword);
        await using (var command = new NpgsqlCommand("""
            UPDATE public."Usuario" SET "Nome"=@name,"Email"=@email,"Senha"=@hash WHERE "IdUsuario"=@id
            """,connection,transaction))
        {
            command.Parameters.AddWithValue("id",id);
            command.Parameters.AddWithValue("name",input.Name!.Trim());
            command.Parameters.AddWithValue("email",input.Email!.Trim().ToLowerInvariant());
            command.Parameters.AddWithValue("hash",nextHash);
            await command.ExecuteNonQueryAsync(token);
        }
        await transaction.CommitAsync(token);
        return await Find(id,token);
    }

    private async Task<Guid> Insert(NpgsqlConnection connection, NpgsqlTransaction? transaction, UserInput input, CancellationToken token)
    {
        var id = Guid.NewGuid();
        var user = new UserAccount(id,input.Name!.Trim(),input.Email!.Trim().ToLowerInvariant(),input.Job!.Trim(),input.Profile!,input.TeamId,"");
        await using var command = new NpgsqlCommand("""
            INSERT INTO public."Usuario" ("IdUsuario","IdEquipe","Nome","Email","Imagem","Cargo","Senha","Perfil")
            VALUES (@id,@team,@name,@email,'',@job,@hash,@profile)
            """, connection, transaction);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("team", user.TeamId);
        command.Parameters.AddWithValue("name", user.Name);
        command.Parameters.AddWithValue("email", user.Email);
        command.Parameters.AddWithValue("job", user.Job);
        command.Parameters.AddWithValue("hash", hasher.HashPassword(user, input.Password!));
        command.Parameters.AddWithValue("profile", user.Profile);
        await command.ExecuteNonQueryAsync(token);
        return id;
    }
    public async Task<Guid> Create(UserInput input, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        return await Insert(connection,null,input,token);
    }

    public async Task<Guid?> Setup(SetupInput input, CancellationToken token)
    {
        await using var connection = await database.OpenAsync(token);
        await using var transaction = await connection.BeginTransactionAsync(token);
        // Serializa o primeiro cadastro inclusive contra INSERTs feitos por outra conexão.
        await using (var tableLock = new NpgsqlCommand("""LOCK TABLE public."Usuario" IN EXCLUSIVE MODE""",connection,transaction))
            await tableLock.ExecuteNonQueryAsync(token);
        await using (var count = new NpgsqlCommand("""SELECT count(*) FROM public."Usuario" """,connection,transaction))
            if ((long)(await count.ExecuteScalarAsync(token))! != 0) return null;
        var teamId = input.TeamId;
        if (teamId is null)
        {
            await using var team = new NpgsqlCommand("""INSERT INTO public."Equipe" ("Nome","Departamento") VALUES (@name,@department) RETURNING "IdEquipe" """,connection,transaction);
            team.Parameters.AddWithValue("name",input.TeamName!.Trim());
            team.Parameters.AddWithValue("department",input.Department!.Trim());
            teamId = (Guid)(await team.ExecuteScalarAsync(token))!;
        }
        var id = await Insert(connection,transaction,new(input.Name,input.Email,input.Password,teamId.Value,"Administrador","Administrador"),token);
        await transaction.CommitAsync(token);
        return id;
    }
}
