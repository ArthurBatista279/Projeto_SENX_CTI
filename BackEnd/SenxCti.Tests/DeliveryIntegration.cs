using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SenxCti.Api.Auth;
using SenxCti.Api.Database;

internal static class DeliveryIntegration
{
    public static async Task<int> Run(bool deletionChecks = false)
    {
        var api = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../SenxCti.Api"));
        var configuration = new ConfigurationBuilder().SetBasePath(api).AddJsonFile("appsettings.Local.json",true).AddEnvironmentVariables().Build();
        var secret = configuration["SENX_TEST_DB_CONNECTION"] ?? (deletionChecks ? null : configuration["SENX_DB_CONNECTION"]);
        if (string.IsNullOrWhiteSpace(secret)) { Console.WriteLine("FALTA configuração privada de banco."); return 1; }
        if (deletionChecks && DatabaseConnection.CreateSettings(secret).Host is not ("localhost" or "127.0.0.1" or "::1"))
        { Console.WriteLine("Exclusão em teste exige PostgreSQL local e isolado."); return 1; }
        var marker = Guid.NewGuid().ToString("N");
        var password = "Qa!" + Guid.NewGuid().ToString("N");
        var adminEmail = "qa-admin-" + marker + "@example.invalid";
        var userEmail = "qa-user-" + marker + "@example.invalid";
        var team = Guid.NewGuid(); var customer = Guid.NewGuid(); var call = Guid.NewGuid(); var analysis = Guid.NewGuid();
        var sharedCall = Guid.NewGuid(); var emptyTeam = Guid.NewGuid();
        Guid admin = default, user = default, criterion = default, extraUser = default;
        var audio = Path.Combine(Path.GetTempPath(),"senx-audio-" + marker);
        Directory.CreateDirectory(audio);
        await File.WriteAllBytesAsync(Path.Combine(audio,"sample.wav"),new byte[128]);
        int passed = 0;
        void Check(bool ok,string label) { if (!ok) throw new InvalidOperationException(label); passed++; }
        await using var connection = new NpgsqlConnection(secret);
        await connection.OpenAsync();
        async Task Sql(string sql)
        {
            await using var command = new NpgsqlCommand(sql,connection);
            command.Parameters.AddWithValue("team",team); command.Parameters.AddWithValue("customer",customer);
            command.Parameters.AddWithValue("call",call); command.Parameters.AddWithValue("analysis",analysis);
            command.Parameters.AddWithValue("user",user); command.Parameters.AddWithValue("admin",admin);
            command.Parameters.AddWithValue("criterion",criterion); command.Parameters.AddWithValue("extraUser",extraUser);
            command.Parameters.AddWithValue("sharedCall",sharedCall); command.Parameters.AddWithValue("emptyTeam",emptyTeam);
            await command.ExecuteNonQueryAsync();
        }
        using var factory = new DeliveryFactory(api,secret,audio);
        using var adminClient = factory.CreateClient();
        using var collaborator = factory.CreateClient();
        async Task<HttpResponseMessage> Write(HttpClient client, HttpMethod method, string path, object body)
        {
            var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
            var request = new HttpRequestMessage(method,path) { Content = JsonContent.Create(body) };
            request.Headers.Add("X-CSRF-Token",csrf.GetProperty("token").GetString());
            return await client.SendAsync(request);
        }
        async Task<JsonElement> Snapshot(HttpClient client) => await client.GetFromJsonAsync<JsonElement>("/api/data/snapshot");
        JsonElement FindCall(JsonElement snapshot) => snapshot.GetProperty("calls").EnumerateArray().Single(c=>c.GetProperty("id").GetGuid()==call);
        try
        {
            await Sql("""INSERT INTO public."Equipe" ("IdEquipe","Nome","Departamento") VALUES (@team,'QA integração 0.1.5','QA temporário')""");
            var auth = factory.Services.GetRequiredService<AuthRepository>();
            admin = await auth.Create(new("QA Administrador",adminEmail,password,team,"QA","Administrador"),default);
            user = await auth.Create(new("QA Colaborador",userEmail,password,team,"QA","Colaborador"),default);
            await Sql("""
                INSERT INTO public."DadosCliente" ("IdDadosCliente","IdUsuario","Nome","Email","Telefone","Situacao","Consentimento")
                VALUES (@customer,@user,'QA Contato','qa-delivery@example.invalid','11999999998','Teste',true);
                INSERT INTO public."Ligacao" ("IdLigacao","IdFuncionario","IdCliente","Duracao","Numero_Origem","Numero_Destino","Stats","Hash_Audio","Caminho_Arquivo","IdentificadorPABX","Direcao")
                VALUES (@call,@user,@customer,'00:02:00','11999999998','11888888888','Concluída','qa','sample.wav','QA','Entrada');
                INSERT INTO public."Analise" ("IdAnalise","IdLigacao","ResolucaoEncaminhamento","StatusProcessamento","Modelo_Versao","Transcricao_Texto","Resumo_Texto","Cancelamento","Oportunidade","ScoreGeral","ProblemaNecessidade","Compromissos")
                VALUES (@analysis,@call,'QA',true,'fixture-não-IA','[00:01] Atendente: teste','Resumo original de teste',false,false,80,'QA','QA');
                """);
            Check((await Write(adminClient,HttpMethod.Post,"/api/auth/login",new {email=adminEmail,password})).StatusCode==HttpStatusCode.OK,"Login real admin");
            Check((await Write(collaborator,HttpMethod.Post,"/api/auth/login",new {email=userEmail,password})).StatusCode==HttpStatusCode.OK,"Login real colaborador");
            // Data_Inicio stores UTC without an offset; the snapshot exposes Sao Paulo calendar dates and times.
            await Sql("""UPDATE public."Ligacao" SET "Data_Inicio"=timestamp '2099-11-11 15:30:00' WHERE "IdLigacao"=@call""");
            foreach (var client in new[] { adminClient, collaborator })
            {
                var localCall = FindCall(await Snapshot(client));
                Check(localCall.GetProperty("date").GetString()=="2099-11-11" && localCall.GetProperty("time").GetString()=="12:30",
                    "Ligação às 15:30 UTC aparece às 12:30 em São Paulo para ambos os perfis");
            }
            await Sql("""UPDATE public."Ligacao" SET "Data_Inicio"=timestamp '2099-11-12 01:30:00' WHERE "IdLigacao"=@call""");
            var previousDayCall = FindCall(await Snapshot(adminClient));
            Check(previousDayCall.GetProperty("date").GetString()=="2099-11-11" && previousDayCall.GetProperty("time").GetString()=="22:30",
                "Conversão de fuso também ajusta a data na virada do dia");
            await Sql("""UPDATE public."Ligacao" SET "Data_Inicio"=timezone('UTC',now()) WHERE "IdLigacao"=@call""");
            await Sql("""UPDATE public."Analise" SET "Prioridade"=2,"MotivoPrioridade"='Cliente relata fraude na cobrança.' WHERE "IdAnalise"=@analysis""");
            foreach (var client in new[] { adminClient, collaborator })
            {
                var prioritized = FindCall(await Snapshot(client));
                Check(prioritized.GetProperty("priority").GetInt32()==2 && prioritized.GetProperty("priorityReason").GetString()!.Contains("fraude"),
                    "Prioridade e motivo persistidos chegam aos dois perfis");
            }
            // A more recent normal call must not displace a high-priority call at the SQL limit.
            await Sql("""
                INSERT INTO public."Ligacao" ("IdLigacao","IdFuncionario","IdCliente","Data_Inicio","Duracao","Numero_Origem","Numero_Destino","Stats","Hash_Audio","Caminho_Arquivo","IdentificadorPABX","Direcao")
                VALUES (@sharedCall,@user,@customer,timestamp '2099-11-12 15:30:00','00:02:00','11999999998','11888888888','Concluída','qa','','QA prioridade','Entrada');
                """);
            var topCall = (await collaborator.GetFromJsonAsync<JsonElement>("/api/data/snapshot?limit=1")).GetProperty("calls")[0];
            Check(topCall.GetProperty("id").GetGuid()==call,"Prioridade ordena antes da data e do limite SQL");
            await Sql("""DELETE FROM public."Ligacao" WHERE "IdLigacao"=@sharedCall""");
            await Sql("""UPDATE public."Analise" SET "Prioridade"=NULL,"MotivoPrioridade"=NULL,"Cancelamento"=true WHERE "IdAnalise"=@analysis""");
            Check(FindCall(await Snapshot(collaborator)).GetProperty("priority").GetInt32()==2,"Cancelamento legado preserva prioridade alta");
            await Sql("""UPDATE public."Analise" SET "Modelo_Versao"='offline/simulado' WHERE "IdAnalise"=@analysis""");
            Check(FindCall(await Snapshot(collaborator)).GetProperty("priority").GetInt32()==0,"Simulação não gera prioridade real");
            await Sql("""UPDATE public."Analise" SET "Cancelamento"=false,"Modelo_Versao"='fixture-não-IA' WHERE "IdAnalise"=@analysis""");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/teams/{team}",new {name="QA integração 0.1.5",department="QA atualizado"})).IsSuccessStatusCode,"Equipe salva via API");
            Check((await Snapshot(adminClient)).GetProperty("teams").EnumerateArray().Single(t=>t.GetProperty("id").GetGuid()==team).GetProperty("department").GetString()=="QA atualizado","Releitura equipe");
            var criterionBody = new {name="QA critério "+marker,description="QA",rule="Regra de teste",version="1",active=true};
            var createdCriterion = await Write(adminClient,HttpMethod.Post,"/api/data/criteria",criterionBody);
            Check(createdCriterion.StatusCode==HttpStatusCode.Created,"Critério cadastrado");
            criterion = (await createdCriterion.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/criteria/{criterion}",new {criterionBody.name,criterionBody.description,criterionBody.rule,criterionBody.version,active=false})).IsSuccessStatusCode,"Critério desativado via API");
            Check(!(await Snapshot(adminClient)).GetProperty("criteria").EnumerateArray().Single(c=>c.GetProperty("id").GetGuid()==criterion).GetProperty("active").GetBoolean(),"Releitura critério");
            var createdUser = await Write(adminClient,HttpMethod.Post,"/api/data/users",new {name="QA conta extra",email="qa-extra-"+marker+"@example.invalid",password,teamId=team,job="QA",profile="Colaborador"});
            Check(createdUser.StatusCode==HttpStatusCode.Created,"Cadastro de usuário via tela/API");
            extraUser = (await createdUser.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
            var editUser = await Write(adminClient,HttpMethod.Put,$"/api/data/users/{extraUser}",new {name="QA conta extra",email="qa-extra-"+marker+"@example.invalid",password=(string?)null,teamId=team,job="Gestora",profile="Colaborador"});
            Check(editUser.StatusCode==HttpStatusCode.OK,"Edição de colaborador (alteração de cargo para Gestora)");
            var userInSnap = (await Snapshot(adminClient)).GetProperty("users").EnumerateArray().Single(u=>u.GetProperty("id").GetGuid()==extraUser);
            Check(userInSnap.GetProperty("role").GetString()=="Gestora","Cargo atualizado refletido no snapshot");
            var before = FindCall(await Snapshot(adminClient));
            Check(!before.GetProperty("reviewed").GetBoolean(),"Processamento não equivale a revisão humana");
            Check((await Snapshot(collaborator)).GetProperty("users").GetArrayLength()==1,"Escopo próprio");
            var payload = new {analysisId=analysis,revision=(Guid?)null,summary="Revisão humana QA",score=0,validate=false};
            Check((await Write(collaborator,HttpMethod.Put,$"/api/data/calls/{call}/review",payload)).StatusCode==HttpStatusCode.Forbidden,"Colaborador não revisa");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/calls/{call}/review",payload)).StatusCode==HttpStatusCode.OK,"Revisão persistida");
            var reviewed = FindCall(await Snapshot(adminClient));
            Check(reviewed.GetProperty("summary").GetString()==payload.summary,"Releitura resumo");
            Check(reviewed.GetProperty("score").GetInt32()==0,"Nota zero preservada");
            var rankingPath = $"/api/data/rankings?teamId={team}";
            async Task<JsonElement> GetRanking(HttpClient client) => (await client.GetFromJsonAsync<JsonElement>(rankingPath)).GetProperty("rows");
            var unvalidated = (await GetRanking(adminClient)).EnumerateArray().Single(r=>r.GetProperty("name").GetString()=="QA Colaborador");
            Check(unvalidated.GetProperty("score").ValueKind==JsonValueKind.Null && unvalidated.GetProperty("pending").GetInt64()==1,
                "Ranking exclui nota sem validação e mostra pendência");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/calls/{call}/review",payload)).StatusCode==HttpStatusCode.Conflict,"Conflito de revisão antiga");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/calls/{call}/review",new {analysisId=analysis,revision=reviewed.GetProperty("revision").GetGuid(),summary=payload.summary,score=0,validate=true})).IsSuccessStatusCode,"Validação humana");
            Check(FindCall(await Snapshot(adminClient)).GetProperty("reviewed").GetBoolean(),"Releitura validação");
            await using (var original = new NpgsqlCommand("""SELECT "Resumo_Texto" FROM public."Analise" WHERE "IdAnalise"=@id""",connection)) {
                original.Parameters.AddWithValue("id",analysis);
                Check((string?)await original.ExecuteScalarAsync()=="Resumo original de teste","Saída IA preservada");
            }
            var rankingRows = await GetRanking(adminClient);
            var ranked = rankingRows[0];
            Check(ranked.GetProperty("score").GetDecimal()==0 && ranked.GetProperty("position").GetInt64()==1 &&
                ranked.GetProperty("evaluated").GetInt64()==1,"Ranking inclui nota zero validada e classifica por equipe");
            Check(rankingRows.GetArrayLength()==2 && rankingRows[1].GetProperty("score").ValueKind==JsonValueKind.Null &&
                rankingRows[1].GetProperty("position").ValueKind==JsonValueKind.Null,"Atendente sem avaliações aparece sem posição");
            var personal = await GetRanking(collaborator);
            Check(personal.GetArrayLength()==2 && personal[0].GetProperty("name").GetString()=="QA Colaborador" &&
                personal[0].GetProperty("position").GetInt64()==1,"Colaborador visualiza tabela completa de ranking com posição");
            Check((await adminClient.GetAsync("/api/data/rankings?period=invalido")).StatusCode==HttpStatusCode.BadRequest,"Ranking rejeita período inválido");
            var report = new {title="QA relatório",type="Qualidade",teamId=team,period="Últimos 7 dias",summary="Observação QA",includeRanking=true};
            Check((await Write(collaborator,HttpMethod.Post,"/api/data/reports",report)).StatusCode==HttpStatusCode.Forbidden,"Relatórios restritos");
            Check((await Write(adminClient,HttpMethod.Post,"/api/data/reports",report)).StatusCode==HttpStatusCode.Created,"Relatório persistido");
            var generated = (await Snapshot(adminClient)).GetProperty("reports").EnumerateArray().Single(r=>r.GetProperty("teamId").ValueKind==JsonValueKind.String && r.GetProperty("teamId").GetGuid()==team);
            Check(generated.GetProperty("total").GetInt64()==1 && generated.GetProperty("reviewed").GetInt64()==1,"Relatório usa banco real");
            Check(generated.GetProperty("averageScore").GetDouble()==0,"Média real inclui zero");
            var savedRows = generated.GetProperty("ranking");
            Check(savedRows.GetArrayLength()==2 && savedRows[0].GetProperty("score").GetDecimal()==0 &&
                savedRows[0].GetProperty("position").GetInt64()==1 && savedRows[0].GetProperty("evaluated").GetInt64()==1,
                "Relatório preserva recorte e classificação do ranking");
            var reportId = generated.GetProperty("id").GetGuid();
            Check((await Snapshot(collaborator)).GetProperty("reports").EnumerateArray().Any(r=>r.GetProperty("id").GetGuid()==reportId),"Colaborador visualiza novo relatório cadastrado pelo administrador");
            var deletePath = $"/api/data/reports/{reportId}";
            using (var anonymous = factory.CreateClient())
                Check((await Write(anonymous,HttpMethod.Delete,deletePath,new {})).StatusCode==HttpStatusCode.Unauthorized,"Excluir relatório exige sessão");
            Check((await Write(collaborator,HttpMethod.Delete,deletePath,new {})).StatusCode==HttpStatusCode.Forbidden,"Colaborador não exclui relatório");
            Check((await adminClient.DeleteAsync(deletePath)).StatusCode==HttpStatusCode.Forbidden,"Excluir relatório exige CSRF");
            Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/reports/{Guid.Empty}",new {})).StatusCode==HttpStatusCode.BadRequest,"Excluir relatório rejeita UUID vazio");
            Check((await Write(adminClient,HttpMethod.Delete,deletePath,new {})).StatusCode==HttpStatusCode.NoContent,"Administrador exclui relatório");
            Check(!(await Snapshot(adminClient)).GetProperty("reports").EnumerateArray().Any(r=>r.GetProperty("id").GetGuid()==reportId),"Exclusão persiste na releitura");
            Check(FindCall(await Snapshot(adminClient)).GetProperty("reviewed").GetBoolean(),"Excluir relatório preserva ligação e revisão");
            Check((await Write(adminClient,HttpMethod.Delete,deletePath,new {})).StatusCode==HttpStatusCode.NotFound,"Excluir relatório já removido retorna 404");
            var audioRequest = new HttpRequestMessage(HttpMethod.Get,$"/api/data/calls/{call}/audio");
            audioRequest.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0,15);
            using var audioResponse = await collaborator.SendAsync(audioRequest);
            Check(audioResponse.StatusCode==HttpStatusCode.PartialContent,"Áudio protegido suporta seek");
            Check((await audioResponse.Content.ReadAsByteArrayAsync()).Length==16,"Range de áudio real");
            Check(DeliveryRepository.ResolveAudio(audio,"../outside.wav") is null,"Rejeita saída da pasta de áudio");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/users/{admin}/active",new {active=false})).StatusCode==HttpStatusCode.Conflict,"Proteção da própria conta");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/users/{user}/active",new {active=false})).IsSuccessStatusCode,"Desativação persistida");
            Check((await collaborator.GetAsync("/api/auth/session")).StatusCode==HttpStatusCode.Unauthorized,"Sessão desativada recusada");
            Check((await Write(collaborator,HttpMethod.Post,"/api/auth/login",new {email=userEmail,password})).StatusCode==HttpStatusCode.Unauthorized,"Login inativo recusado");
            Check((await Write(adminClient,HttpMethod.Put,$"/api/data/users/{user}/active",new {active=true})).IsSuccessStatusCode,"Reativação");
            Check((await collaborator.GetAsync("/api/auth/session")).StatusCode==HttpStatusCode.Unauthorized,"Reativação não revive sessão antiga");
            Check((await Write(collaborator,HttpMethod.Post,"/api/auth/login",new {email=userEmail,password})).IsSuccessStatusCode,"Novo login ativo");
            var nextPassword = password + "New";
            Check((await Write(collaborator,HttpMethod.Put,"/api/auth/profile",new {name="QA perfil atualizado",email=userEmail,currentPassword=password,newPassword=nextPassword})).IsSuccessStatusCode,"Perfil e senha persistidos");
            Check((await collaborator.GetAsync("/api/auth/session")).StatusCode==HttpStatusCode.Unauthorized,"Troca de senha encerra sessão");
            Check((await Write(collaborator,HttpMethod.Post,"/api/auth/login",new {email=userEmail,password=nextPassword})).IsSuccessStatusCode,"Login com nova senha");
            Check((await collaborator.GetFromJsonAsync<JsonElement>("/api/auth/session")).GetProperty("name").GetString()=="QA perfil atualizado","Releitura perfil");
            var recoveryPassword = nextPassword + "Reset";
            Check(await LocalAccountRecovery.Reset(factory.Services.GetRequiredService<DatabaseConnection>(),userEmail,recoveryPassword,default),"Recuperacao local usa hash compativel");
            Check((await collaborator.GetAsync("/api/auth/session")).StatusCode==HttpStatusCode.Unauthorized,"Recuperacao revoga sessao anterior");
            Check((await Write(collaborator,HttpMethod.Post,"/api/auth/login",new {email=userEmail,password=recoveryPassword})).IsSuccessStatusCode,"Login com senha recuperada");
            Check((await collaborator.GetFromJsonAsync<JsonElement>("/api/auth/session")).GetProperty("profile").GetString()=="Colaborador","Recuperacao preserva perfil e conta ativa");
            Check(!await LocalAccountRecovery.Reset(factory.Services.GetRequiredService<DatabaseConnection>(),"ausente-"+marker+"@example.invalid",recoveryPassword,default),"Recuperacao nao cria conta ausente");
            var previousJwt = Environment.GetEnvironmentVariable("Jwt__Key");
            Environment.SetEnvironmentVariable("Jwt__Key",Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"));
            try {
                using var production = new DeliveryFactory(api,secret,audio,"Production");
                using var productionClient = production.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
                Check((await Write(productionClient,HttpMethod.Post,"/api/auth/login",new {email=adminEmail,password})).IsSuccessStatusCode,"Login em configuração Production");
                Check((await productionClient.GetAsync("/api/data/snapshot")).IsSuccessStatusCode,"Interface integrada também em Production");
            } finally { Environment.SetEnvironmentVariable("Jwt__Key",previousJwt); }
            var browserTest = Environment.GetEnvironmentVariable("SENX_BROWSER_TEST");
            if (!string.IsNullOrWhiteSpace(browserTest)) {
                var start = new System.Diagnostics.ProcessStartInfo("node",browserTest) { UseShellExecute=false };
                start.Environment["SENX_QA_EMAIL"] = adminEmail; start.Environment["SENX_QA_PASSWORD"] = password;
                start.Environment["SENX_QA_CALL"] = call.ToString(); start.Environment["SENX_QA_TEAM"] = team.ToString();
                using var browser = System.Diagnostics.Process.Start(start)!;
                await browser.WaitForExitAsync();
                Check(browser.ExitCode==0,"Fluxos no navegador");
            }
            if (deletionChecks)
            {
                Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/users/{admin}",new {})).StatusCode==HttpStatusCode.Conflict,"Não exclui a própria conta");
                Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/users/{extraUser}",new {})).StatusCode==HttpStatusCode.Conflict,"Não exclui conta ativa");
                Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/customers/{customer}",new {})).StatusCode==HttpStatusCode.Conflict,"Não exclui cliente ativo");
                await Sql("""
                    UPDATE public."DadosCliente" SET "Situacao"='Inativo' WHERE "IdDadosCliente"=@customer;
                    INSERT INTO public."Resultado" ("IdCriterio","IdAnalise","IdFuncionario","Classificacao","Score","Justificativa","TrechoEvidencia","ResultadoValidado","StatusValidacao","ObservacaoValidacao")
                    VALUES (@criterion,@analysis,@user,'QA',80,'QA','','QA','Pendente','QA');
                    INSERT INTO public."Ligacao" ("IdLigacao","IdFuncionario","IdCliente","Duracao","Numero_Origem","Numero_Destino","Stats","Hash_Audio","Caminho_Arquivo","IdentificadorPABX","Direcao")
                    VALUES (@sharedCall,@user,@customer,'00:02:00','11999999998','11888888888','Concluída','qa','./sample.wav','QA compartilhado','Entrada');
                    INSERT INTO public."Equipe" ("IdEquipe","Nome","Departamento") VALUES (@emptyTeam,'QA equipe vazia','QA');
                    """);
                foreach (var (resource, id) in new[] { ("customers",customer), ("teams",team), ("criteria",criterion) })
                    Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/{resource}/{id}",new {})).StatusCode==HttpStatusCode.Conflict,"Preserva vínculos em " + resource);
                var callDelete = $"/api/data/calls/{call}";
                Check((await Write(collaborator,HttpMethod.Delete,callDelete,new {})).StatusCode==HttpStatusCode.Forbidden,"Colaborador não exclui ligação");
                Check((await adminClient.DeleteAsync(callDelete)).StatusCode==HttpStatusCode.Forbidden,"Excluir ligação exige CSRF");
                Check((await Write(adminClient,HttpMethod.Delete,callDelete,new {})).StatusCode==HttpStatusCode.NoContent,"Exclui ligação, análise, resultado e revisão");
                Check(File.Exists(Path.Combine(audio,"sample.wav")),"Mantém arquivo compartilhado por caminho equivalente");
                Check((await Write(adminClient,HttpMethod.Delete,callDelete,new {})).StatusCode==HttpStatusCode.NotFound,"Ligação removida retorna 404");
                Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/calls/{sharedCall}",new {})).StatusCode==HttpStatusCode.NoContent,"Exclui última ligação vinculada ao arquivo");
                Check(!File.Exists(Path.Combine(audio,"sample.wav")),"Remove arquivo após exclusão da última ligação");
                foreach (var (resource, id) in new[] { ("customers",customer), ("teams",emptyTeam), ("criteria",criterion) })
                    Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/{resource}/{id}",new {})).StatusCode==HttpStatusCode.NoContent,"Exclusão persistida em " + resource);
                Check((await Write(adminClient,HttpMethod.Put,$"/api/data/users/{extraUser}/active",new {active=false})).IsSuccessStatusCode,"Desativa conta sem vínculos");
                Check((await Write(adminClient,HttpMethod.Delete,$"/api/data/users/{extraUser}",new {})).StatusCode==HttpStatusCode.NoContent,"Exclui conta inativa sem vínculos");
            }
            Console.WriteLine($"Integração PostgreSQL/cookie/CSRF: {passed} verificações aprovadas.");
            return 0;
        }
        catch (Exception error) { Console.WriteLine("FAIL integração: " + error.GetType().Name + " " + (error is PostgresException pg ? pg.SqlState : error.Message)); return 1; }
        finally
        {
            await Sql("""
                DELETE FROM public."Relatorio" WHERE "IdAutor"=@admin;
                DELETE FROM public."RevisaoHumana" WHERE "IdAnalise"=@analysis;
                DELETE FROM public."Resultado" WHERE "IdAnalise"=@analysis;
                DELETE FROM public."Analise" WHERE "IdAnalise"=@analysis;
                DELETE FROM public."Ligacao" WHERE "IdLigacao" IN (@call,@sharedCall);
                DELETE FROM public."DadosCliente" WHERE "IdDadosCliente"=@customer;
                DELETE FROM public."Criterio" WHERE "IdCriterio"=@criterion;
                DELETE FROM public."Usuario" WHERE "IdUsuario" IN (@admin,@user,@extraUser);
                DELETE FROM public."Equipe" WHERE "IdEquipe" IN (@team,@emptyTeam);
                """);
            Directory.Delete(audio,true); // Pasta temporária exclusiva criada nesta execução.
            Console.WriteLine("Registros temporários da integração removidos pelos IDs da execução.");
        }
    }

    private sealed class DeliveryFactory(string api,string connection,string audio,string environment = "Development") : WebApplicationFactory<SenxCti.Api.Controllers.UsuarioController>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment(environment).UseContentRoot(api)
            .ConfigureAppConfiguration((_,config)=>config.AddInMemoryCollection(new Dictionary<string,string?> {
                ["SENX_DB_CONNECTION"]=connection,["SENX_AUDIO_ROOT"]=audio,["Jwt:Key"]=new string('q',40)
            }));
    }
}
