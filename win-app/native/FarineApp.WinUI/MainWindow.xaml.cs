using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace FarineApp.WinUI;

public sealed partial class MainWindow : Window
{
    private readonly ApiClient _api = new("http://127.0.0.1:8080");
    private readonly DispatcherTimer _timer = new();
    private Func<Task>? _tick;
    private List<Recipe> _recipes = [];
    private Recipe? _selectedRecipe;
    private double _selectedWeight;
    private int _currentStepIndex;
    private bool _refreshing;

    private StackPanel? _focusCard;
    private StackPanel? _progressCard;
    private TextBlock? _connectionWarning;
    private StackPanel? _manualWeight;
    private StackPanel? _manualMotors;
    private StackPanel? _systemContent;

    public MainWindow()
    {
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;
        TrySetWindowIcon();
        GetAppWindow()?.SetPresenter(Microsoft.UI.Windowing.AppWindowPresenterKind.FullScreen);
        _timer.Interval = TimeSpan.FromSeconds(1);
        _timer.Tick += async (_, _) =>
        {
            if (_tick is not null) await _tick();
        };
        _ = LoadHomeAsync();
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

    private void TrySetWindowIcon()
    {
        try
        {
            var path = System.IO.Path.Combine(AppContext.BaseDirectory, "appicon.ico");
            if (!System.IO.File.Exists(path)) return;
            GetAppWindow()?.SetIcon(path);
        }
        catch
        {
            // Non-fatal: keep default icon.
        }
    }

    private void ToggleFullScreen()
    {
        var appWindow = GetAppWindow();
        if (appWindow is null) return;
        var full = appWindow.Presenter.Kind == Microsoft.UI.Windowing.AppWindowPresenterKind.FullScreen;
        appWindow.SetPresenter(full
            ? Microsoft.UI.Windowing.AppWindowPresenterKind.Overlapped
            : Microsoft.UI.Windowing.AppWindowPresenterKind.FullScreen);
    }

    private void StopTimer()
    {
        _timer.Stop();
        _tick = null;
    }

    private void StartTimer(Func<Task> tick)
    {
        _tick = tick;
        _timer.Start();
    }

    private void SetRoot(UIElement element)
    {
        Root.Children.Clear();
        Root.Children.Add(element);
    }

    // ----------------------------------------------------------------- Accueil

    private async Task LoadHomeAsync()
    {
        StopTimer();
        try
        {
            _recipes = await _api.GetRecipesAsync();
            var mix = await _api.GetMixStatusAsync();
            if (mix.InProgress && mix.Recipe is not null)
            {
                _selectedRecipe = mix.Recipe;
                _selectedWeight = mix.TotalWeight;
                ShowMix();
                return;
            }
            ShowHome();
        }
        catch (Exception ex)
        {
            ShowError("Serveur indisponible", ex.Message);
        }
    }

    private void ShowHome()
    {
        StopTimer();
        _selectedRecipe = null;
        _selectedWeight = 0;
        _currentStepIndex = 0;

        var root = Screen();
        root.Children.Add(TopCircleButton("⚙️", "Mode manuel", HorizontalAlignment.Left, async () => await ShowManualAsync()));
        root.Children.Add(TopCircleButton("⛶", "Plein écran", HorizontalAlignment.Right, () => ToggleFullScreen()));

        var center = new StackPanel
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Spacing = 28,
            MaxWidth = 1180
        };

        center.Children.Add(Centered("FarineAPP", 50, White(), true));
        center.Children.Add(Centered("Choisissez la ration", 24, Soft(), false));

        if (_recipes.Count == 0)
        {
            center.Children.Add(EmptyState("Aucune ration pour le moment.", "Ajoutez une ration depuis le web."));
        }
        else
        {
            var cards = new Grid { ColumnSpacing = 18, RowSpacing = 18, HorizontalAlignment = HorizontalAlignment.Center };
            const int perRow = 3;
            var rows = (_recipes.Count + perRow - 1) / perRow;
            for (var c = 0; c < Math.Min(perRow, _recipes.Count); c++)
                cards.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            for (var r = 0; r < rows; r++)
                cards.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            for (var i = 0; i < _recipes.Count; i++)
            {
                var recipe = _recipes[i];
                var card = RecipeCard(recipe, i);
                card.Click += (_, _) =>
                {
                    _selectedRecipe = recipe;
                    ShowWeightSelection();
                };
                Grid.SetColumn(card, i % perRow);
                Grid.SetRow(card, i / perRow);
                cards.Children.Add(card);
            }
            center.Children.Add(cards);
        }

        var system = LinkButton("Système");
        system.Click += async (_, _) => await ShowSystemAsync();
        center.Children.Add(system);

        root.Children.Add(center);
        SetRoot(root);
    }

    private Button RecipeCard(Recipe recipe, int index)
    {
        var panel = new StackPanel { Spacing = 12, VerticalAlignment = VerticalAlignment.Center };

        panel.Children.Add(new Border
        {
            Width = 58,
            Height = 58,
            CornerRadius = new CornerRadius(8),
            Background = IconBg(),
            Child = new TextBlock
            {
                Text = RecipeIcon(recipe, index),
                FontSize = 28,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            }
        });
        panel.Children.Add(new TextBlock
        {
            Text = recipe.Name,
            Foreground = White(),
            FontSize = 30,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            TextWrapping = TextWrapping.Wrap
        });
        panel.Children.Add(new Border
        {
            HorizontalAlignment = HorizontalAlignment.Left,
            CornerRadius = new CornerRadius(999),
            Background = GreenBadgeBg(),
            Padding = new Thickness(10, 4, 10, 4),
            Child = new TextBlock
            {
                Text = $"{recipe.Ingredients.Count} ingrédients",
                Foreground = ColorBrush(0xBB, 0xF7, 0xD0),
                FontSize = 14,
                FontWeight = Microsoft.UI.Text.FontWeights.Bold
            }
        });
        panel.Children.Add(new TextBlock
        {
            Text = IngredientText(recipe, "  ·  "),
            Foreground = Muted(),
            FontSize = 16,
            TextWrapping = TextWrapping.Wrap,
            LineHeight = 24
        });

        return new Button
        {
            Width = 300,
            Height = 280,
            Padding = new Thickness(26),
            HorizontalContentAlignment = HorizontalAlignment.Left,
            Background = Surface(),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Content = panel
        };
    }

