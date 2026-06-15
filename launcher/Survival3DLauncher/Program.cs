using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Survival3DLauncher;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new LauncherForm());
    }
}

public sealed class LauncherForm : Form
{
    private const string LauncherVersion = "1.0.0";
    private readonly HttpClient http = new();
    private readonly JsonSerializerOptions jsonOptions = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };

    private readonly string rootDir = AppContext.BaseDirectory;
    private readonly string dataDir;
    private readonly string logsDir;
    private readonly string tempDir;
    private readonly string downloadsDir;
    private readonly string backupsDir;
    private readonly string configPath;
    private readonly string localVersionPath;
    private LauncherConfig config = LauncherConfig.Default;
    private LocalVersion localVersion = new();
    private Manifest? manifest;
    private ManifestBuild? onlineBuild;

    private readonly Label title = new();
    private readonly Label status = new();
    private readonly Label versionLabel = new();
    private readonly Label changelog = new();
    private readonly ProgressBar progress = new();
    private readonly Button checkButton = new();
    private readonly Button updateButton = new();
    private readonly Button playButton = new();

    public LauncherForm()
    {
        Text = "Sobrevivencia 3D Launcher";
        Width = 760;
        Height = 470;
        MinimumSize = new Size(720, 430);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(15, 15, 22);
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10);
        var executableIcon = Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? Application.ExecutablePath);
        if (executableIcon is not null)
        {
            Icon = executableIcon;
        }

        dataDir = Path.Combine(rootDir, "LauncherData");
        logsDir = Path.Combine(dataDir, "logs");
        tempDir = Path.Combine(dataDir, "temp");
        downloadsDir = Path.Combine(dataDir, "downloads");
        backupsDir = Path.Combine(dataDir, "backups");
        configPath = Path.Combine(dataDir, "launcher-config.json");
        localVersionPath = Path.Combine(dataDir, "version.json");

        BuildLayout();
        Shown += async (_, _) => await InitializeAsync();
    }

    private void BuildLayout()
    {
        var main = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 7,
            Padding = new Padding(22),
            BackColor = BackColor
        };
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 54));
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
        main.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        Controls.Add(main);

        title.Text = "SOBREVIVENCIA 3D";
        title.Font = new Font("Segoe UI", 24, FontStyle.Bold);
        title.ForeColor = Color.FromArgb(0, 240, 255);
        title.Dock = DockStyle.Fill;
        main.Controls.Add(title, 0, 0);

        versionLabel.Text = "Versao local: -- | Online: --";
        versionLabel.Dock = DockStyle.Fill;
        versionLabel.ForeColor = Color.FromArgb(210, 210, 220);
        main.Controls.Add(versionLabel, 0, 1);

        status.Text = "Inicializando launcher...";
        status.Dock = DockStyle.Fill;
        status.ForeColor = Color.FromArgb(255, 220, 120);
        main.Controls.Add(status, 0, 2);

        changelog.Text = "Changelog:";
        changelog.Dock = DockStyle.Fill;
        changelog.BackColor = Color.FromArgb(25, 25, 36);
        changelog.ForeColor = Color.FromArgb(230, 230, 240);
        changelog.Padding = new Padding(12);
        changelog.BorderStyle = BorderStyle.FixedSingle;
        main.Controls.Add(changelog, 0, 3);

        progress.Dock = DockStyle.Fill;
        progress.Minimum = 0;
        progress.Maximum = 1000;
        main.Controls.Add(progress, 0, 4);

        var buttons = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.RightToLeft,
            BackColor = BackColor,
            Padding = new Padding(0, 10, 0, 0)
        };
        main.Controls.Add(buttons, 0, 5);

        playButton.Text = "Jogar";
        playButton.Width = 150;
        playButton.Height = 38;
        playButton.Enabled = false;
        playButton.Click += async (_, _) => await PlayAsync();
        buttons.Controls.Add(playButton);

        updateButton.Text = "Atualizar";
        updateButton.Width = 150;
        updateButton.Height = 38;
        updateButton.Enabled = false;
        updateButton.Click += async (_, _) => await UpdateGameAsync();
        buttons.Controls.Add(updateButton);

        checkButton.Text = "Verificar";
        checkButton.Width = 150;
        checkButton.Height = 38;
        checkButton.Click += async (_, _) => await CheckForUpdatesAsync();
        buttons.Controls.Add(checkButton);

        var footer = new Label
        {
            Text = "Launcher 1.0.0 - AWS manifest pronto para S3/CloudFront",
            Dock = DockStyle.Fill,
            ForeColor = Color.FromArgb(125, 125, 135)
        };
        main.Controls.Add(footer, 0, 6);
    }

    private async Task InitializeAsync()
    {
        Directory.CreateDirectory(dataDir);
        Directory.CreateDirectory(logsDir);
        Directory.CreateDirectory(tempDir);
        Directory.CreateDirectory(downloadsDir);
        Directory.CreateDirectory(backupsDir);

        await EnsureConfigAsync();
        await LoadLocalVersionAsync();
        await CheckForUpdatesAsync();
    }

    private async Task EnsureConfigAsync()
    {
        if (!File.Exists(configPath))
        {
            var bundledPath = Path.Combine(rootDir, "launcher-config.json");
            if (File.Exists(bundledPath))
            {
                File.Copy(bundledPath, configPath, overwrite: true);
            }
            else
            {
                await File.WriteAllTextAsync(configPath, JsonSerializer.Serialize(LauncherConfig.Default, jsonOptions));
            }
        }

        var text = await File.ReadAllTextAsync(configPath);
        config = JsonSerializer.Deserialize<LauncherConfig>(text, jsonOptions) ?? LauncherConfig.Default;
        config.ManifestUrl = string.IsNullOrWhiteSpace(config.ManifestUrl) ? LauncherConfig.Default.ManifestUrl : config.ManifestUrl;
        config.Platform = string.IsNullOrWhiteSpace(config.Platform) ? "windows-x64" : config.Platform;
        config.GameExecutable = NormalizeRelativePath(string.IsNullOrWhiteSpace(config.GameExecutable) ? "Game/Survival3D.exe" : config.GameExecutable);
        config.LaunchTicketFileName = string.IsNullOrWhiteSpace(config.LaunchTicketFileName) ? "launch-ticket.json" : config.LaunchTicketFileName;
        config.LaunchTicketTtlSeconds = Math.Clamp(config.LaunchTicketTtlSeconds <= 0 ? 90 : config.LaunchTicketTtlSeconds, 30, 120);
    }

    private async Task LoadLocalVersionAsync()
    {
        if (!File.Exists(localVersionPath))
        {
            localVersion = new LocalVersion
            {
                InstalledVersion = "0.0.0",
                Executable = config.GameExecutable,
                InstalledAtUtc = null
            };
            await SaveLocalVersionAsync();
            return;
        }

        var text = await File.ReadAllTextAsync(localVersionPath);
        localVersion = JsonSerializer.Deserialize<LocalVersion>(text, jsonOptions) ?? new LocalVersion();
        localVersion.Executable = NormalizeRelativePath(string.IsNullOrWhiteSpace(localVersion.Executable) ? config.GameExecutable : localVersion.Executable);
    }

    private Task SaveLocalVersionAsync()
    {
        localVersion.Executable = NormalizeRelativePath(string.IsNullOrWhiteSpace(localVersion.Executable) ? config.GameExecutable : localVersion.Executable);
        return File.WriteAllTextAsync(localVersionPath, JsonSerializer.Serialize(localVersion, jsonOptions));
    }

    private async Task CheckForUpdatesAsync()
    {
        SetBusy(true);
        progress.Value = 0;
        try
        {
            status.Text = "Baixando manifest...";
            manifest = await DownloadManifestAsync(config.ManifestUrl);
            onlineBuild = manifest.GetBuild(config.Platform);
            if (onlineBuild == null)
            {
                throw new InvalidOperationException($"Manifest nao contem build para plataforma {config.Platform}.");
            }

            versionLabel.Text = $"Versao local: {localVersion.InstalledVersion} | Online: {onlineBuild.Version}";
            changelog.Text = BuildChangelogText(manifest, onlineBuild);

            if (IsLauncherTooOld(manifest.MinimumLauncherVersion))
            {
                status.Text = "Este launcher esta desatualizado. Baixe o launcher novo pelo site.";
                playButton.Enabled = false;
                updateButton.Enabled = false;
                return;
            }

            if (NeedsUpdate(localVersion.InstalledVersion, onlineBuild.Version))
            {
                status.Text = onlineBuild.Mandatory
                    ? "Atualizacao obrigatoria disponivel."
                    : "Atualizacao disponivel.";
                updateButton.Enabled = true;
                playButton.Enabled = !onlineBuild.Mandatory && GameExists();
            }
            else if (GameExists())
            {
                status.Text = "Jogo atualizado. Pronto para jogar.";
                playButton.Enabled = true;
                updateButton.Enabled = false;
            }
            else
            {
                status.Text = "Jogo nao instalado. Clique em Atualizar para baixar.";
                updateButton.Enabled = true;
                playButton.Enabled = false;
            }
        }
        catch (Exception ex)
        {
            await LogAsync("check-error", ex);
            status.Text = $"Erro ao verificar atualizacao: {ex.Message}";
            playButton.Enabled = GameExists();
            updateButton.Enabled = false;
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async Task<Manifest> DownloadManifestAsync(string url)
    {
        if (url.Contains("SEU_CLOUDFRONT_OU_S3_DOMAIN", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Configure LauncherData/launcher-config.json com a URL real do manifest na AWS.");
        }

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true };
        using var res = await http.SendAsync(req);
        res.EnsureSuccessStatusCode();
        await using var stream = await res.Content.ReadAsStreamAsync();
        var parsed = await JsonSerializer.DeserializeAsync<Manifest>(stream, jsonOptions);
        return parsed ?? throw new InvalidOperationException("Manifest vazio ou invalido.");
    }

    private async Task UpdateGameAsync()
    {
        if (manifest == null || onlineBuild == null)
        {
            await CheckForUpdatesAsync();
            if (onlineBuild == null) return;
        }

        SetBusy(true);
        updateButton.Enabled = false;
        playButton.Enabled = false;
        var downloadPath = Path.Combine(downloadsDir, onlineBuild.FileName);
        var extractDir = Path.Combine(tempDir, $"extract-{onlineBuild.Version}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
        var newGameDir = Path.Combine(extractDir, "Game");
        var gameDir = Path.Combine(rootDir, "Game");
        var backupDir = Path.Combine(backupsDir, $"Game-{localVersion.InstalledVersion}-{DateTime.Now:yyyyMMdd-HHmmss}");

        try
        {
            EnsureGameIsNotRunning();
            Directory.CreateDirectory(downloadsDir);
            Directory.CreateDirectory(extractDir);

            status.Text = "Baixando atualizacao...";
            await DownloadFileAsync(onlineBuild.Url, downloadPath, onlineBuild.Size);

            status.Text = "Validando SHA-256...";
            var actualHash = await ComputeSha256Async(downloadPath);
            if (!actualHash.Equals(onlineBuild.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"SHA-256 invalido. Esperado {onlineBuild.Sha256}, recebido {actualHash}.");
            }

            status.Text = "Extraindo pacote...";
            if (Directory.Exists(extractDir)) Directory.Delete(extractDir, recursive: true);
            Directory.CreateDirectory(extractDir);
            ZipFile.ExtractToDirectory(downloadPath, extractDir, overwriteFiles: true);
            if (!Directory.Exists(newGameDir))
            {
                throw new InvalidOperationException("ZIP precisa conter a pasta Game/ na raiz.");
            }

            status.Text = "Criando backup...";
            if (Directory.Exists(gameDir))
            {
                if (Directory.Exists(backupDir)) Directory.Delete(backupDir, recursive: true);
                Directory.Move(gameDir, backupDir);
            }

            try
            {
                status.Text = "Instalando nova versao...";
                Directory.Move(newGameDir, gameDir);
            }
            catch
            {
                if (Directory.Exists(gameDir)) Directory.Delete(gameDir, recursive: true);
                if (Directory.Exists(backupDir)) Directory.Move(backupDir, gameDir);
                throw;
            }

            localVersion = new LocalVersion
            {
                InstalledVersion = onlineBuild.Version,
                Executable = NormalizeRelativePath(onlineBuild.Executable),
                InstalledAtUtc = DateTimeOffset.UtcNow
            };
            await SaveLocalVersionAsync();

            progress.Value = progress.Maximum;
            status.Text = "Atualizacao concluida. Pronto para jogar.";
            playButton.Enabled = true;
            updateButton.Enabled = false;
            versionLabel.Text = $"Versao local: {localVersion.InstalledVersion} | Online: {onlineBuild.Version}";
        }
        catch (Exception ex)
        {
            await LogAsync("update-error", ex);
            status.Text = $"Falha na atualizacao: {ex.Message}";
            playButton.Enabled = GameExists();
            updateButton.Enabled = true;
        }
        finally
        {
            try
            {
                if (Directory.Exists(extractDir)) Directory.Delete(extractDir, recursive: true);
            }
            catch
            {
                // Best effort cleanup.
            }
            SetBusy(false);
        }
    }

    private async Task DownloadFileAsync(string url, string destination, long expectedSize)
    {
        using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        var total = expectedSize > 0 ? expectedSize : response.Content.Headers.ContentLength ?? 0;
        await using var input = await response.Content.ReadAsStreamAsync();
        await using var output = File.Create(destination);
        var buffer = new byte[1024 * 128];
        long readTotal = 0;
        int read;
        while ((read = await input.ReadAsync(buffer)) > 0)
        {
            await output.WriteAsync(buffer.AsMemory(0, read));
            readTotal += read;
            if (total > 0)
            {
                var ratio = Math.Clamp(readTotal / (double)total, 0, 1);
                progress.Value = (int)(ratio * progress.Maximum);
                status.Text = $"Baixando atualizacao... {ratio:P0}";
                Application.DoEvents();
            }
        }
    }

    private async Task PlayAsync()
    {
        try
        {
            if (onlineBuild != null && onlineBuild.Mandatory && NeedsUpdate(localVersion.InstalledVersion, onlineBuild.Version))
            {
                status.Text = "Atualizacao obrigatoria pendente.";
                return;
            }

            var exePath = Path.Combine(rootDir, NormalizeRelativePath(localVersion.Executable));
            if (!File.Exists(exePath))
            {
                status.Text = $"Executavel nao encontrado: {exePath}";
                return;
            }

            var ticketPath = await WriteLaunchTicketAsync(localVersion.InstalledVersion);
            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                WorkingDirectory = Path.GetDirectoryName(exePath) ?? rootDir,
                UseShellExecute = false
            };
            startInfo.Environment["SURVIVAL3D_LAUNCHER"] = "1";
            startInfo.Environment["SURVIVAL3D_LAUNCHER_VERSION"] = LauncherVersion;
            startInfo.Environment["SURVIVAL3D_GAME_VERSION"] = localVersion.InstalledVersion;
            startInfo.Environment["SURVIVAL3D_LAUNCH_TICKET"] = ticketPath;
            startInfo.ArgumentList.Add("--launcher-ticket");
            startInfo.ArgumentList.Add(ticketPath);

            Process.Start(startInfo);
            status.Text = "Jogo iniciado pelo launcher.";
            WindowState = FormWindowState.Minimized;
        }
        catch (Exception ex)
        {
            await LogAsync("play-error", ex);
            status.Text = $"Erro ao iniciar jogo: {ex.Message}";
        }
    }

    private async Task<string> WriteLaunchTicketAsync(string version)
    {
        Directory.CreateDirectory(tempDir);
        var ticketPath = Path.Combine(tempDir, config.LaunchTicketFileName);
        var ticket = new LaunchTicket
        {
            Version = version,
            LauncherVersion = LauncherVersion,
            IssuedAtUtc = DateTimeOffset.UtcNow,
            ExpiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(config.LaunchTicketTtlSeconds),
            Nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16))
        };
        await File.WriteAllTextAsync(ticketPath, JsonSerializer.Serialize(ticket, jsonOptions));
        return ticketPath;
    }

    private bool GameExists()
    {
        return File.Exists(Path.Combine(rootDir, NormalizeRelativePath(localVersion.Executable)));
    }

    private void EnsureGameIsNotRunning()
    {
        var exePath = Path.Combine(rootDir, NormalizeRelativePath(localVersion.Executable));
        var processName = Path.GetFileNameWithoutExtension(exePath);
        if (string.IsNullOrWhiteSpace(processName)) return;
        var running = Process.GetProcessesByName(processName);
        if (running.Length > 0)
        {
            throw new InvalidOperationException("Feche o jogo antes de atualizar.");
        }
    }

    private static async Task<string> ComputeSha256Async(string file)
    {
        await using var stream = File.OpenRead(file);
        var hash = await SHA256.HashDataAsync(stream);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static bool NeedsUpdate(string local, string online)
    {
        return CompareVersions(local, online) < 0;
    }

    private static bool IsLauncherTooOld(string? minimum)
    {
        if (string.IsNullOrWhiteSpace(minimum)) return false;
        return CompareVersions(LauncherVersion, minimum) < 0;
    }

    private static int CompareVersions(string? a, string? b)
    {
        if (!Version.TryParse(NormalizeVersion(a), out var va)) va = new Version(0, 0, 0);
        if (!Version.TryParse(NormalizeVersion(b), out var vb)) vb = new Version(0, 0, 0);
        return va.CompareTo(vb);
    }

    private static string NormalizeVersion(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "0.0.0";
        var parts = value.Split('.', StringSplitOptions.RemoveEmptyEntries).ToList();
        while (parts.Count < 3) parts.Add("0");
        return string.Join('.', parts.Take(4));
    }

    private static string NormalizeRelativePath(string value)
    {
        return value.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);
    }

    private static string BuildChangelogText(Manifest manifest, ManifestBuild build)
    {
        var lines = new List<string>
        {
            $"Ultima versao: {build.Version}",
            $"Publicado em: {build.PublishedAtUtc:yyyy-MM-dd HH:mm} UTC",
            "",
            "Changelog:"
        };
        if (build.Changelog.Count == 0) lines.Add("- Sem changelog informado.");
        lines.AddRange(build.Changelog.Select(item => "- " + item));
        lines.Add("");
        lines.Add($"Launcher minimo: {manifest.MinimumLauncherVersion}");
        lines.Add($"Arquivo: {build.FileName}");
        return string.Join(Environment.NewLine, lines);
    }

    private void SetBusy(bool busy)
    {
        checkButton.Enabled = !busy;
        Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
    }

    private async Task LogAsync(string prefix, Exception ex)
    {
        try
        {
            Directory.CreateDirectory(logsDir);
            var path = Path.Combine(logsDir, $"{DateTime.Now:yyyyMMdd}.log");
            await File.AppendAllTextAsync(path, $"[{DateTimeOffset.Now:O}] {prefix}: {ex}\n");
        }
        catch
        {
            // Logging cannot block launcher recovery.
        }
    }
}

