using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SenxCti.Api.Auth;

namespace SenxCti.Api.Tests;

public sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        if(Environment.GetEnvironmentVariable("SENX_RUN_DATABASE_TESTS")!="1")
            Skip="Defina SENX_RUN_DATABASE_TESTS=1 para testar o PostgreSQL real com registros QA temporários.";
    }
}

[CollectionDefinition("PostgreSQL",DisableParallelization=true)]
public sealed class PostgreSqlCollection;

[Collection("PostgreSQL")]
public sealed class PostgreSqlTests
{
    private static WebApplicationFactory<Program> Factory() => new WebApplicationFactory<Program>()
        .WithWebHostBuilder(b=>b.UseEnvironment("Development"));
    private static async Task<NpgsqlConnection> Open(WebApplicationFactory<Program> factory)
    {
        var connection=new NpgsqlConnection(factory.Services.GetRequiredService<IConfiguration>()["SENX_DB_CONNECTION"]);
        await connection.OpenAsync();
        return connection;
    }
    private static async Task Delete(NpgsqlConnection connection,string table,string column,Guid[] ids)
    {
        // Somente identificadores fixos usados pelos testes abaixo.
        await using var command=new NpgsqlCommand($"DELETE FROM public.\"{table}\" WHERE \"{column}\"=ANY(@ids)",connection);
        command.Parameters.AddWithValue("ids",ids);
        await command.ExecuteNonQueryAsync();
    }
    private static async Task Login(HttpClient client,string email,string password)
    {
        var response=await ApiTests.Post(client,"/api/auth/login",new { email,password });
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var cookie=string.Join(";",response.Headers.GetValues("Set-Cookie"));
        Assert.Contains("httponly",cookie.ToLowerInvariant());
        Assert.Contains("samesite=strict",cookie.ToLowerInvariant());
    }

    private static async Task<HttpResponseMessage> SaveProfile(HttpClient client,object input)
    {
        var csrf=await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        client.DefaultRequestHeaders.Add("X-CSRF-Token",csrf.GetProperty("token").GetString());
        return await client.PutAsJsonAsync("/api/auth/profile",input);
    }