    // ------------------------------------------------------------ Choix poids

    private void ShowWeightSelection()
    {
        if (_selectedRecipe is null) return;
        var root = Screen();
        root.Children.Add(TwoPane(
            WithHeading("Choisir le poids", "Sélectionnez la quantité à préparer.", RecipePanel(_selectedRecipe)),
            WeightPanel()));
        root.Children.Add(TopCircleButton("←", "Accueil", HorizontalAlignment.Left, () => ShowHome()));
        SetRoot(root);
    }

    private UIElement WeightPanel()
    {
        var panel = CardPanel();

        var grid = new Grid { RowSpacing = 12, ColumnSpacing = 12, Margin = new Thickness(0, 0, 0, 16) };
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());

        Button? continueButton = null;
        var selected = new List<Button>();

        void Select(double value, Button? source)
        {
            _selectedWeight = value;
            foreach (var b in selected)
                b.Background = value > 0 && b == source ? BlueDeep() : ColorBrush(0x37, 0x41, 0x51);
            if (continueButton is not null) continueButton.IsEnabled = value > 0;
        }

        var options = new[] { 200, 400, 600, 800 };
        for (var i = 0; i < options.Length; i++)
        {
            var weight = options[i];
            var button = new Button
            {
                Height = 104,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                Background = ColorBrush(0x37, 0x41, 0x51),
                Foreground = White(),
                BorderBrush = Line(),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Content = new StackPanel
                {
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Children =
                    {
                        Centered(weight.ToString(), 34, White(), true),
                        Centered("kg", 16, Soft(), false)
                    }
                }
            };
            selected.Add(button);
            button.Click += (_, _) => Select(weight, button);
            Grid.SetRow(button, i / 2);
            Grid.SetColumn(button, i % 2);
            grid.Children.Add(button);
        }
        panel.Children.Add(grid);

        panel.Children.Add(new TextBlock { Text = "Autre poids", Foreground = Soft(), FontSize = 16, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
        var custom = new TextBox
        {
            PlaceholderText = "Ex. 500",
            Height = 52,
            Margin = new Thickness(0, 8, 0, 18),
            Background = Deep(),
            Foreground = White(),
            BorderBrush = Line()
        };
        custom.TextChanged += (_, _) =>
        {
            foreach (var b in selected) b.Background = ColorBrush(0x37, 0x41, 0x51);
            if (double.TryParse(custom.Text, out var value)) Select(value, null);
            else Select(0, null);
        };
        panel.Children.Add(custom);

        var row = new Grid { ColumnSpacing = 12 };
        row.ColumnDefinitions.Add(new ColumnDefinition());
        row.ColumnDefinitions.Add(new ColumnDefinition());
        var back = ActionButton("Retour", Gray());
        back.Click += (_, _) => ShowHome();
        continueButton = ActionButton("Continuer", BlueDeep());
        continueButton.IsEnabled = false;
        continueButton.Click += (_, _) => ShowConfirmation();
        Grid.SetColumn(continueButton, 1);
        row.Children.Add(back);
        row.Children.Add(continueButton);
        panel.Children.Add(row);

        return panel;
    }

    // ------------------------------------------------------------ Confirmation

    private void ShowConfirmation()
    {
        if (_selectedRecipe is null) return;
        var panel = CardPanel();
        panel.Children.Add(EmojiBadge("✅", IconBg()));
        panel.Children.Add(Centered("QUANTITÉ CHOISIE", 14, Accent(), true));
        panel.Children.Add(Centered($"{_selectedWeight:0} kg", 56, Accent(), true));
        panel.Children.Add(Centered("La préparation démarre avec cette ration.", 16, Muted(), false));

        var row = new Grid { ColumnSpacing = 12, Margin = new Thickness(0, 12, 0, 0) };
        row.ColumnDefinitions.Add(new ColumnDefinition());
        row.ColumnDefinitions.Add(new ColumnDefinition());
        var back = ActionButton("Modifier", Gray());
        back.Click += (_, _) => ShowWeightSelection();
        var confirm = ActionButton("Lancer", BlueDeep());
        confirm.Click += async (_, _) =>
        {
            try
            {
                await _api.StartMixAsync(_selectedRecipe, _selectedWeight);
                ShowMix();
            }
            catch (Exception ex)
            {
                ShowError("Impossible de lancer la ration", ex.Message);
            }
        };
        Grid.SetColumn(confirm, 1);
        row.Children.Add(back);
        row.Children.Add(confirm);
        panel.Children.Add(row);

        var root = Screen();
        root.Children.Add(TwoPane(WithHeading("Tout est prêt ?", "Vérifiez une dernière fois avant de lancer.", RecipePanel(_selectedRecipe)), panel));
        root.Children.Add(TopCircleButton("←", "Accueil", HorizontalAlignment.Left, () => ShowHome()));
        SetRoot(root);
    }

    // -------------------------------------------------------------- Ration en cours

    private void ShowMix()
    {
        StopTimer();
        var root = Screen();
        var layout = new Grid { Padding = new Thickness(40, 28, 40, 28), RowSpacing = 16 };
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        layout.RowDefinitions.Add(new RowDefinition());
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var header = new StackPanel { Spacing = 2 };
        header.Children.Add(new TextBlock { Text = "\U0001F33E FarineAPP", Foreground = Yellow(), FontSize = 15, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        header.Children.Add(new TextBlock { Text = "Ration en cours", Foreground = White(), FontSize = 34, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        _connectionWarning = new TextBlock
        {
            Text = "La balance ne répond plus. Le dernier poids reste affiché.",
            Foreground = Yellow(),
            FontSize = 15,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Visibility = Visibility.Collapsed,
            TextWrapping = TextWrapping.Wrap
        };
        header.Children.Add(_connectionWarning);
        layout.Children.Add(header);

        var content = new Grid { ColumnSpacing = 18 };
        content.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.1, GridUnitType.Star) });
        content.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(0.9, GridUnitType.Star) });
        Grid.SetRow(content, 1);

        _focusCard = new StackPanel { Spacing = 14, VerticalAlignment = VerticalAlignment.Center };
        var focus = new Border
        {
            Background = Surface(),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(44, 40, 44, 40),
            Child = _focusCard
        };
        content.Children.Add(focus);

        _progressCard = new StackPanel { Spacing = 10, HorizontalAlignment = HorizontalAlignment.Stretch, VerticalAlignment = VerticalAlignment.Center };
        var progress = new Border
        {
            Background = Surface(),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(28),
            Child = _progressCard
        };
        Grid.SetColumn(progress, 1);
        content.Children.Add(progress);
        layout.Children.Add(content);

        var stop = new Button
        {
            Content = "⛔ Arrêter",
            Height = 64,
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            MaxWidth = 560,
            HorizontalAlignment = HorizontalAlignment.Center,
            Background = ColorBrush(0xB9, 0x1C, 0x1C),
            Foreground = White(),
            CornerRadius = new CornerRadius(8),
            Margin = new Thickness(0, 8, 0, 0)
        };
        stop.Click += async (_, _) =>
        {
            try
            {
                await _api.StopMixAsync();
            }
            catch
            {
                // ignored: we leave the mix anyway
            }
            await LoadHomeAsync();
        };
        var stopHost = new Grid();
        stopHost.Children.Add(stop);
        Grid.SetRow(stopHost, 2);
        layout.Children.Add(stopHost);

        root.Children.Add(layout);
        SetRoot(root);
        _ = RefreshMixAsync();
        StartTimer(() => RefreshMixAsync());
    }

