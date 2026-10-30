# Teste — Transcrição com múltiplas IAs

App mínimo (ASP.NET Core + uma página HTML) para testar:

- **Arquivo de áudio** → `gemini-3.5-transcribe` (modo smart/verbatim, diarização, timestamps por palavra, vocabulário customizado)
- **Ao vivo (microfone)** → `gemini-3.5-transcribe-live` (parciais em cinza, finais em preto)

## Selecionar IA e fallback automático

Use **Trocar IA** na tela para escolher Automática ou um dos sete modelos disponíveis.
A escolha vale para a próxima transcrição; durante uma operação os controles ficam bloqueados.
A tela distingue a IA preferida da IA que realmente respondeu.

No automático, a ordem é **Gemini → Deepgram Nova-3 → Groq Whisper Turbo → NVIDIA Parakeet → NVIDIA Whisper → Deepgram Nova-2 → Groq Whisper Large V3**. Ao selecionar outra IA,
ela é tentada primeiro, seguida das demais. Chaves não preenchidas são ignoradas.
Limite de uso (HTTP 429), falhas HTTP/rede e timeout acionam a próxima IA.
Se todas falharem, a tela informa os motivos e mantém o áudio salvo.

Ao receber HTTP 429, falta de créditos/cota ou gRPC `ResourceExhausted`, o aplicativo muda
automaticamente de IA e pausa temporariamente a empresa/chave afetada. As variantes que usam a mesma
chave também são puladas durante essa pausa; outra chave não é bloqueada. A pausa é compartilhada entre
requisições e sessões do servidor e usa `Retry-After` (ou `RetryInfo` do Gemini), quando disponível;
caso contrário, usa `Fallback:QuotaCooldownSeconds` (padrão: 60 segundos). O servidor não espera esse
prazo para chamar outra IA. Ao expirar, a IA pode ser tentada novamente. Reiniciar limpa esse estado.
No microfone, a troca preserva o áudio acumulado. Respostas marcadas como incompletas também acionam
fallback, em vez de serem exibidas como uma transcrição concluída.

Os campos `_LIMITES_*`, imediatamente acima de cada modelo em `appsettings.json`, são comentários
informativos em JSON válido: contêm limites públicos, unidades, plano de referência, fontes e data.
Não são contadores locais nem uma consulta ao saldo atual da conta. Os limites reais podem variar;
quando não são publicados, isso é declarado em vez de atribuir um número arbitrário.

Copie `appsettings.example.json` para `appsettings.json` e preencha suas chaves. O arquivo local `appsettings.json` fica fora do Git pelo `.gitignore`; publique apenas o exemplo sem chaves.

Cole as chaves diretamente em `appsettings.json`:

| Campo | Onde obter |
|---|---|
| `Gemini:ApiKey` | https://aistudio.google.com/apikey |
| `Fallback:Deepgram:ApiKey` | https://console.deepgram.com/ |
| `Fallback:Groq:ApiKey` | https://console.groq.com/keys |
| `Fallback:Nvidia:ApiKey` | https://build.nvidia.com/ |

Configure a chave NVIDIA em `Fallback:Nvidia:ApiKey`.
Nova-2 reutiliza a chave Deepgram e Whisper Large V3 reutiliza a chave Groq:
deixe `Fallback:DeepgramNova2:ApiKey` e `Fallback:GroqWhisper:ApiKey` vazios para isso.
Esses campos também aceitam chaves próprias. Chaves não são devolvidas pela API de configuração da tela.
Reinicie o aplicativo depois de editar a configuração.

Modelos diferentes da mesma empresa podem compartilhar quota e disponibilidade. As variantes adicionais
não garantem contornar uma quota da conta; o fallback tenta outras empresas antes das variantes secundárias.

## Modelos adicionais e NVIDIA