public sealed class LauncherConfig
{
    public string ManifestUrl { get; set; } = "";
    public string Platform { get; set; } = "windows-x64";
    public string GameExecutable { get; set; } = "Game/Survival3D.exe";
    public string LauncherVersion { get; set; } = "1.0.0";
    public string LaunchTicketFileName { get; set; } = "launch-ticket.json";
    public int LaunchTicketTtlSeconds { get; set; } = 90;

    public static LauncherConfig Default => new()
    {
        ManifestUrl = "https://SEU_CLOUDFRONT_OU_S3_DOMAIN/manifest.json",
        Platform = "windows-x64",
        GameExecutable = "Game/Survival3D.exe",
        LauncherVersion = "1.0.0",
        LaunchTicketFileName = "launch-ticket.json",
        LaunchTicketTtlSeconds = 90
    };
}

public sealed class LocalVersion
{
    public string InstalledVersion { get; set; } = "0.0.0";
    public string Executable { get; set; } = "Game/Survival3D.exe";
    public DateTimeOffset? InstalledAtUtc { get; set; }
}

public sealed class Manifest
{
    public string LatestVersion { get; set; } = "0.0.0";
    public string MinimumLauncherVersion { get; set; } = "1.0.0";
    public Dictionary<string, ManifestBuild> Platforms { get; set; } = new();

    public ManifestBuild? GetBuild(string platform)
    {
        if (Platforms.TryGetValue(platform, out var build)) return build;
        return null;
    }
}

public sealed class ManifestBuild
{
    public string Version { get; set; } = "0.0.0";
    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public long Size { get; set; }
    public string Sha256 { get; set; } = "";
    public bool Mandatory { get; set; }
    public string Executable { get; set; } = "Game/Survival3D.exe";
    public List<string> Changelog { get; set; } = new();
    public DateTimeOffset PublishedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LaunchTicket
{
    public string Version { get; set; } = "";
    public string LauncherVersion { get; set; } = "";
    public DateTimeOffset IssuedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public string Nonce { get; set; } = "";
}