    private async Task RefreshMixAsync(bool allowAutoStep = true)
    {
        if (_refreshing) return;
        _refreshing = true;
        try
        {
            var mix = await _api.GetMixStatusAsync();
            if (!mix.InProgress || mix.Recipe is null)
            {
                StopTimer();
                ShowHome();
                return;
            }

            _selectedRecipe = mix.Recipe;
            _selectedWeight = mix.TotalWeight;
            var weight = await _api.GetWeightAsync();
            var current = weight.Value;
            var total = mix.TotalWeight;
            var overall = total <= 0 ? 0 : Math.Min(100, current / total * 100);
            var autoStep = BuildStep(mix.Recipe, total, current);
            if (allowAutoStep && autoStep is not null) _currentStepIndex = autoStep.Index;
            var step = BuildStepFromIndex(mix.Recipe, total, current, _currentStepIndex) ?? autoStep;

            if (_connectionWarning is not null)
                _connectionWarning.Visibility = mix.Hardware.RpiConnected ? Visibility.Collapsed : Visibility.Visible;

            UpdateFocusCard(mix.Recipe, step);
            UpdateProgressCard(overall, current, total);

            if (overall >= 100)
            {
                await _api.CompleteMixAsync();
                StopTimer();
                ShowCompletion();
            }
        }
        catch
        {
            // Keep the screen stable during transient network loss.
        }
        finally
        {
            _refreshing = false;
        }
    }

    private void UpdateFocusCard(Recipe recipe, StepInfo? step)
    {
        var card = _focusCard;
        if (card is null || step is null) return;
        var totalSteps = recipe.Ingredients.Count;
        card.Children.Clear();

        card.Children.Add(StepIndicator(recipe, step.Index));
        card.Children.Add(new Border { Height = 24 });

        card.Children.Add(Centered($"Ingrédient {step.Index + 1} sur {totalSteps}", 15, Accent(), true));
        card.Children.Add(Centered(DisplayIngredientName(step.Ingredient.Name), 56, White(), true));
        card.Children.Add(Centered($"Objectif: {step.Target:0.0} kg", 20, Muted(), false));

        card.Children.Add(new Border { Height = 36 });
        card.Children.Add(Centered($"{step.Progress:0}% de cet ingrédient", 16, Soft(), true));
        card.Children.Add(Bar(step.Progress, Amber()));
    }

    private void UpdateProgressCard(double percent, double current, double total)
    {
        var panel = _progressCard;
        if (panel is null) return;
        panel.Children.Clear();
        panel.Children.Add(Centered("POIDS ACTUEL", 14, Accent(), true));
        panel.Children.Add(Centered($"{current:0.0}", 78, Accent(), true));
        panel.Children.Add(Centered("kg", 20, Muted(), false));
        panel.Children.Add(new Border { Height = 8 });
        panel.Children.Add(Bar(percent, Green()));
        panel.Children.Add(Centered($"{percent:0}%", 32, Green(), true));
        panel.Children.Add(Centered($"{current:0.0} / {total:0} kg", 16, Muted(), false));
    }

    // -------------------------------------------------------------- Termine

