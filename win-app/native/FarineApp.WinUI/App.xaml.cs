using Microsoft.UI.Xaml;

namespace FarineApp.WinUI;

public partial class App : Application
{
    private Window? _window;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var cmd = Environment.GetCommandLineArgs();
        var settings = cmd.Length > 1 && string.Equals(cmd[1], "settings", StringComparison.OrdinalIgnoreCase);
        _window = settings ? new SettingsWindow() : new MainWindow();
        _window.Activate();
    }
}
