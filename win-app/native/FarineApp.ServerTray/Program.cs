using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Net.Http.Json;
using System.Text.Json;
using System.Windows.Forms;

namespace FarineApp.ServerTray;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new TrayAppContext());
    }
}

internal sealed class TrayAppContext : ApplicationContext
{
    private readonly NotifyIcon _notifyIcon;
    private readonly System.Windows.Forms.Timer _timer;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(1.5) };
    private readonly string _repoRoot;
    private readonly Icon _appIcon = LoadAppIcon();
    private ToolStripMenuItem? _serverToggleItem;
    private Process? _rpiProcess;
    private Process? _winServerProcess;
    private bool _rpiUp;
    private bool _winServerUp;

    public TrayAppContext()
    {
        _repoRoot = FindRepoRoot();
        _notifyIcon = new NotifyIcon
        {
            Icon = _appIcon,
            Text = "FarineAPP - démarrage...",
            Visible = true,
            ContextMenuStrip = BuildMenu()
        };

        // Sécurité: si le tray se ferme (normalement ou non), on coupe les serveurs.
        AppDomain.CurrentDomain.ProcessExit += (_, _) => StopServers();
        Application.ApplicationExit += (_, _) => StopServers();

        _timer = new System.Windows.Forms.Timer { Interval = 2500 };
        _timer.Tick += async (_, _) => await RefreshStatusAsync();
        _timer.Start();

        StartServers();
        UpdateToggleLabel();
        _ = RefreshStatusAsync();
    }

    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Ouvrir app native", null, (_, _) => OpenNativeApp());
        menu.Items.Add("Ouvrir admin web", null, (_, _) => OpenUrl("http://127.0.0.1:8080/"));
        menu.Items.Add("Paramètres", null, (_, _) => OpenSettings());
        menu.Items.Add(new ToolStripSeparator());
        _serverToggleItem = new ToolStripMenuItem("Arrêter les serveurs", null, (_, _) => ToggleServers());
        menu.Items.Add(_serverToggleItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Statut", null, async (_, _) => await ShowStatusAsync());
        menu.Items.Add("Quitter", null, (_, _) => Exit());
        return menu;
    }

    private bool ServersRunning() =>
        _rpiProcess is { HasExited: false } || _winServerProcess is { HasExited: false };

    private void ToggleServers()
    {
        if (ServersRunning())
        {
            StopServers();
        }
        else
        {
            StartServers();
        }
        UpdateToggleLabel();
        _ = RefreshStatusAsync();
    }

    private void UpdateToggleLabel()
    {
        if (_serverToggleItem is null) return;
        _serverToggleItem.Text = ServersRunning() ? "Arrêter les serveurs" : "Démarrer les serveurs";
    }

    private static string FindRepoRoot()
    {
        var dir = AppContext.BaseDirectory;
        while (!string.IsNullOrWhiteSpace(dir))
        {
            if (Directory.Exists(Path.Combine(dir, "rpi-serial-server")) &&
                Directory.Exists(Path.Combine(dir, "win-app")))
            {
                return dir;
            }

            var parent = Directory.GetParent(dir);
            if (parent is null) break;
            dir = parent.FullName;
        }

        var current = Directory.GetCurrentDirectory();
        if (Directory.Exists(Path.Combine(current, "rpi-serial-server")))
        {
            return current;
        }

        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
    }

    private void StartServers()
    {
        Directory.CreateDirectory(Path.Combine(_repoRoot, "logs", "native"));
        StartRpi();
        StartWinServer();
    }

    private void StartRpi()
    {
        if (_rpiProcess is { HasExited: false }) return;
        _rpiProcess = StartPython(
            Path.Combine(_repoRoot, "rpi-serial-server"),
            Path.Combine(_repoRoot, "rpi-serial-server", "server.py"),
            "rpi");
    }

    private void StartWinServer()
    {
        if (_winServerProcess is { HasExited: false }) return;
        _winServerProcess = StartPython(
            Path.Combine(_repoRoot, "win-app", "server"),
            Path.Combine(_repoRoot, "win-app", "server", "server.py"),
            "win-server");
    }

    private Process StartPython(string workingDirectory, string scriptPath, string logName)
    {
        var logPath = Path.Combine(_repoRoot, "logs", "native", $"{logName}.log");
        var psi = new ProcessStartInfo
        {
            FileName = "python",
            Arguments = $"\"{scriptPath}\"",
            WorkingDirectory = workingDirectory,
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, e) => AppendLog(logPath, e.Data);
        process.ErrorDataReceived += (_, e) => AppendLog(logPath, e.Data);
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    private static void AppendLog(string path, string? line)
    {
        if (string.IsNullOrWhiteSpace(line)) return;
        File.AppendAllText(path, $"[{DateTime.Now:O}] {line}{Environment.NewLine}");
    }

    private async Task RefreshStatusAsync()
    {
        _rpiUp = await IsUpAsync("http://127.0.0.1:7001/api/health");
        _winServerUp = await IsUpAsync("http://127.0.0.1:8080/api/health");
        var label = _rpiUp && _winServerUp
            ? "FarineAPP - serveurs OK"
            : $"FarineAPP - RPi:{State(_rpiUp)} Win:{State(_winServerUp)}";
        _notifyIcon.Text = label.Length > 63 ? label[..63] : label;
        UpdateToggleLabel();
    }

    private static Icon LoadAppIcon()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "appicon.ico");
            if (File.Exists(path)) return new Icon(path);
        }
        catch
        {
            // Fall back to a generated glyph below.
        }
        return CreateEmojiIcon("\U0001F33E");
    }

    private static Icon CreateEmojiIcon(string emoji, int size = 32)
    {
        using var bitmap = new Bitmap(size, size);
        using (var g = Graphics.FromImage(bitmap))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);
            using var font = new Font("Segoe UI Emoji", size * 0.66f, FontStyle.Regular, GraphicsUnit.Pixel);
            using var brush = new SolidBrush(Color.FromArgb(0xFC, 0xD3, 0x4D));
            using var format = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            };
            g.DrawString(emoji, font, brush, new RectangleF(0, 0, size, size), format);
        }

        var handle = bitmap.GetHicon();
        try
        {
            using var temp = Icon.FromHandle(handle);
            return (Icon)temp.Clone();
        }
        finally
        {
            DestroyIcon(handle);
        }
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool DestroyIcon(IntPtr handle);

    private async Task<bool> IsUpAsync(string url)
    {
        try
        {
            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return false;
            var payload = await response.Content.ReadFromJsonAsync<HealthPayload>();
            return payload?.Ok == true;
        }
        catch
        {
            return false;
        }
    }

    private static string State(bool up) => up ? "OK" : "KO";

    private void OpenNativeApp() => LaunchNative(null);

    private void OpenSettings() => LaunchNative("settings");

    private void LaunchNative(string? arguments)
    {
        var candidates = new[]
        {
            Path.Combine(_repoRoot, "win-app", "native", "FarineApp.WinUI", "bin", "x64", "Debug", "net8.0-windows10.0.19041.0", "FarineApp.WinUI.exe"),
            Path.Combine(_repoRoot, "win-app", "native", "FarineApp.WinUI", "bin", "x64", "Release", "net8.0-windows10.0.19041.0", "FarineApp.WinUI.exe")
        };

        var exe = candidates.FirstOrDefault(File.Exists);
        if (exe is null)
        {
            MessageBox.Show(
                "App native introuvable. Lance d'abord .\\win-app\\scripts\\dev\\build-native.ps1",
                "FarineAPP",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        var psi = new ProcessStartInfo(exe) { UseShellExecute = true };
        if (!string.IsNullOrEmpty(arguments)) psi.Arguments = arguments;
        Process.Start(psi);
    }

    private static void OpenUrl(string url)
    {
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private async Task ShowStatusAsync()
    {
        await RefreshStatusAsync();
        MessageBox.Show(
            $"RPi serial server : {State(_rpiUp)}\nWindows server : {State(_winServerUp)}",
            "FarineAPP statut",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }

    private void StopServers()
    {
        StopProcess(_winServerProcess);
        StopProcess(_rpiProcess);
        _winServerProcess = null;
        _rpiProcess = null;
    }

    private static void StopProcess(Process? process)
    {
        try
        {
            if (process is { HasExited: false })
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // Best effort for tray shutdown.
        }
    }

    private void Exit()
    {
        _timer.Stop();
        StopServers();
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        Application.Exit();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _timer.Dispose();
            _http.Dispose();
            _notifyIcon.Dispose();
            _appIcon.Dispose();
        }
        base.Dispose(disposing);
    }

    private sealed class HealthPayload
    {
        public bool Ok { get; set; }
    }
}