    private void ShowCompletion()
    {
        StopTimer();
        var root = Screen();
        var panel = new StackPanel { Spacing = 16, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        panel.Children.Add(EmojiBadge("✅", GreenBadgeBg()));
        panel.Children.Add(Centered("Ration terminée", 36, White(), true));
        panel.Children.Add(Centered("La préparation est enregistrée.", 18, Muted(), false));
        panel.Children.Add(Centered(_selectedRecipe?.Name ?? "Ration", 28, Soft(), true));
        panel.Children.Add(Centered($"{_selectedWeight:0} kg", 52, Accent(), true));

        var tareStatus = Centered("Pesez le contenant : faites la tare ou retirez-la.", 14, Muted(), false);
        panel.Children.Add(TareButtons(tareStatus));
        panel.Children.Add(tareStatus);

        var home = ActionButton("Nouvelle ration", BlueDeep());
        home.Click += (_, _) => ShowHome();
        panel.Children.Add(home);
        root.Children.Add(panel);
        SetRoot(root);
    }

    private FrameworkElement TareButtons(TextBlock status)
    {
        var row = new Grid { ColumnSpacing = 12, MaxWidth = 520, HorizontalAlignment = HorizontalAlignment.Stretch };
        row.ColumnDefinitions.Add(new ColumnDefinition());
        row.ColumnDefinitions.Add(new ColumnDefinition());

        var tare = ActionButton("⚖️ Faire la tare", ColorBrush(0xB4, 0x53, 0x09));
        tare.Click += async (_, _) =>
        {
            try { await _api.TareAsync(); SetStatus(status, "Balance remise à zéro.", Green()); }
            catch (Exception ex) { SetStatus(status, "Échec : " + ex.Message, ColorBrush(0xF8, 0x71, 0x71)); }
        };

        var untare = ActionButton("↩️ Retirer la tare", Gray());
        Grid.SetColumn(untare, 1);
        untare.Click += async (_, _) =>
        {
            try { await _api.UntareAsync(); SetStatus(status, "Tare retirée.", Green()); }
            catch (Exception ex) { SetStatus(status, "Échec : " + ex.Message, ColorBrush(0xF8, 0x71, 0x71)); }
        };

        row.Children.Add(tare);
        row.Children.Add(untare);
        return row;
    }

    private static void SetStatus(TextBlock target, string text, Brush color)
    {
        target.Text = text;
        target.Foreground = color;
    }

    // -------------------------------------------------------------- Mode manuel

    private async Task ShowManualAsync()
    {
        StopTimer();
        var root = Screen();

        var center = new StackPanel
        {
            Spacing = 14,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(80, 0, 80, 0)
        };
        center.Children.Add(Centered("Mode manuel", 40, White(), true));
        center.Children.Add(Centered("Vérifiez le poids, faites la tare ou pilotez les moteurs.", 18, Soft(), false));

        var body = new Grid { ColumnSpacing = 60, Margin = new Thickness(0, 18, 0, 0) };
        body.ColumnDefinitions.Add(new ColumnDefinition());
        body.ColumnDefinitions.Add(new ColumnDefinition());

        _manualWeight = new StackPanel { VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center };
        body.Children.Add(_manualWeight);

        _manualMotors = new StackPanel { Spacing = 14, VerticalAlignment = VerticalAlignment.Center };
        Grid.SetColumn(_manualMotors, 1);
        body.Children.Add(_manualMotors);

        center.Children.Add(body);
        root.Children.Add(center);
        root.Children.Add(TopCircleButton("←", "Accueil", HorizontalAlignment.Left, () => ShowHome()));
        root.Children.Add(TopCircleButton("⛶", "Plein écran", HorizontalAlignment.Right, () => ToggleFullScreen()));
        SetRoot(root);

        await RefreshManualAsync();
        StartTimer(() => RefreshManualAsync());
    }

    private async Task RefreshManualAsync()
    {
        if (_refreshing) return;
        _refreshing = true;
        WeightPayload weight;
        MotorsPayload motors;
        try
        {
            weight = await _api.GetWeightAsync();
            motors = await _api.GetMotorsAsync();
        }
        catch
        {
            _refreshing = false;
            return;
        }

        var right = _manualWeight;
        if (right is not null)
        {
            right.Children.Clear();
            var error = !string.IsNullOrEmpty(weight.Error);
            right.Children.Add(new Border
            {
                Width = 300,
                Height = 300,
                CornerRadius = new CornerRadius(150),
                BorderBrush = error ? ColorBrush(0xF8, 0x71, 0x71) : ColorBrush(0x22, 0xD3, 0xEE),
                BorderThickness = new Thickness(12),
                Background = Surface(),
                Child = new StackPanel
                {
                    VerticalAlignment = VerticalAlignment.Center,
                    Children =
                    {
                        Centered("⚖️", 30, White(), false),
                        Centered($"{weight.Value:0.0} kg", 56, ColorBrush(0x67, 0xE8, 0xF9), true),
                        Centered(error ? "Dernier poids connu" : "Poids actuel", 16, Muted(), false)
                    }
                }
            });
        }

        var left = _manualMotors;
        if (left is not null)
        {
            left.Children.Clear();
            left.Children.Add(new TextBlock { Text = "Moteurs", Foreground = Soft(), FontSize = 18, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
            left.Children.Add(MotorToggle("corn", "Maïs / Blé", motors.Motors.GetValueOrDefault("corn")));
            left.Children.Add(MotorToggle("alfalfa", "Luzerne", motors.Motors.GetValueOrDefault("alfalfa")));

            var tared = weight.Tared;
            var tareToggle = ActionButton(
                tared ? "↩️ Retirer la tare" : "⚖️ Faire la tare",
                tared ? Gray() : ColorBrush(0xB4, 0x53, 0x09));
            tareToggle.HorizontalAlignment = HorizontalAlignment.Stretch;
            tareToggle.Click += async (_, _) =>
            {
                try
                {
                    if (tared) await _api.UntareAsync();
                    else await _api.TareAsync();
                }
                catch { /* ignored */ }
                await RefreshManualAsync();
            };
            left.Children.Add(tareToggle);
        }

        _refreshing = false;
    }

    private Button MotorToggle(string motor, string label, bool active)
    {
        var header = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        header.Children.Add(new Border
        {
            Width = 14,
            Height = 14,
            CornerRadius = new CornerRadius(7),
            VerticalAlignment = VerticalAlignment.Center,
            Background = active ? ColorBrush(0x34, 0xD3, 0x99) : ColorBrush(0x55, 0x63, 0x74)
        });
        header.Children.Add(new TextBlock
        {
            Text = label,
            Foreground = White(),
            FontSize = 19,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            VerticalAlignment = VerticalAlignment.Center
        });

        var panel = new StackPanel { Spacing = 6, HorizontalAlignment = HorizontalAlignment.Left };
        panel.Children.Add(header);
        panel.Children.Add(new TextBlock
        {
            Text = active ? "En marche — appuyer pour arrêter" : "Arrêté — appuyer pour démarrer",
            Foreground = active ? ColorBrush(0xD1, 0xFA, 0xE5) : Muted(),
            FontSize = 14,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Margin = new Thickness(26, 0, 0, 0)
        });

        var button = new Button
        {
            Height = 96,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            HorizontalContentAlignment = HorizontalAlignment.Left,
            Padding = new Thickness(20),
            Background = active ? ColorBrush(0x04, 0x78, 0x57) : ColorBrush(0x2A, 0x35, 0x47),
            BorderBrush = active ? ColorBrush(0x6E, 0xE7, 0xB7) : Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Content = panel
        };
        button.Click += async (_, _) =>
        {
            try
            {
                await _api.SetMotorAsync(motor, active ? "off" : "on");
            }
            catch
            {
                // ignored
            }
            await RefreshManualAsync();
        };
        return button;
    }

    // -------------------------------------------------------------- Systeme / debug

    private async Task ShowSystemAsync()
    {
        StopTimer();
        var root = Screen();

        var scroll = new ScrollViewer { Padding = new Thickness(0, 90, 0, 40) };
        var width = new Grid();
        width.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        width.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(6, GridUnitType.Star) });
        width.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _systemContent = new StackPanel { Spacing = 16, HorizontalAlignment = HorizontalAlignment.Stretch };
        Grid.SetColumn(_systemContent, 1);
        width.Children.Add(_systemContent);
        scroll.Content = width;
        root.Children.Add(scroll);
        root.Children.Add(TopCircleButton("←", "Accueil", HorizontalAlignment.Left, () => ShowHome()));
        root.Children.Add(TopCircleButton("⛶", "Plein écran", HorizontalAlignment.Right, () => ToggleFullScreen()));
        SetRoot(root);

        await RefreshSystemAsync();
        StartTimer(() => RefreshSystemAsync());
    }

    private async Task RefreshSystemAsync()
    {
        var panel = _systemContent;
        if (panel is null) return;
        if (_refreshing) return;
        _refreshing = true;

        StatusPayload status;
        try
        {
            status = await _api.GetStatusAsync();
        }
        catch (Exception ex)
        {
            _refreshing = false;
            panel.Children.Clear();
            panel.Children.Add(Centered("Système", 40, White(), true));
            panel.Children.Add(DebugCard("Serveur de contrôle", "erreur", "bad", new (string, string, string)[]
            {
                ("Adresse", "http://127.0.0.1:8080", "neutral"),
                ("Erreur", ex.Message, "bad")
            }));
            return;
        }

        var hw = status.State.Hardware;
        var cfg = status.Config;
        var mix = status.State.Mix;
        var w = status.State.LastWeight;
        var motors = status.State.Motors;

        panel.Children.Clear();
        panel.Children.Add(Centered("Système", 40, White(), true));
        panel.Children.Add(Centered("Diagnostic en direct des éléments importants.", 16, Soft(), false));

        // Resume cards
        var cards = new Grid { ColumnSpacing = 14, RowSpacing = 14 };
        cards.ColumnDefinitions.Add(new ColumnDefinition());
        cards.ColumnDefinitions.Add(new ColumnDefinition());
        AddCardCell(cards, 0, 0, StatusCard("Balance (RPi)", hw.RpiConnected ? "Connectee" : "À vérifier", hw.RpiConnected ? "ok" : "bad",
            hw.RpiConnected ? "Le poids peut être lu." : "Le poids affiché peut dater."));
        AddCardCell(cards, 0, 1, StatusCard("Boîtier moteurs", cfg.ShellySimulation ? "Simulation" : hw.ShellyConnected ? "Connecté" : "À vérifier",
            cfg.ShellySimulation ? "warn" : hw.ShellyConnected ? "ok" : "bad",
            cfg.ShellySimulation ? "Mode test actif." : "Commande Shelly."));
        AddCardCell(cards, 1, 0, StatusCard("Préparation", mix.InProgress ? "En cours" : "Prêt", mix.InProgress ? "ok" : "warn",
            mix.InProgress ? mix.RecipeID ?? "Ration en cours" : "Aucune ration lancée."));
        AddCardCell(cards, 1, 1, StatusCard("Poids affiché", $"{w.Value:0.0} kg", "neutral", "Dernière valeur reçue."));
        panel.Children.Add(cards);

        // Debug detail
        panel.Children.Add(DebugCard("Serveur de contrôle (Windows)", "joignable", "ok", new (string, string, string)[]
        {
            ("Adresse", "http://127.0.0.1:8080", "neutral"),
            ("Réponse /api/status", "OK", "ok")
        }));
        panel.Children.Add(DebugCard("Balance / RPi", hw.RpiConnected ? "connectée" : "déconnectée", hw.RpiConnected ? "ok" : "bad", new (string, string, string)[]
        {
            ("Connecté", hw.RpiConnected ? "oui" : "non", hw.RpiConnected ? "ok" : "bad"),
            ("URL série RPi", cfg.RpiSerialServerUrl ?? "-", "neutral"),
            ("Dernière erreur", string.IsNullOrEmpty(hw.RpiLastError) ? "aucune" : hw.RpiLastError!, string.IsNullOrEmpty(hw.RpiLastError) ? "ok" : "bad"),
            ("Source du poids", w.Source ?? "-", "neutral"),
            ("Poids stable", w.Stable ? "oui" : "non", w.Stable ? "ok" : "warn"),
            ("Période de lecture", $"{cfg.WeightPollMs} ms", "neutral")
        }));
        panel.Children.Add(DebugCard("Moteurs / Shelly", cfg.ShellySimulation ? "simulation" : hw.ShellyConnected ? "connecté" : "à vérifier",
            cfg.ShellySimulation ? "warn" : hw.ShellyConnected ? "ok" : "bad", new (string, string, string)[]
        {
            ("Mode simulation", cfg.ShellySimulation ? "oui" : "non", cfg.ShellySimulation ? "warn" : "ok"),
            ("Connecté", hw.ShellyConnected ? "oui" : "non", hw.ShellyConnected ? "ok" : "bad"),
            ("Dernière erreur", string.IsNullOrEmpty(hw.ShellyLastError) ? "aucune" : hw.ShellyLastError!, string.IsNullOrEmpty(hw.ShellyLastError) ? "ok" : "bad"),
            ("Moteur Maïs/Blé (corn)", motors.GetValueOrDefault("corn") ? "en marche" : "arrêté", motors.GetValueOrDefault("corn") ? "ok" : "neutral"),
            ("Moteur Luzerne (alfalfa)", motors.GetValueOrDefault("alfalfa") ? "en marche" : "arrêté", motors.GetValueOrDefault("alfalfa") ? "ok" : "neutral")
        }));
        panel.Children.Add(DebugCard("Préparation en cours", mix.InProgress ? "active" : "inactive", mix.InProgress ? "ok" : "neutral", new (string, string, string)[]
        {
            ("En cours", mix.InProgress ? "oui" : "non", mix.InProgress ? "ok" : "neutral"),
            ("Ration", mix.RecipeID ?? "-", "neutral"),
            ("Poids cible", $"{mix.TotalWeight:0} kg", "neutral")
        }));

        _refreshing = false;
    }

    private static void AddCardCell(Grid grid, int row, int col, FrameworkElement element)
    {
        if (grid.RowDefinitions.Count <= row) grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        Grid.SetRow(element, row);
        Grid.SetColumn(element, col);
        grid.Children.Add(element);
    }

    private Border StatusCard(string title, string value, string tone, string note)
    {
        var panel = new StackPanel { Spacing = 6 };
        panel.Children.Add(new TextBlock { Text = title, Foreground = Muted(), FontSize = 15 });
        panel.Children.Add(new TextBlock { Text = value, Foreground = White(), FontSize = 26, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        panel.Children.Add(new TextBlock { Text = note, Foreground = Muted(), FontSize = 14, TextWrapping = TextWrapping.Wrap });
        return new Border
        {
            Background = Surface(),
            BorderBrush = ToneBrush(tone),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(22),
            Child = panel
        };
    }

    private Border DebugCard(string title, string state, string tone, (string Label, string Value, string Tone)[] rows)
    {
        var panel = new StackPanel { Spacing = 10 };
        var head = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
        head.Children.Add(new TextBlock { Text = title, Foreground = White(), FontSize = 20, FontWeight = Microsoft.UI.Text.FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center });
        head.Children.Add(new Border
        {
            CornerRadius = new CornerRadius(999),
            Background = ToneFill(tone),
            Padding = new Thickness(10, 3, 10, 3),
            VerticalAlignment = VerticalAlignment.Center,
            Child = new TextBlock { Text = state, Foreground = ToneBrush(tone), FontSize = 13, FontWeight = Microsoft.UI.Text.FontWeights.Bold }
        });
        panel.Children.Add(head);

        foreach (var row in rows)
        {
            var line = new Grid { ColumnSpacing = 12 };
            line.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(280) });
            line.ColumnDefinitions.Add(new ColumnDefinition());
            line.Children.Add(new TextBlock { Text = row.Label, Foreground = Muted(), FontSize = 15, TextWrapping = TextWrapping.Wrap });
            var value = new TextBlock { Text = row.Value, Foreground = ToneBrush(row.Tone), FontSize = 15, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, TextWrapping = TextWrapping.Wrap };
            Grid.SetColumn(value, 1);
            line.Children.Add(value);
            panel.Children.Add(line);
        }

        return new Border
        {
            Background = Surface(),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(22),
            Child = panel
        };
    }

    // -------------------------------------------------------------- Erreur

    private void ShowError(string title, string message)
    {
        StopTimer();
        var root = Screen();
        var panel = new StackPanel { Spacing = 16, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center, MaxWidth = 520 };
        panel.Children.Add(EmojiBadge("⚠️", IconBg()));
        panel.Children.Add(Centered(title, 34, White(), true));
        panel.Children.Add(Centered(message, 16, Muted(), false));
        var retry = ActionButton("\U0001F504 Réessayer", BlueDeep());
        retry.Click += async (_, _) => await LoadHomeAsync();
        panel.Children.Add(retry);
        root.Children.Add(panel);
        SetRoot(root);
    }

    // -------------------------------------------------------------- Helpers UI

    private Grid Screen() => new() { Background = Bg() };

    private UIElement TwoPane(UIElement left, UIElement right)
    {
        var grid = new Grid { Padding = new Thickness(60, 96, 60, 48), ColumnSpacing = 40 };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(0.9, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.1, GridUnitType.Star) });
        Grid.SetColumn((FrameworkElement)right, 1);
        grid.Children.Add(left);
        grid.Children.Add(right);
        return grid;
    }

    private UIElement WithHeading(string title, string subtitle, UIElement child)
    {
        var stack = new StackPanel { Spacing = 20, VerticalAlignment = VerticalAlignment.Center };
        stack.Children.Add(new TextBlock { Text = title, Foreground = White(), FontSize = 40, FontWeight = Microsoft.UI.Text.FontWeights.Bold, TextWrapping = TextWrapping.Wrap });
        stack.Children.Add(new TextBlock { Text = subtitle, Foreground = Soft(), FontSize = 20, TextWrapping = TextWrapping.Wrap });
        stack.Children.Add(child);
        return stack;
    }

    private UIElement RecipePanel(Recipe recipe)
    {
        var panel = new StackPanel
        {
            Padding = new Thickness(28),
            Spacing = 12,
            Background = Surface(),
            CornerRadius = new CornerRadius(8),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1)
        };
        var head = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16 };
        head.Children.Add(new Border
        {
            Width = 72,
            Height = 72,
            CornerRadius = new CornerRadius(8),
            Background = IconBg(),
            Child = new TextBlock { Text = RecipeIcon(recipe, 0), FontSize = 34, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center }
        });
        var titles = new StackPanel { Spacing = 6, VerticalAlignment = VerticalAlignment.Center };
        titles.Children.Add(new TextBlock { Text = recipe.Name, Foreground = White(), FontSize = 30, FontWeight = Microsoft.UI.Text.FontWeights.Bold });
        titles.Children.Add(new TextBlock { Text = IngredientText(recipe, "  ·  "), Foreground = Muted(), FontSize = 16, TextWrapping = TextWrapping.Wrap });
        head.Children.Add(titles);
        panel.Children.Add(head);
        return panel;
    }

    private StackPanel CardPanel() => new()
    {
        MinHeight = 360,
        Padding = new Thickness(34),
        Spacing = 16,
        VerticalAlignment = VerticalAlignment.Center,
        Background = Surface(),
        CornerRadius = new CornerRadius(8),
        BorderBrush = Line(),
        BorderThickness = new Thickness(1)
    };

    private Border EmojiBadge(string emoji, Brush background) => new()
    {
        Width = 86,
        Height = 86,
        CornerRadius = new CornerRadius(8),
        Background = background,
        HorizontalAlignment = HorizontalAlignment.Center,
        Child = new TextBlock { Text = emoji, FontSize = 42, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center }
    };

    private UIElement EmptyState(string title, string subtitle)
    {
        var panel = new StackPanel { Spacing = 8, HorizontalAlignment = HorizontalAlignment.Center };
        panel.Children.Add(Centered(title, 20, White(), true));
        panel.Children.Add(Centered(subtitle, 16, Muted(), false));
        return new Border
        {
            MinHeight = 180,
            Padding = new Thickness(28),
            Background = Surface(),
            BorderBrush = Line(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Child = panel
        };
    }

    private Button TopCircleButton(string text, string label, HorizontalAlignment side, Action action)
    {
        var button = RoundButton(text, Surface());
        button.Width = 60;
        button.Height = 60;
        button.HorizontalAlignment = side;
        button.VerticalAlignment = VerticalAlignment.Top;
        button.Margin = new Thickness(30);
        button.Click += (_, _) => action();
        ToolTipService.SetToolTip(button, label);
        return button;
    }

    private Button TopCircleButton(string text, string label, HorizontalAlignment side, Func<Task> action)
    {
        var button = RoundButton(text, Surface());
        button.Width = 60;
        button.Height = 60;
        button.HorizontalAlignment = side;
        button.VerticalAlignment = VerticalAlignment.Top;
        button.Margin = new Thickness(30);
        button.Click += async (_, _) => await action();
        ToolTipService.SetToolTip(button, label);
        return button;
    }

    private Button RoundButton(string text, Brush background) => new()
    {
        Content = text,
        Width = 56,
        Height = 56,
        FontWeight = Microsoft.UI.Text.FontWeights.Bold,
        FontSize = 20,
        Background = background,
        Foreground = White(),
        BorderBrush = Line(),
        BorderThickness = new Thickness(1),
        CornerRadius = new CornerRadius(28)
    };

    private Button ActionButton(string text, Brush background) => new()
    {
        Content = text,
        MinWidth = 160,
        MinHeight = 56,
        HorizontalAlignment = HorizontalAlignment.Stretch,
        Padding = new Thickness(18, 0, 18, 0),
        FontSize = 18,
        FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
        Background = background,
        Foreground = White(),
        CornerRadius = new CornerRadius(8)
    };

    private Button LinkButton(string text) => new()
    {
        Content = text,
        Background = new SolidColorBrush(Colors.Transparent),
        Foreground = Accent(),
        FontWeight = Microsoft.UI.Text.FontWeights.Bold,
        MinHeight = 48,
        HorizontalAlignment = HorizontalAlignment.Center,
        Padding = new Thickness(16, 0, 16, 0)
    };

    private TextBlock Centered(string text, double size, Brush color, bool bold) => new()
    {
        Text = text,
        FontSize = size,
        Foreground = color,
        FontWeight = bold ? Microsoft.UI.Text.FontWeights.Bold : Microsoft.UI.Text.FontWeights.Normal,
        TextAlignment = TextAlignment.Center,
        HorizontalAlignment = HorizontalAlignment.Center,
        TextWrapping = TextWrapping.Wrap
    };

    private FrameworkElement Bar(double value, Brush foreground)
    {
        const double height = 16;
        var pct = Math.Clamp(value, 0, 100);
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(pct, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(100 - pct, GridUnitType.Star) });
        var fill = new Border
        {
            Background = foreground,
            CornerRadius = new CornerRadius(height / 2),
            HorizontalAlignment = HorizontalAlignment.Stretch,
            MinWidth = pct > 0 ? height : 0
        };
        Grid.SetColumn(fill, 0);
        grid.Children.Add(fill);

        return new Border
        {
            Height = height,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            CornerRadius = new CornerRadius(height / 2),
            Background = ColorBrush(0x33, 0x41, 0x55),
            Child = grid
        };
    }

    private FrameworkElement StepIndicator(Recipe recipe, int activeIndex)
    {
        var grid = new Grid { ColumnSpacing = 10, Margin = new Thickness(0, 0, 0, 18) };
        for (var i = 0; i < recipe.Ingredients.Count; i++)
            grid.ColumnDefinitions.Add(new ColumnDefinition());

        for (var i = 0; i < recipe.Ingredients.Count; i++)
        {
            var done = i < activeIndex;
            var active = i == activeIndex;
            var seg = new StackPanel { Spacing = 8 };
            seg.Children.Add(new Border
            {
                Height = 8,
                CornerRadius = new CornerRadius(4),
                Background = done ? Green() : active ? Amber() : ColorBrush(0x33, 0x41, 0x55)
            });
            seg.Children.Add(new TextBlock
            {
                Text = DisplayIngredientName(recipe.Ingredients[i].Name),
                FontSize = 13,
                Foreground = active ? White() : done ? Green() : Muted(),
                FontWeight = active ? Microsoft.UI.Text.FontWeights.Bold : Microsoft.UI.Text.FontWeights.SemiBold,
                TextAlignment = TextAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                TextWrapping = TextWrapping.Wrap
            });
            Grid.SetColumn(seg, i);
            grid.Children.Add(seg);
        }
        return grid;
    }

    // -------------------------------------------------------------- Logique

    private static string IngredientText(Recipe recipe, string separator) =>
        string.Join(separator, recipe.Ingredients
            .Where(i => i.Percentage > 0)
            .Select(i => $"{DisplayIngredientName(i.Name)} {i.Percentage:0}%"));

    private static string DisplayIngredientName(string name) =>
        name is "Mais/Ble" or "Mais/Blé" ? "Maïs / Blé" : name;

    private static string RecipeIcon(Recipe recipe, int index)
    {
        var name = (recipe.Name ?? string.Empty).ToLowerInvariant();
        if (name.Contains("brout")) return "\U0001F963";
        if (name.Contains("gén") || name.Contains("gen")) return "\U0001F331";
        if (name.Contains("vache")) return "\U0001F33E";
        return (index % 4) switch
        {
            1 => "\U0001F963",
            2 => "\U0001F4E6",
            3 => "\U0001F331",
            _ => "\U0001F33E"
        };
    }

    private static StepInfo? BuildStep(Recipe recipe, double totalWeight, double currentWeight)
    {
        double cumulative = 0;
        for (var i = 0; i < recipe.Ingredients.Count; i++)
        {
            var target = totalWeight * recipe.Ingredients[i].Percentage / 100.0;
            cumulative += target;
            if (currentWeight <= cumulative || i == recipe.Ingredients.Count - 1)
                return BuildStepFromIndex(recipe, totalWeight, currentWeight, i);
        }
        return null;
    }

    private static StepInfo? BuildStepFromIndex(Recipe recipe, double totalWeight, double currentWeight, int index)
    {
        if (index < 0 || index >= recipe.Ingredients.Count) return null;
        var ingredient = recipe.Ingredients[index];
        double previous = 0;
        for (var i = 0; i < index; i++)
            previous += totalWeight * recipe.Ingredients[i].Percentage / 100.0;
        var target = totalWeight * ingredient.Percentage / 100.0;
        var progress = target <= 0 ? 0 : Math.Clamp((currentWeight - previous) / target * 100.0, 0, 100);
        return new StepInfo(index, ingredient, target, progress);
    }

    // -------------------------------------------------------------- Couleurs (palette web)

    private static SolidColorBrush ColorBrush(byte r, byte g, byte b) => new(Windows.UI.Color.FromArgb(255, r, g, b));
    private static SolidColorBrush ColorBrush(byte a, byte r, byte g, byte b) => new(Windows.UI.Color.FromArgb(a, r, g, b));
    private static SolidColorBrush White() => ColorBrush(0xF9, 0xFA, 0xFB);
    private static SolidColorBrush Muted() => ColorBrush(0xA7, 0xB0, 0xBF);
    private static SolidColorBrush Soft() => ColorBrush(0xD1, 0xD5, 0xDB);
    private static SolidColorBrush Accent() => ColorBrush(0x93, 0xC5, 0xFD);
    private static SolidColorBrush Blue() => ColorBrush(0x3B, 0x82, 0xF6);
    private static SolidColorBrush BlueDeep() => ColorBrush(0x25, 0x63, 0xEB);
    private static SolidColorBrush Green() => ColorBrush(0x10, 0xB9, 0x81);
    private static SolidColorBrush Amber() => ColorBrush(0xF5, 0x9E, 0x0B);
    private static SolidColorBrush Yellow() => ColorBrush(0xFC, 0xD3, 0x4D);
    private static SolidColorBrush Gray() => ColorBrush(0x37, 0x41, 0x51);
    private static SolidColorBrush Bg() => ColorBrush(0x11, 0x18, 0x27);
    private static SolidColorBrush Surface() => ColorBrush(0x1F, 0x29, 0x37);
    private static SolidColorBrush Deep() => ColorBrush(0x15, 0x1D, 0x2B);
    private static SolidColorBrush Line() => ColorBrush(0x1A, 0xFF, 0xFF, 0xFF);
    private static SolidColorBrush IconBg() => ColorBrush(0x1F, 0x3B, 0x82, 0xF6);
    private static SolidColorBrush GreenBadgeBg() => ColorBrush(0x29, 0x10, 0xB9, 0x81);

    private static SolidColorBrush ToneBrush(string tone) => tone switch
    {
        "ok" => ColorBrush(0xBB, 0xF7, 0xD0),
        "warn" => ColorBrush(0xFD, 0xE0, 0x68),
        "bad" => ColorBrush(0xFE, 0xCA, 0xCA),
        _ => Soft()
    };

    private static SolidColorBrush ToneFill(string tone) => tone switch
    {
        "ok" => ColorBrush(0x29, 0x10, 0xB9, 0x81),
        "warn" => ColorBrush(0x29, 0xF5, 0x9E, 0x0B),
        "bad" => ColorBrush(0x29, 0xEF, 0x44, 0x44),
        _ => ColorBrush(0x14, 0xFF, 0xFF, 0xFF)
    };
}