| Opção | Modelo / infraestrutura | Chave reutilizada |
|---|---|---|
| Deepgram Nova-2 | `nova-2` | Deepgram |
| Groq Whisper Large V3 | `whisper-large-v3` na Groq | Groq |
| NVIDIA Parakeet multilíngue | `parakeet-1.1b-rnnt-multilingual-asr` | NVIDIA Build |
| NVIDIA Whisper Large V3 | `whisper-large-v3` na NVIDIA | NVIDIA Build |

A integração NVIDIA usa gRPC oficial em `grpc.nvcf.nvidia.com:443`; não precisa de GPU local,
Python ou FFmpeg. A conversão local usa NAudio: MP3/WAV e formatos AAC/M4A/WMA/MP4 que os codecs
do Windows conseguirem decodificar são convertidos para PCM mono de 16 kHz. O arquivo original permanece intacto.
Outros formatos continuam disponíveis nas demais IAs; se a conversão NVIDIA não for compatível, outra IA é tentada.
Os limites locais NVIDIA são 100 MiB de arquivo e 60 minutos de áudio decodificado, ajustáveis em
`Fallback:Nvidia:MaxFileSizeMb` e `MaxAudioMinutes`.

Parakeet usa o método gRPC streaming para processar cada snapshot, com leitura/escrita simultâneas e
timestamps por palavra quando solicitados. A interface continua atualizando por intervalos.
Whisper NVIDIA recebe blocos sequenciais de 30 segundos; uma palavra na fronteira de um bloco pode
ser prejudicada. O timeout configurado se aplica à tentativa completa, incluindo conversão e todos os blocos.
Whisper NVIDIA é ignorado se timestamps por palavra forem exigidos. Ambas as opções NVIDIA são ignoradas
quando diarização é exigida, preservando os recursos solicitados em vez de descartá-los.
No Whisper NVIDIA as dicas de vocabulário não são enviadas; o comportamento smart/verbatim pode variar por modelo.