    [DatabaseFact]
    public async Task Profile_UpdatesOnlyOwnIdentity_AndPasswordRevokesSessions()
    {
        await using var factory=Factory();
        using var first=factory.CreateClient();
        using var otherSession=factory.CreateClient();
        await using var db=await Open(factory);
        var auth=factory.Services.GetRequiredService<AuthRepository>();
        var marker=Guid.NewGuid().ToString("N");
        var password=Guid.NewGuid().ToString()+"Aa!";
        var newPassword=Guid.NewGuid().ToString()+"Bb!";
        var email="profile-"+marker+"@example.test";
        var updatedEmail="updated-"+marker+"@example.test";
        Guid? teamId=null,userId=null,otherId=null;
        try
        {
            await using(var team=new NpgsqlCommand("""INSERT INTO public."Equipe" ("Nome","Departamento") VALUES (@name,'QA') RETURNING "IdEquipe" """,db))
            {team.Parameters.AddWithValue("name","QA-"+marker);teamId=(Guid)(await team.ExecuteScalarAsync())!;}
            userId=await auth.Create(new("QA Perfil",email,password,teamId.Value,"QA","Colaborador"),default);
            var duplicateEmail="other-"+marker+"@example.test";
            otherId=await auth.Create(new("QA Outro",duplicateEmail,password,teamId.Value,"QA","Colaborador"),default);
            await Login(first,email,password);
            await Login(otherSession,email,password);
            Assert.Equal(HttpStatusCode.Forbidden,(await first.PutAsJsonAsync("/api/auth/profile",new {})).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest,(await SaveProfile(first,new {name="Inválido",email,currentPassword="wrong",newPassword=(string?)null})).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict,(await SaveProfile(first,new {name="Não deve salvar",email=duplicateEmail,currentPassword=password,newPassword=(string?)null})).StatusCode);
            Assert.Equal("QA Perfil",(await auth.Find(userId.Value,default))!.Name);
            var saved=await SaveProfile(first,new {name="QA Atualizado",email=updatedEmail.ToUpperInvariant(),currentPassword=password,newPassword=(string?)null,profile="Administrador",teamId=Guid.NewGuid(),id=otherId});
            Assert.Equal(HttpStatusCode.OK,saved.StatusCode);
            var response=await saved.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(response.GetProperty("requiresLogin").GetBoolean());
            Assert.DoesNotContain("credentialVersion",response.GetRawText(),StringComparison.OrdinalIgnoreCase);
            var user=(await auth.Find(userId.Value,default))!;
            Assert.Equal("QA Atualizado",user.Name);Assert.Equal(updatedEmail,user.Email);
            Assert.Equal("Colaborador",user.Profile);Assert.Equal(teamId,user.TeamId);Assert.Equal("QA",user.Job);
            Assert.Equal("QA Outro",(await auth.Find(otherId.Value,default))!.Name);
            Assert.Equal(HttpStatusCode.OK,(await otherSession.GetAsync("/api/auth/session")).StatusCode);
            var changed=await SaveProfile(first,new {name=user.Name,email=user.Email,currentPassword=password,newPassword});
            Assert.Equal(HttpStatusCode.OK,changed.StatusCode);
            Assert.True((await changed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("requiresLogin").GetBoolean());
            Assert.Equal(HttpStatusCode.Unauthorized,(await first.GetAsync("/api/auth/session")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,(await otherSession.GetAsync("/api/auth/session")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,(await ApiTests.Post(first,"/api/auth/login",new {email=updatedEmail,password})).StatusCode);
            await Login(first,updatedEmail,newPassword);
            Assert.Equal(HttpStatusCode.OK,(await first.GetAsync("/api/auth/session")).StatusCode);
        }
        finally
        {
            if(userId is not null)await Delete(db,"Usuario","IdUsuario",[userId.Value]);
            if(otherId is not null)await Delete(db,"Usuario","IdUsuario",[otherId.Value]);
            if(teamId is not null)await Delete(db,"Equipe","IdEquipe",[teamId.Value]);
        }
    }

    [DatabaseFact]
    public async Task Accounts_EnforcePermissionsScopePersistenceAndLogout()
    {
        await using var factory=Factory();
        using var admin=factory.CreateClient();
        using var employee=factory.CreateClient();
        await using var db=await Open(factory);
        var auth=factory.Services.GetRequiredService<AuthRepository>();
        var marker=Guid.NewGuid().ToString("N");
        var password=Guid.NewGuid().ToString()+"Aa!";
        Guid? adminId=null,employeeId=null,teamId=null,criterionId=null;
        var clients=new[]{Guid.NewGuid(),Guid.NewGuid()};
        var calls=new[]{Guid.NewGuid(),Guid.NewGuid()};
        try
        {
            await using(var team=new NpgsqlCommand("""INSERT INTO public."Equipe" ("Nome","Departamento") VALUES (@name,'QA') RETURNING "IdEquipe" """,db))
            { team.Parameters.AddWithValue("name","QA-"+marker); teamId=(Guid)(await team.ExecuteScalarAsync())!; }
            adminId=await auth.Create(new("QA Admin","admin-"+marker+"@example.test",password,teamId.Value,"QA","Administrador"),default);
            var wrong=await ApiTests.Post(admin,"/api/auth/login",new {email="admin-"+marker+"@example.test",password="wrong-password"});
            Assert.Equal(HttpStatusCode.Unauthorized,wrong.StatusCode);
            await Login(admin,"ADMIN-"+marker+"@EXAMPLE.TEST",password);
            var health=await admin.GetFromJsonAsync<JsonElement>("/api/database/health");
            Assert.Equal("ok",health.GetProperty("status").GetString());
            Assert.Equal(11,health.GetProperty("tables").GetArrayLength());

            var newUser=new {name="QA Colaborador",email="employee-"+marker+"@example.test",password,teamId,job="Atendente",profile="Colaborador"};
            var created=await ApiTests.Post(admin,"/api/data/users",newUser);
            Assert.Equal(HttpStatusCode.Created,created.StatusCode);
            employeeId=(await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
            Assert.Equal(HttpStatusCode.Conflict,(await ApiTests.Post(admin,"/api/data/users",newUser)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest,(await ApiTests.Post(admin,"/api/data/users",new {name="QA",email="bad-"+marker+"@example.test",password,teamId,job="QA",profile="SuperAdmin"})).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest,(await ApiTests.Post(admin,"/api/data/teams",new {name=" ",department="QA"})).StatusCode);

            var criterion=await ApiTests.Post(admin,"/api/data/criteria",new {name="QA-"+marker,description="QA",rule="QA",version="1",active=true});
            Assert.Equal(HttpStatusCode.Created,criterion.StatusCode);
            criterionId=(await criterion.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
            var csrf=await admin.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
            admin.DefaultRequestHeaders.Remove("X-CSRF-Token");
            admin.DefaultRequestHeaders.Add("X-CSRF-Token",csrf.GetProperty("token").GetString());
            var update=await admin.PutAsJsonAsync("/api/data/criteria/"+criterionId,new {name="QA-"+marker,description="Atualizado",rule="QA",version="2",active=false});
            Assert.Equal(HttpStatusCode.OK,update.StatusCode);

            for(var i=0;i<2;i++)
            {
                await using var insert=new NpgsqlCommand("""
                    INSERT INTO public."DadosCliente" ("IdDadosCliente","IdUsuario","Nome","Email","Telefone","Situacao","Consentimento")
                    VALUES (@client,@user,'Cliente QA',@clientEmail,@clientPhone,'QA',true);
                    INSERT INTO public."Ligacao" ("IdLigacao","IdFuncionario","IdCliente","Duracao","Numero_Origem","Numero_Destino","Stats","Hash_Audio","Caminho_Arquivo","IdentificadorPABX","Direcao")
                    VALUES (@call,@user,@client,'00:01:00','11999999999','11999999999','QA','QA','QA',@pabx,'Entrada');
                    """,db);
                insert.Parameters.AddWithValue("client",clients[i]);insert.Parameters.AddWithValue("call",calls[i]);
                insert.Parameters.AddWithValue("clientEmail",clients[i]+"@example.test");
                insert.Parameters.AddWithValue("clientPhone",Random.Shared.NextInt64(10000000000,99999999999).ToString());
                insert.Parameters.AddWithValue("user",i==0?adminId.Value:employeeId.Value);
                insert.Parameters.AddWithValue("pabx","QA-"+marker+"-"+i);
                await insert.ExecuteNonQueryAsync();
            }

            await Login(employee,newUser.email,password);
            var scoped=await employee.GetFromJsonAsync<JsonElement>("/api/data/snapshot");
            var visible=scoped.GetProperty("calls").EnumerateArray().ToArray();
            Assert.Single(visible);Assert.Equal(calls[1],visible[0].GetProperty("id").GetGuid());
            Assert.Single(scoped.GetProperty("users").EnumerateArray());
            Assert.Equal(1,scoped.GetProperty("counts").GetProperty("Ligacao").GetInt64());
            Assert.DoesNotContain(adminId.Value.ToString(),scoped.GetRawText());
            Assert.DoesNotContain("senha",scoped.GetRawText().ToLowerInvariant());
            foreach(var endpoint in new[]{"/api/data/users","/api/data/teams","/api/data/criteria"})
                Assert.Equal(HttpStatusCode.Forbidden,(await ApiTests.Post(employee,endpoint,newUser)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden,(await employee.GetAsync("/api/database/health")).StatusCode);

            var snapshot=await admin.GetFromJsonAsync<JsonElement>("/api/data/snapshot");
            Assert.Contains(snapshot.GetProperty("users").EnumerateArray(),u=>u.GetProperty("id").GetGuid()==employeeId);
            Assert.Contains(snapshot.GetProperty("criteria").EnumerateArray(),r=>r.GetProperty("id").GetGuid()==criterionId && !r.GetProperty("active").GetBoolean());

            await using(var hashes=new NpgsqlCommand("""SELECT "Senha" FROM public."Usuario" WHERE "IdUsuario"=@id""",db))
            {
                hashes.Parameters.AddWithValue("id",employeeId.Value);
                var hash=(string)(await hashes.ExecuteScalarAsync())!;
                Assert.NotEqual(password,hash);Assert.True(hash.Length>40);
            }
            admin.DefaultRequestHeaders.Remove("X-CSRF-Token");
            Assert.Equal(HttpStatusCode.Forbidden,(await admin.PostAsJsonAsync("/api/data/teams",new {name="QA",department="QA"})).StatusCode);
            Assert.Equal(HttpStatusCode.OK,(await ApiTests.Post(employee,"/api/auth/logout",new {})).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,(await employee.GetAsync("/api/auth/session")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,(await employee.GetAsync("/api/data/snapshot")).StatusCode);
            await Login(employee,newUser.email,password);
            await Delete(db,"Ligacao","IdLigacao",calls);
            await Delete(db,"DadosCliente","IdDadosCliente",clients);
            await Delete(db,"Usuario","IdUsuario",[employeeId.Value]);
            Assert.Equal(HttpStatusCode.Unauthorized,(await employee.GetAsync("/api/auth/session")).StatusCode);
        }
        finally
        {
            await Delete(db,"Ligacao","IdLigacao",calls);
            await Delete(db,"DadosCliente","IdDadosCliente",clients);
            if(criterionId is not null)await Delete(db,"Criterio","IdCriterio",[criterionId.Value]);
            if(employeeId is not null)await Delete(db,"Usuario","IdUsuario",[employeeId.Value]);
            if(adminId is not null)await Delete(db,"Usuario","IdUsuario",[adminId.Value]);
            if(teamId is not null)await Delete(db,"Equipe","IdEquipe",[teamId.Value]);
        }
    }

    [DatabaseFact]
    public async Task Setup_IsOneTime_AndDoesNotReplaceExistingAccounts()
    {
        await using var factory=Factory();
        using var first=factory.CreateClient();
        using var second=factory.CreateClient();
        await using var db=await Open(factory);
        var marker=Guid.NewGuid().ToString("N");
        Guid? teamId=null;
        Guid[] created=[];
        try
        {
            await using(var team=new NpgsqlCommand("""INSERT INTO public."Equipe" ("Nome","Departamento") VALUES (@name,'QA') RETURNING "IdEquipe" """,db))
            {team.Parameters.AddWithValue("name","QA-"+marker);teamId=(Guid)(await team.ExecuteScalarAsync())!;}
            var input=new {name="QA Setup",email="setup-"+marker+"@example.test",password=Guid.NewGuid().ToString()+"Aa!",teamId};
            var before=await first.GetFromJsonAsync<JsonElement>("/api/auth/status");
            var results=await Task.WhenAll(ApiTests.Post(first,"/api/auth/setup",input),ApiTests.Post(second,"/api/auth/setup",input));
            created=await GetCreated(results);
            if(before.GetProperty("setupRequired").GetBoolean())
            {
                Assert.Single(results,r=>r.StatusCode==HttpStatusCode.Created);
                Assert.Single(results,r=>r.StatusCode==HttpStatusCode.Conflict);
            }
            else Assert.All(results,r=>Assert.Equal(HttpStatusCode.Conflict,r.StatusCode));
            Assert.False((await first.GetFromJsonAsync<JsonElement>("/api/auth/status")).GetProperty("setupRequired").GetBoolean());
        }
        finally
        {
            await Delete(db,"Usuario","IdUsuario",created);
            if(teamId is not null)await Delete(db,"Equipe","IdEquipe",[teamId.Value]);
        }
    }
    private static async Task<Guid[]> GetCreated(HttpResponseMessage[] results)
    {
        var ids=new List<Guid>();
        foreach(var result in results.Where(r=>r.StatusCode==HttpStatusCode.Created))
            ids.Add((await result.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        return ids.ToArray();
    }

    [DatabaseFact]
    public async Task LegacyPlaintextPassword_IsNeverAccepted()
    {
        await using var factory=Factory();
        using var client=factory.CreateClient();
        await using var db=await Open(factory);
        var auth=factory.Services.GetRequiredService<AuthRepository>();
        var marker=Guid.NewGuid().ToString("N");
        Guid? teamId=null,userId=null;
        try
        {
            await using(var team=new NpgsqlCommand("""INSERT INTO public."Equipe" ("Nome","Departamento") VALUES (@name,'QA') RETURNING "IdEquipe" """,db))
            {team.Parameters.AddWithValue("name","QA-"+marker);teamId=(Guid)(await team.ExecuteScalarAsync())!;}
            userId=await auth.Create(new("QA Legacy","legacy-"+marker+"@example.test",Guid.NewGuid().ToString(),teamId.Value,"QA","Colaborador"),default);
            await using(var change=new NpgsqlCommand("""UPDATE public."Usuario" SET "Senha"='LegacyPlainText' WHERE "IdUsuario"=@id""",db))
            {change.Parameters.AddWithValue("id",userId.Value);await change.ExecuteNonQueryAsync();}
            var response=await ApiTests.Post(client,"/api/auth/login",new {email="legacy-"+marker+"@example.test",password="LegacyPlainText"});
            Assert.Equal(HttpStatusCode.Unauthorized,response.StatusCode);
        }
        finally
        {
            if(userId is not null)await Delete(db,"Usuario","IdUsuario",[userId.Value]);
            if(teamId is not null)await Delete(db,"Equipe","IdEquipe",[teamId.Value]);
        }
    }
}