internal sealed class ApiClient(string baseUrl)
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(2) };
    private readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    public async Task<List<Recipe>> GetRecipesAsync() =>
        await _http.GetFromJsonAsync<List<Recipe>>("/api/recipes", _json) ?? [];

    public async Task<MixStatus> GetMixStatusAsync() =>
        await _http.GetFromJsonAsync<MixStatus>("/api/mix/status", _json) ?? new();

    public async Task<WeightPayload> GetWeightAsync() =>
        await _http.GetFromJsonAsync<WeightPayload>("/api/weight", _json) ?? new();

    public async Task<MotorsPayload> GetMotorsAsync() =>
        await _http.GetFromJsonAsync<MotorsPayload>("/api/motors/status", _json) ?? new();

    public async Task<StatusPayload> GetStatusAsync() =>
        await _http.GetFromJsonAsync<StatusPayload>("/api/status", _json) ?? new();

    public async Task StartMixAsync(Recipe recipe, double totalWeight) =>
        await PostAsync("/api/mix/start", new { recipeName = recipe.Name, totalWeight });

    public async Task StopMixAsync() => await PostAsync("/api/mix/stop", new { });
    public async Task CompleteMixAsync() => await PostAsync("/api/mix/complete", new { });
    public async Task TareAsync() => await PostAsync("/api/tare", new { });
    public async Task UntareAsync() => await PostAsync("/api/tare/reset", new { });
    public async Task SetMotorAsync(string motor, string action) => await PostAsync($"/api/motors/{motor}/{action}", new { });

    private async Task PostAsync(string path, object payload)
    {
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await _http.PostAsync(path, content);
        response.EnsureSuccessStatusCode();
    }
}