Contratos Protobuf oficiais em `Protos/riva/proto`, com licença em `Protos/LICENSE-NVIDIA.txt`, obtidos de
[nvidia-riva/common](https://github.com/nvidia-riva/common/tree/main/riva/proto).
Endpoints: [Whisper NVIDIA](https://build.nvidia.com/openai/whisper-large-v3/api),
[Parakeet NVIDIA](https://build.nvidia.com/nvidia/parakeet-1_1b-rnnt-multilingual-asr/api).
Outros modelos: [Whisper Groq](https://console.groq.com/docs/speech-to-text),
[Nova-2 Deepgram](https://developers.deepgram.com/docs/model).

| Configuração em `Fallback` | Padrão | Significado |
|---|---|---|
| `PrimaryTimeoutSeconds` | 45 | Prazo total da primeira tentativa de arquivo, incluindo upload |
| `BackupTimeoutSeconds` | 30 | Prazo por tentativa de reserva |
| `LiveConnectTimeoutSeconds` | 10 | Prazo de conexão/configuração Gemini Live |
| `LiveResponseTimeoutSeconds` | 15 | Prazo sem resposta após detectar áudio com energia de fala |
| `LiveRefreshSeconds` | 8 | Intervalo de salvamento/atualização do microfone |

Os tempos de arquivo aceitam até 3600 segundos; conexão ao vivo até 120;
resposta/atualização ao vivo até 600. Todos precisam ser positivos, com atualização de no mínimo 1 segundo.
Arquivos longos podem precisar de tempos maiores. O detector local de energia é simples:
ruído pode ser interpretado como fala e fala muito baixa pode não disparar o timeout.

Gemini mantém streaming. As demais opções recebem snapshots WAV completos da sessão a cada intervalo,
com apenas uma chamada em andamento. A resposta substitui o texto anterior, sem concatenar duplicatas.
Isso recupera o início da gravação quando há troca de IA, mas reprocessa áudio e pode aumentar
o consumo da API. Ao parar, é enviado o último snapshot. Sessões são encerradas em dez minutos.
Depois da troca ao vivo, a sessão usa as reservas; a próxima sessão pode tentar Gemini novamente.

Groq é ignorado quando diarização é solicitada. Seu limite local padrão é 25 MiB por arquivo;
arquivos maiores são ignorados por essa reserva (não há divisão automática). Deepgram tem limite local
configurado de 300 MiB. Smart/verbatim, vocabulário e dicas de idioma não têm semântica idêntica entre IAs.
Referências: [Deepgram](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded)
e [Groq](https://console.groq.com/docs/speech-to-text).

## Gravações locais

O aplicativo aceita arquivos de até **2 GB (2048 MB, base 1024)**. Configure
`Uploads:MaxFileSizeMb` em `appsettings.json` com um valor entre **500 e 2048**.
Esse intervalo define o teto configurável: arquivos menores que 500 MB continuam aceitos.
Reinicie o aplicativo após mudar o limite. A interface mostra o teto e recusa arquivos maiores antes do envio;
o servidor também aplica a validação, com margem separada para o envelope multipart.

Arquivos grandes são temporariamente armazenados em disco pelo ASP.NET e salvos na pasta da gravação.
O upload Gemini usa streaming, sem duplicar o arquivo inteiro em memória. Reserve espaço em disco para
o arquivo temporário e a cópia salva. O aumento do upload local não altera os limites externos de tamanho,
duração e quota das IAs. As reservas incompatíveis são ignoradas; o áudio permanece salvo se nenhuma IA
conseguir transcrevê-lo. Para arquivos grandes, ajuste os timeouts conforme a velocidade de upload.

Cada arquivo enviado ou sessão de microfone cria uma pasta exclusiva em:

```text
Gravacoes/AAAAmmdd-HHmmss-identificador/
  audio.mp3      (upload: preserva bytes e extensão original)
  gravacao.json  (nome original, tamanho e data)
```

No microfone, o arquivo é `audio.wav` (PCM mono, 16 bits, 16 kHz). A mesma pasta é atualizada
durante a sessão e ao clicar **Parar e salvar**. A tela mostra o caminho e um link para baixar.
O áudio é salvo antes da chamada à IA, inclusive quando nenhuma chave funciona.
Use **Parar e salvar** antes de fechar a aba; fechar abruptamente pode perder o trecho desde o último salvamento.
Se o servidor ficar indisponível ao parar, a tela oferece o download do WAV que permaneceu no navegador.

`Recordings:Directory` permite mudar a pasta. Caminhos relativos são resolvidos a partir da pasta
de conteúdo do aplicativo (a pasta do projeto ao executar `dotnet run`). As gravações ficam fora de `wwwroot`.

## Verificações sem consumir APIs

```bash
dotnet run --project Tests/TranscribeTest.Checks.csproj
node Tests/frontend-checks.cjs
```

As verificações usam respostas simuladas para quotas, timeout, seleção, cancelamento,
salvamento, WAV e troca ao vivo; não validam credenciais nem qualidade real de reconhecimento.

## Onde colocar a API key

Arquivo **`appsettings.json`**, campo `Gemini:ApiKey`:

```json
"ApiKey": "COLE_SUA_API_KEY_AQUI"
```

Gere a chave em https://aistudio.google.com/apikey

## Como rodar

```bash
cd TranscribeTest
dotnet run
```

Abra http://localhost:5080 (precisa ser `localhost` ou HTTPS para o navegador liberar o microfone).

Requer o SDK do .NET 10.

## Estrutura

| Arquivo | Função |
|---|---|
| `appsettings.json` | API key e IDs dos modelos |
| `Program.cs` | Endpoints: `POST /api/transcribe` e WebSocket `/ws/transcribe` |
| `GeminiTranscribeService.cs` | Upload (Files API) + Interactions API |
| `GeminiTranscribeLiveBridge.cs` | Ponte WebSocket navegador ↔ Gemini Live API |
| `wwwroot/index.html` | Interface de teste |

## Limites do modelo

- Arquivo: até 1h (30 min com diarização ou timestamps), diarização até 8 falantes
- Ao vivo: sessão de até 10 min, sem diarização e sem timestamps por palavra
- `custom_vocabulary` não combina com diarização/timestamps; `smart` também não
