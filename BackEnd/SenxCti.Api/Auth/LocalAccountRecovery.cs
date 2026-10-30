using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Npgsql;
using SenxCti.Api.Database;

namespace SenxCti.Api.Auth;

// Recuperacao exclusivamente pelo terminal local; nenhuma rota HTTP publica.
public static class LocalAccountRecovery
{
    public static async Task<bool> Reset(DatabaseConnection database,string email,string password,CancellationToken token)
    {
        if (!AuthRepository.ValidEmail(email) || !AuthRepository.ValidPassword(password))
            throw new ArgumentException("E-mail invalido ou senha fora do limite de 12 a 128 caracteres.");
        await using var connection = await database.OpenAsync(token);
        await using var tx = await connection.BeginTransactionAsync(token);
        UserAccount user;
        await using (var find = new NpgsqlCommand("""
            SELECT "IdUsuario","Nome","Email","Cargo","Perfil","IdEquipe"
            FROM public."Usuario" WHERE lower(btrim("Email"))=@email FOR UPDATE
            """,connection,tx))
        {
            find.Parameters.AddWithValue("email",email.Trim().ToLowerInvariant());
            await using var reader = await find.ExecuteReaderAsync(token);
            if (!await reader.ReadAsync(token)) return false;
            user = new(reader.GetGuid(0),reader.GetString(1),reader.GetString(2),reader.GetString(3),reader.GetString(4),reader.GetGuid(5),"");
        }
        var hasher = new PasswordHasher<UserAccount>(Options.Create(new PasswordHasherOptions { IterationCount = 210000 }));
        await using var update = new NpgsqlCommand("""
            UPDATE public."Usuario" SET "Senha"=@hash,"VersaoAcesso"=gen_random_uuid() WHERE "IdUsuario"=@id
            """,connection,tx);
        update.Parameters.AddWithValue("id",user.Id);
        update.Parameters.AddWithValue("hash",hasher.HashPassword(user,password));
        await update.ExecuteNonQueryAsync(token);
        await tx.CommitAsync(token);
        return true;
    }

    private static string ReadPassword(string label)
    {
        Console.Write(label);
        var characters = new List<char>();
        while (true)
        {
            var key = Console.ReadKey(intercept:true);
            if (key.Key==ConsoleKey.Enter) { Console.WriteLine(); return new string(characters.ToArray()); }
            if (key.Key==ConsoleKey.Escape) throw new OperationCanceledException();
            if (key.Key==ConsoleKey.Backspace) { if(characters.Count>0) characters.RemoveAt(characters.Count-1); }
            else if (!char.IsControl(key.KeyChar) && characters.Count<129) characters.Add(key.KeyChar);
        }
    }

    public static async Task<int> Run(IConfiguration configuration)
    {
        try
        {
            if (Console.IsInputRedirected) { Console.WriteLine("Abra Redefinir-Senha-SENX.cmd em um terminal interativo."); return 1; }
            if (string.IsNullOrWhiteSpace(configuration["SENX_DB_CONNECTION"])) {
                Console.WriteLine("Configure a conexao privada em BackEnd/SenxCti.Api/appsettings.Local.json primeiro."); return 1;
            }
            Console.WriteLine("A senha sera alterada apenas no banco configurado nesta instalacao. Perfil e estado ativo serao preservados.");
            Console.Write("E-mail da conta: ");
            var email = Console.ReadLine()?.Trim() ?? "";
            if (!AuthRepository.ValidEmail(email)) { Console.WriteLine("E-mail invalido."); return 1; }
            var password = ReadPassword("Nova senha (12 a 128 caracteres; digitacao oculta): ");
            var confirmation = ReadPassword("Confirme a nova senha: ");
            if (!AuthRepository.ValidPassword(password) || password!=confirmation) {
                Console.WriteLine("Senhas diferentes ou fora do limite. Nenhuma alteracao foi feita."); return 1;
            }
            Console.Write($"Redefinir a senha de {email}? Digite SIM: ");
            if (Console.ReadLine()!="SIM") { Console.WriteLine("Cancelado sem alterar a conta."); return 1; }
            await using var database = new DatabaseConnection(configuration);
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            var changed = await Reset(database,email,password,timeout.Token);
            Console.WriteLine(changed ? "Senha redefinida. Entre no site com a nova senha; sessoes anteriores foram invalidadas." : "Conta nao encontrada. Nenhuma conta foi criada ou alterada.");
            return changed ? 0 : 1;
        }
        catch (OperationCanceledException) { Console.WriteLine("Operacao cancelada ou tempo excedido."); return 1; }
        catch (Exception error) when (error is NpgsqlException or TimeoutException or ArgumentException or InvalidOperationException)
        {
            Console.WriteLine("Falha ao redefinir. Confira conexao, servico e migracoes 0.1.4/0.1.5. Nenhuma senha foi registrada no terminal.");
            return 1;
        }
    }
}