internal sealed record Recipe(string Name, List<Ingredient> Ingredients);
internal sealed record Ingredient(string Name, double Percentage);

internal sealed class WeightPayload
{
    public double Value { get; set; }
    public string Unit { get; set; } = "kg";
    public bool Stable { get; set; } = true;
    public bool Tared { get; set; }
    public string? Source { get; set; }
    public string? Error { get; set; }
}

internal sealed class MotorsPayload
{
    public Dictionary<string, bool> Motors { get; set; } = [];
    public HardwareInfo Hardware { get; set; } = new();
}

internal sealed class MixStatus
{
    public bool InProgress { get; set; }
    public double TotalWeight { get; set; }
    public string? RecipeID { get; set; }
    public Recipe? Recipe { get; set; }
    public HardwareInfo Hardware { get; set; } = new();
}

internal sealed class StatusPayload
{
    public StateInfo State { get; set; } = new();
    public ConfigInfo Config { get; set; } = new();
}

internal sealed class StateInfo
{
    public HardwareInfo Hardware { get; set; } = new();
    public MixInfo Mix { get; set; } = new();
    public WeightPayload LastWeight { get; set; } = new();
    public Dictionary<string, bool> Motors { get; set; } = [];
}

internal sealed class HardwareInfo
{
    public bool RpiConnected { get; set; }
    public string? RpiLastError { get; set; }
    public bool ShellyConnected { get; set; }
    public string? ShellyLastError { get; set; }
}

internal sealed class MixInfo
{
    public bool InProgress { get; set; }
    public string? RecipeID { get; set; }
    public double TotalWeight { get; set; }
}

internal sealed class ConfigInfo
{
    public string? RpiSerialServerUrl { get; set; }
    public bool ShellySimulation { get; set; }
    public int WeightPollMs { get; set; }
}

internal sealed record StepInfo(int Index, Ingredient Ingredient, double Target, double Progress);
