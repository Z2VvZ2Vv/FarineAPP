using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace FarineApp.WinUI;

public sealed partial class SettingsWindow : Window
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(3) };
    private readonly string? _configPath;
    private JsonObject _config = new();

    private string _rpiUrl = "http://127.0.0.1:7001";
    private string _shellyUrl = "http://192.168.33.1";
    private bool _dev = true;

    private ToggleSwitch _devToggle = null!;
    private TextBox _rpiBox = null!;
    private TextBox _shellyBox = null!;
    private TextBlock _rpiStatus = null!;
    private TextBlock _shellyStatus = null!;
    private TextBlock _saveStatus = null!;

    public SettingsWindow()
    {
        InitializeComponent();
        Title = "FarineAPP - Paramètres";
        ConfigureWindow();
        _configPath = FindConfigPath();
        LoadConfig();
        BuildUi();
    }

    private void ConfigureWindow()
    {
        var appWindow = GetAppWindow();
        if (appWindow is null) return;
        try
        {
            var path = System.IO.Path.Combine(AppContext.BaseDirectory, "appicon.ico");
            if (System.IO.File.Exists(path)) appWindow.SetIcon(path);
        }
        catch { /* ignore */ }

        const int w = 780, h = 760;
        appWindow.Resize(new Windows.Graphics.SizeInt32(w, h));
        try
        {
            var area = Microsoft.UI.Windowing.DisplayArea.GetFromWindowId(appWindow.Id, Microsoft.UI.Windowing.DisplayAreaFallback.Primary);
            var x = area.WorkArea.X + (area.WorkArea.Width - w) / 2;
            var y = area.WorkArea.Y + (area.WorkArea.Height - h) / 2;
            appWindow.Move(new Windows.Graphics.PointInt32(x, y));
        }
        catch { /* ignore */ }
    }

    private Microsoft.UI.Windowing.AppWindow? GetAppWindow()
    {
        try
        {
            var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
            var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
            return Microsoft.UI.Windowing.AppWindow.GetFromWindowId(windowId);
        }
        catch
        {
            return null;
        }
    }

    // -------------------------------------------------------------- Config

    private static string? FindConfigPath()
    {
        var dir = AppContext.BaseDirectory;
        while (!string.IsNullOrEmpty(dir))
        {
            var candidate = System.IO.Path.Combine(dir, "win-app", "server", "config.json");
            if (System.IO.File.Exists(candidate)) return candidate;
            var parent = System.IO.Directory.GetParent(dir);
            if (parent is null) break;
            dir = parent.FullName;
        }
        return null;
    }

    private void LoadConfig()
    {
        if (_configPath is null) return;
        try
        {
            _config = JsonNode.Parse(System.IO.File.ReadAllText(_configPath)) as JsonObject ?? new JsonObject();
            _rpiUrl = _config["rpiSerialServerUrl"]?.GetValue<string>() ?? _rpiUrl;
            if (_config["shelly"] is JsonObject shelly)
            {
                _shellyUrl = shelly["baseUrl"]?.GetValue<string>() ?? _shellyUrl;
                _dev = shelly["simulation"]?.GetValue<bool>() ?? _dev;
            }
        }
        catch
        {
            // Keep defaults if the file is unreadable.
        }
    }

    private void Save()
    {
        if (_configPath is null)
        {
            SetStatus(_saveStatus, "config.json introuvable.", Red());
            return;
        }
        try
        {
            _config["rpiSerialServerUrl"] = NormalizeUrl(_rpiBox.Text);
            if (_config["shelly"] is not JsonObject shelly)
            {
                shelly = new JsonObject();
                _config["shelly"] = shelly;
            }
            shelly["baseUrl"] = NormalizeUrl(_shellyBox.Text);
            shelly["simulation"] = _devToggle.IsOn;

            System.IO.File.WriteAllText(_configPath, _config.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            SetStatus(_saveStatus, "✅ Enregistré. Redémarrez les serveurs depuis le tray pour appliquer.", Green());
        }
        catch (Exception ex)
        {
            SetStatus(_saveStatus, "❌ Échec de l'enregistrement : " + ex.Message, Red());
        }
    }

    private static string NormalizeUrl(string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length == 0) return text;
        if (!text.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !text.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            text = "http://" + text;
        }
        return text.TrimEnd('/');
    }

    // -------------------------------------------------------------- Tests

    private async Task TestRpiAsync()
    {
        var url = NormalizeUrl(_rpiBox.Text);
        SetStatus(_rpiStatus, "Test en cours…", Muted());
        try
        {
            using var resp = await _http.GetAsync($"{url}/api/health");
            if (resp.IsSuccessStatusCode)
            {
                SetStatus(_rpiStatus, $"✅ RPi joignable ({url})", Green());
            }
            else
            {
                SetStatus(_rpiStatus, $"❌ Réponse {(int)resp.StatusCode} depuis {url}", Red());
            }
        }
        catch (Exception ex)
        {
            SetStatus(_rpiStatus, "❌ Injoignable : " + ex.Message, Red());
        }
    }

    private async Task TestShellyAsync()
    {
        var url = NormalizeUrl(_shellyBox.Text);
        SetStatus(_shellyStatus, "Test en cours…", Muted());

        if (_devToggle.IsOn)
        {
            SetStatus(_shellyStatus, "ℹ️ Mode simulation actif : le Shelly réel n'est pas utilisé.", Muted());
            return;
        }

        foreach (var endpoint in new[] { "/rpc/Shelly.GetDeviceInfo", "/shelly", "/" })
        {
            try
            {
                using var resp = await _http.GetAsync($"{url}{endpoint}");
                if (resp.IsSuccessStatusCode)
                {
                    SetStatus(_shellyStatus, $"✅ Shelly joignable ({url})", Green());
                    return;
                }
            }
            catch
            {
                // Try the next endpoint.
            }
        }
        SetStatus(_shellyStatus, $"❌ Shelly injoignable ({url})", Red());
    }

    private static void SetStatus(TextBlock target, string text, Brush color)
    {
        target.Text = text;
        target.Foreground = color;
    }

    // -------------------------------------------------------------- UI

    private void BuildUi()
    {
        var scroll = new ScrollViewer { Padding = new Thickness(32, 28, 32, 28) };
        var panel = new StackPanel { Spacing = 18, MaxWidth = 700, HorizontalAlignment = HorizontalAlignment.Stretch };
        scroll.Content = panel;

        panel.Children.Add(new TextBlock { Text = "Paramètres", Foreground = White(), FontSize = 34, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        panel.Children.Add(new TextBlock
        {
            Text = "Configuration du serveur de contrôle (win-app/server/config.json).",
            Foreground = Soft(),
            FontSize = 15,
            Margin = new Thickness(0, 0, 0, 6)
        });

        // --- Mode développement
        var devCard = Card();
        var devRow = new Grid();
        devRow.ColumnDefinitions.Add(new ColumnDefinition());
        devRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var devText = new StackPanel { Spacing = 4, VerticalAlignment = VerticalAlignment.Center };
        devText.Children.Add(new TextBlock { Text = "Mode développement", Foreground = White(), FontSize = 19, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
        devText.Children.Add(new TextBlock { Text = "Simule les moteurs (Shelly) — aucun matériel requis.", Foreground = Muted(), FontSize = 14, TextWrapping = TextWrapping.Wrap });
        devRow.Children.Add(devText);
        _devToggle = new ToggleSwitch { IsOn = _dev, OnContent = "Activé", OffContent = "Désactivé", VerticalAlignment = VerticalAlignment.Center };
        Grid.SetColumn(_devToggle, 1);
        devRow.Children.Add(_devToggle);
        devCard.Children.Add(devRow);
        panel.Children.Add(devCard);

        // --- RPi
        _rpiStatus = StatusLine();
        _rpiBox = new TextBox { Text = _rpiUrl, PlaceholderText = "http://192.168.1.50:7001", HorizontalAlignment = HorizontalAlignment.Stretch };
        var rpiTest = new Button { Content = "Tester", MinWidth = 110, MinHeight = 40 };
        rpiTest.Click += async (_, _) => await TestRpiAsync();
        panel.Children.Add(FieldCard(
            "Adresse du RPi (balance)",
            "Serveur série Raspberry Pi qui lit le poids Flintec.",
            _rpiBox, rpiTest, _rpiStatus));

        // --- Shelly
        _shellyStatus = StatusLine();
        _shellyBox = new TextBox { Text = _shellyUrl, PlaceholderText = "http://192.168.33.1", HorizontalAlignment = HorizontalAlignment.Stretch };
        var shellyTest = new Button { Content = "Tester", MinWidth = 110, MinHeight = 40 };
        shellyTest.Click += async (_, _) => await TestShellyAsync();
        panel.Children.Add(FieldCard(
            "Adresse du Shelly (moteurs)",
            "Boîtier Shelly Pro 2 qui pilote les 2 moteurs.",
            _shellyBox, shellyTest, _shellyStatus));

        // --- Actions
        var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, Margin = new Thickness(0, 4, 0, 0) };
        var save = new Button { Content = "Enregistrer", MinWidth = 150, MinHeight = 44 };
        TryApplyAccentStyle(save);
        save.Click += (_, _) => Save();
        var close = new Button { Content = "Fermer", MinWidth = 110, MinHeight = 44 };
        close.Click += (_, _) => Close();
        actions.Children.Add(save);
        actions.Children.Add(close);
        panel.Children.Add(actions);

        _saveStatus = new TextBlock { Foreground = Muted(), FontSize = 14, TextWrapping = TextWrapping.Wrap };
        panel.Children.Add(_saveStatus);

        if (_configPath is null)
        {
            SetStatus(_saveStatus, "⚠️ config.json introuvable — les modifications ne pourront pas être enregistrées.", Red());
        }

        Root.Children.Clear();
        Root.Children.Add(scroll);
    }

    private StackPanel FieldCard(string title, string subtitle, TextBox box, Button test, TextBlock status)
    {
        var card = Card();
        card.Children.Add(new TextBlock { Text = title, Foreground = White(), FontSize = 19, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
        card.Children.Add(new TextBlock { Text = subtitle, Foreground = Muted(), FontSize = 14, Margin = new Thickness(0, 2, 0, 10), TextWrapping = TextWrapping.Wrap });

        var row = new Grid { ColumnSpacing = 12 };
        row.ColumnDefinitions.Add(new ColumnDefinition());
        row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        box.MinHeight = 40;
        row.Children.Add(box);
        Grid.SetColumn(test, 1);
        row.Children.Add(test);
        card.Children.Add(row);

        card.Children.Add(status);
        return card;
    }

    private StackPanel Card()
    {
        return new StackPanel
        {
            Spacing = 8,
            Padding = new Thickness(22),
            Background = Surface(),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10)
        };
    }

    private TextBlock StatusLine() => new()
    {
        Text = "Non testé.",
        Foreground = Muted(),
        FontSize = 14,
        Margin = new Thickness(0, 10, 0, 0),
        TextWrapping = TextWrapping.Wrap
    };

    private static void TryApplyAccentStyle(Button button)
    {
        try
        {
            if (Application.Current.Resources.TryGetValue("AccentButtonStyle", out var style) && style is Style s)
            {
                button.Style = s;
            }
        }
        catch
        {
            // Default style is fine.
        }
    }

    // -------------------------------------------------------------- Colors

    private static SolidColorBrush ColorBrush(byte a, byte r, byte g, byte b) => new(Windows.UI.Color.FromArgb(a, r, g, b));
    private static SolidColorBrush White() => ColorBrush(0xFF, 0xF9, 0xFA, 0xFB);
    private static SolidColorBrush Soft() => ColorBrush(0xFF, 0xD1, 0xD5, 0xDB);
    private static SolidColorBrush Muted() => ColorBrush(0xFF, 0xA7, 0xB0, 0xBF);
    private static SolidColorBrush Green() => ColorBrush(0xFF, 0x4A, 0xDE, 0x80);
    private static SolidColorBrush Red() => ColorBrush(0xFF, 0xF8, 0x71, 0x71);
    private static SolidColorBrush Surface() => ColorBrush(0xFF, 0x1F, 0x29, 0x37);
    private static SolidColorBrush Line() => ColorBrush(0x1A, 0xFF, 0xFF, 0xFF);
}
