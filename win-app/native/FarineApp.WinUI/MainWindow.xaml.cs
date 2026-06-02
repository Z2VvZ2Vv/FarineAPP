using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace FarineApp.WinUI;

public sealed partial class MainWindow : Window
{
    private readonly ApiClient _api = new("http://127.0.0.1:8080");
    private readonly DispatcherTimer _timer = new();
    private List<Recipe> _recipes = [];
    private Recipe? _selectedRecipe;
    private double _selectedWeight;
    private int _currentStepIndex;

    public MainWindow()
    {
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;
        _timer.Interval = TimeSpan.FromSeconds(1);
        _timer.Tick += async (_, _) => await RefreshMixAsync();
        _ = LoadHomeAsync();
    }

    private async Task LoadHomeAsync()
    {
        _timer.Stop();
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
            ShowError("Connexion serveur impossible", ex.Message);
        }
    }

    private void ShowHome()
    {
        _timer.Stop();
        _selectedRecipe = null;
        _selectedWeight = 0;
        _currentStepIndex = 0;

        var root = Screen();
        root.Children.Add(TopCircleButton("M", "Mode manuel", HorizontalAlignment.Left, async () => await ShowManualAsync()));
        root.Children.Add(TopCircleButton("R", "Actualiser", HorizontalAlignment.Right, async () => await LoadHomeAsync()));

        var center = new StackPanel
        {
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            Spacing = 32,
            MaxWidth = 1120
        };

        center.Children.Add(new TextBlock
        {
            Text = "FarineAPP",
            Foreground = White(),
            FontSize = 48,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center
        });
        center.Children.Add(new TextBlock
        {
            Text = "Choisissez la ration",
            Foreground = Soft(),
            FontSize = 24,
            HorizontalAlignment = HorizontalAlignment.Center
        });

        var cards = new Grid { ColumnSpacing = 32 };
        for (var i = 0; i < _recipes.Count; i++)
        {
            cards.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            var recipe = _recipes[i];
            var card = RecipeCard(recipe, i);
            card.Click += (_, _) =>
            {
                _selectedRecipe = recipe;
                ShowWeightSelection();
            };
            Grid.SetColumn(card, i);
            cards.Children.Add(card);
        }
        center.Children.Add(cards);

        var admin = LinkButton("Gerer les rations");
        admin.Click += async (_, _) => await ShowAdminAsync();
        center.Children.Add(admin);

        root.Children.Add(center);
        Root.Children.Clear();
        Root.Children.Add(root);
    }

    private Button RecipeCard(Recipe recipe, int index)
    {
        var markColor = (index % 3) switch
        {
            1 => ColorBrush(0x4A, 0xDE, 0x80),
            2 => ColorBrush(0xFB, 0xBF, 0x24),
            _ => Blue()
        };

        var panel = new StackPanel
        {
            Spacing = 18,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
        panel.Children.Add(new Border
        {
            Width = 78,
            Height = 78,
            CornerRadius = new CornerRadius(39),
            Background = Deep(),
            BorderBrush = markColor,
            BorderThickness = new Thickness(2),
            Child = new TextBlock
            {
                Text = recipe.Name[..1].ToUpperInvariant(),
                Foreground = markColor,
                FontSize = 34,
                FontWeight = Microsoft.UI.Text.FontWeights.Bold,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            }
        });
        panel.Children.Add(new TextBlock
        {
            Text = recipe.Name,
            Foreground = White(),
            FontSize = 32,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            TextAlignment = TextAlignment.Center
        });
        panel.Children.Add(new TextBlock
        {
            Text = IngredientText(recipe, "\n"),
            Foreground = Muted(),
            FontSize = 18,
            TextAlignment = TextAlignment.Center,
            LineHeight = 25
        });

        return new Button
        {
            Width = 300,
            Height = 400,
            Padding = new Thickness(26),
            Background = Panel(),
            BorderBrush = Border(),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Content = panel
        };
    }

    private void ShowWeightSelection()
    {
        if (_selectedRecipe is null) return;
        var root = Screen();
        root.Children.Add(TopCircleButton("<", "Retour", HorizontalAlignment.Left, () => ShowHome()));
        root.Children.Add(TwoPane(
            WithHeading("FarineAPP", "Selectionnez le poids", RecipePanel(_selectedRecipe)),
            WeightPanel()));
        Root.Children.Clear();
        Root.Children.Add(root);
    }

    private UIElement WeightPanel()
    {
        var panel = CardPanel();
        var grid = new Grid { RowSpacing = 18, ColumnSpacing = 18, Margin = new Thickness(0, 0, 0, 32) };
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());

        var options = new[] { 200, 400, 600, 800 };
        for (var i = 0; i < options.Length; i++)
        {
            var weight = options[i];
            var button = new Button
            {
                Content = $"{weight} kg",
                Height = 98,
                FontSize = 24,
                FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
                Background = ColorBrush(0x37, 0x41, 0x51),
                Foreground = White(),
                CornerRadius = new CornerRadius(8)
            };
            button.Click += (_, _) =>
            {
                _selectedWeight = weight;
                ShowConfirmation();
            };
            Grid.SetRow(button, i / 2);
            Grid.SetColumn(button, i % 2);
            grid.Children.Add(button);
        }

        panel.Children.Add(grid);
        return panel;
    }

    private void ShowConfirmation()
    {
        if (_selectedRecipe is null) return;
        var panel = CardPanel();
        panel.Children.Add(new TextBlock
        {
            Text = "?",
            Foreground = Blue(),
            FontSize = 54,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 0, 0, 18)
        });
        panel.Children.Add(new TextBlock
        {
            Text = "Poids selectionne",
            Foreground = Muted(),
            FontSize = 16,
            HorizontalAlignment = HorizontalAlignment.Center
        });
        panel.Children.Add(new TextBlock
        {
            Text = $"{_selectedWeight:0} kg",
            Foreground = Blue(),
            FontSize = 52,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center,
            Margin = new Thickness(0, 8, 0, 26)
        });

        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 14, HorizontalAlignment = HorizontalAlignment.Stretch };
        var back = ActionButton("Retour", Gray());
        back.Click += (_, _) => ShowWeightSelection();
        var confirm = ActionButton("Confirmer", ColorBrush(0x25, 0x63, 0xEB));
        confirm.Click += async (_, _) =>
        {
            await _api.StartMixAsync(_selectedRecipe, _selectedWeight);
            ShowMix();
        };
        row.Children.Add(back);
        row.Children.Add(confirm);
        panel.Children.Add(row);

        var root = Screen();
        root.Children.Add(TopCircleButton("<", "Retour", HorizontalAlignment.Left, () => ShowWeightSelection()));
        root.Children.Add(TwoPane(WithHeading("FarineAPP", "Confirmer la ration", RecipePanel(_selectedRecipe)), panel));
        Root.Children.Clear();
        Root.Children.Add(root);
    }

    private void ShowMix()
    {
        _timer.Stop();
        var root = Screen();
        var layout = new Grid { Padding = new Thickness(16), RowSpacing = 12 };
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        layout.RowDefinitions.Add(new RowDefinition());

        var header = new Grid { MinHeight = 70 };
        header.ColumnDefinitions.Add(new ColumnDefinition());
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        header.ColumnDefinitions.Add(new ColumnDefinition());
        header.Children.Add(new TextBlock
        {
            Text = "FarineAPP",
            Foreground = White(),
            FontSize = 28,
            FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        });
        var controls = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, HorizontalAlignment = HorizontalAlignment.Right };
        var tare = RoundButton("T", ColorBrush(0xF5, 0x9E, 0x0B));
        tare.Click += async (_, _) => await _api.TareAsync();
        var stop = RoundButton("S", ColorBrush(0xDC, 0x26, 0x26));
        stop.Click += async (_, _) =>
        {
            await _api.StopMixAsync();
            await LoadHomeAsync();
        };
        controls.Children.Add(tare);
        controls.Children.Add(stop);
        Grid.SetColumn(controls, 2);
        header.Children.Add(controls);
        layout.Children.Add(header);

        var content = new Grid { RowSpacing = 12 };
        content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        content.RowDefinitions.Add(new RowDefinition());

        var step = new Border { Background = Panel(), CornerRadius = new CornerRadius(8), Padding = new Thickness(22), Child = new StackPanel { Spacing = 10 } };
        step.Name = "StepCard";
        content.Children.Add(step);

        var bottom = new Grid { ColumnSpacing = 12 };
        bottom.ColumnDefinitions.Add(new ColumnDefinition());
        bottom.ColumnDefinitions.Add(new ColumnDefinition());
        bottom.ColumnDefinitions.Add(new ColumnDefinition());
        Grid.SetRow(bottom, 1);
        content.Children.Add(bottom);
        bottom.Children.Add(Metric("WeightCard"));
        var progress = Metric("ProgressCard");
        Grid.SetColumn(progress, 1);
        bottom.Children.Add(progress);
        var motors = Metric("MotorsCard");
        Grid.SetColumn(motors, 2);
        bottom.Children.Add(motors);

        Grid.SetRow(content, 1);
        layout.Children.Add(content);
        root.Children.Add(layout);
        Root.Children.Clear();
        Root.Children.Add(root);
        _ = RefreshMixAsync();
        _timer.Start();
    }

    private async Task RefreshMixAsync()
    {
        try
        {
            var mix = await _api.GetMixStatusAsync();
            if (!mix.InProgress || mix.Recipe is null)
            {
                _timer.Stop();
                ShowHome();
                return;
            }

            _selectedRecipe = mix.Recipe;
            _selectedWeight = mix.TotalWeight;
            var weight = await _api.GetWeightAsync();
            var motors = await _api.GetMotorsAsync();
            var current = weight.Value;
            var overall = mix.TotalWeight <= 0 ? 0 : Math.Min(100, current / mix.TotalWeight * 100);
            var step = BuildStep(mix.Recipe, mix.TotalWeight, current);
            if (step is not null) _currentStepIndex = step.Index;

            UpdateStepCard(step, mix.Recipe.Ingredients.Count);
            UpdateWeightCard(current);
            UpdateProgressCard(overall, current, mix.TotalWeight);
            UpdateMotorsCard(motors.Motors);

            if (overall >= 100)
            {
                await _api.CompleteMixAsync();
                _timer.Stop();
                ShowCompletion();
            }
        }
        catch
        {
            // Keep the screen stable during transient network loss.
        }
    }

    private void UpdateStepCard(StepInfo? step, int totalSteps)
    {
        var card = FindByName<Border>("StepCard");
        if (card?.Child is not StackPanel panel || step is null) return;
        panel.Children.Clear();
        panel.Children.Add(Centered($"ETAPE {step.Index + 1}/{totalSteps}", 18, Blue(), true));
        panel.Children.Add(Centered(step.Ingredient.Name, 28, White(), true));
        panel.Children.Add(Centered($"{step.Target:0.0} kg ({step.Ingredient.Percentage:0}%)", 16, Muted(), false));
        panel.Children.Add(Centered($"{step.Progress:0}% de cette etape", 15, Soft(), true));
        panel.Children.Add(Bar(step.Progress, ColorBrush(0xF5, 0x9E, 0x0B)));
    }

    private void UpdateWeightCard(double current)
    {
        var panel = FindByName<StackPanel>("WeightCard");
        if (panel is null) return;
        panel.Children.Clear();
        panel.Children.Add(new Border
        {
            Width = 134,
            Height = 134,
            CornerRadius = new CornerRadius(67),
            BorderBrush = Blue(),
            BorderThickness = new Thickness(4),
            Background = Deep(),
            Child = new StackPanel
            {
                VerticalAlignment = VerticalAlignment.Center,
                Children =
                {
                    Centered($"{current:0.0}", 30, Blue(), true),
                    Centered("kg", 16, Muted(), false)
                }
            }
        });
    }

    private void UpdateProgressCard(double percent, double current, double total)
    {
        var panel = FindByName<StackPanel>("ProgressCard");
        if (panel is null) return;
        panel.Children.Clear();
        panel.Children.Add(Centered("PROGRESSION TOTALE", 14, Soft(), true));
        panel.Children.Add(Centered($"{percent:0}%", 36, Green(), true));
        panel.Children.Add(Centered($"{current:0.0} / {total:0} kg", 16, White(), false));
        panel.Children.Add(Bar(percent, Green()));
        panel.Children.Add(Centered($"Restant: {Math.Max(total - current, 0):0.0} kg", 14, Muted(), false));
    }

    private void UpdateMotorsCard(Dictionary<string, bool> motors)
    {
        var panel = FindByName<StackPanel>("MotorsCard");
        if (panel is null) return;
        panel.Children.Clear();
        panel.Children.Add(Centered("MOTEURS SHELLY", 14, Soft(), true));
        panel.Children.Add(MotorButton("corn", "Mais/Ble", motors.GetValueOrDefault("corn")));
        panel.Children.Add(MotorButton("alfalfa", "Luzerne", motors.GetValueOrDefault("alfalfa")));
        var done = ActionButton("Terminer", Green());
        done.Click += async (_, _) =>
        {
            await _api.CompleteMixAsync();
            ShowCompletion();
        };
        panel.Children.Add(done);
    }

    private Button MotorButton(string motor, string label, bool active)
    {
        var button = ActionButton($"{(active ? "Arreter" : "Demarrer")} {label}", active ? ColorBrush(0xF9, 0x73, 0x16) : Green());
        button.Click += async (_, _) =>
        {
            await _api.SetMotorAsync(motor, active ? "off" : "on");
            await RefreshMixAsync();
        };
        return button;
    }

    private async Task ShowManualAsync()
    {
        _timer.Stop();
        var root = Screen();
        var layout = new Grid { Padding = new Thickness(20) };
        layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        layout.RowDefinitions.Add(new RowDefinition());
        var header = new Grid();
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        header.ColumnDefinitions.Add(new ColumnDefinition());
        var back = RoundButton("<", Panel());
        back.Click += (_, _) => ShowHome();
        header.Children.Add(back);
        var title = Centered("FarineAPP", 26, White(), true);
        Grid.SetColumn(title, 1);
        header.Children.Add(title);
        layout.Children.Add(header);

        var body = new Grid { ColumnSpacing = 40 };
        body.ColumnDefinitions.Add(new ColumnDefinition());
        body.ColumnDefinitions.Add(new ColumnDefinition());
        Grid.SetRow(body, 1);
        layout.Children.Add(body);
        var left = new StackPanel { Spacing = 16, VerticalAlignment = VerticalAlignment.Center };
        left.Name = "ManualMotors";
        body.Children.Add(left);
        var right = new StackPanel { VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center };
        right.Name = "ManualWeight";
        Grid.SetColumn((FrameworkElement)right, 1);
        body.Children.Add(right);
        root.Children.Add(layout);
        Root.Children.Clear();
        Root.Children.Add(root);
        await RefreshManualAsync();
        _timer.Tick -= ManualTick;
        _timer.Tick += ManualTick;
        _timer.Start();
    }

    private async void ManualTick(object? sender, object e)
    {
        await RefreshManualAsync();
    }

    private async Task RefreshManualAsync()
    {
        var weight = await _api.GetWeightAsync();
        var motors = await _api.GetMotorsAsync();
        var left = FindByName<StackPanel>("ManualMotors");
        var right = FindByName<StackPanel>("ManualWeight");
        if (left is not null)
        {
            left.Children.Clear();
            left.Children.Add(Centered("Mode Manuel", 34, ColorBrush(0x06, 0xB6, 0xD4), true));
            left.Children.Add(MotorButton("corn", "Mais/Ble", motors.Motors.GetValueOrDefault("corn")));
            left.Children.Add(MotorButton("alfalfa", "Luzerne", motors.Motors.GetValueOrDefault("alfalfa")));
            var tare = ActionButton("Tare balance", ColorBrush(0xB4, 0x53, 0x09));
            tare.Click += async (_, _) => await _api.TareAsync();
            left.Children.Add(tare);
        }
        if (right is not null)
        {
            right.Children.Clear();
            right.Children.Add(new Border
            {
                Width = 310,
                Height = 310,
                CornerRadius = new CornerRadius(155),
                BorderBrush = ColorBrush(0x06, 0xB6, 0xD4),
                BorderThickness = new Thickness(12),
                Child = new StackPanel
                {
                    VerticalAlignment = VerticalAlignment.Center,
                    Children =
                    {
                        Centered($"{weight.Value:0.0}", 64, ColorBrush(0x06, 0xB6, 0xD4), true),
                        Centered("kg", 26, ColorBrush(0x06, 0xB6, 0xD4), true),
                        Centered("Poids actuel", 16, Muted(), false)
                    }
                }
            });
        }
    }

    private async Task ShowAdminAsync()
    {
        _timer.Stop();
        _recipes = await _api.GetRecipesAsync();
        var root = Screen();
        var scroll = new ScrollViewer();
        var panel = new StackPanel { Padding = new Thickness(28), Spacing = 18 };
        scroll.Content = panel;
        var top = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        var home = ActionButton("Retour app", Gray());
        home.Click += (_, _) => ShowHome();
        top.Children.Add(home);
        top.Children.Add(Centered("Gerer les rations", 32, White(), true));
        panel.Children.Add(top);
        foreach (var recipe in _recipes)
        {
            panel.Children.Add(new Border
            {
                Background = Panel(),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(18),
                Child = new TextBlock
                {
                    Text = $"{recipe.Name}\n{IngredientText(recipe, " / ")}",
                    Foreground = White(),
                    FontSize = 18
                }
            });
        }
        root.Children.Add(scroll);
        Root.Children.Clear();
        Root.Children.Add(root);
    }

    private void ShowCompletion()
    {
        _timer.Stop();
        var root = Screen();
        var panel = new StackPanel { Spacing = 18, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        panel.Children.Add(Centered("FarineAPP", 46, White(), true));
        panel.Children.Add(Centered("Melange termine", 34, Green(), true));
        panel.Children.Add(Centered($"{_selectedRecipe?.Name} - {_selectedWeight:0} kg", 22, Soft(), false));
        var home = ActionButton("Retour accueil", Green());
        home.Click += (_, _) => ShowHome();
        panel.Children.Add(home);
        root.Children.Add(panel);
        Root.Children.Clear();
        Root.Children.Add(root);
    }

    private void ShowError(string title, string message)
    {
        var root = Screen();
        var panel = new StackPanel { Spacing = 18, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        panel.Children.Add(Centered(title, 36, White(), true));
        panel.Children.Add(Centered(message, 16, Muted(), false));
        var retry = ActionButton("Reessayer", Blue());
        retry.Click += async (_, _) => await LoadHomeAsync();
        panel.Children.Add(retry);
        root.Children.Clear();
        root.Children.Add(panel);
        Root.Children.Clear();
        Root.Children.Add(root);
    }

    private Grid Screen() => new() { Background = ColorBrush(0x0F, 0x17, 0x2A) };

    private UIElement TwoPane(UIElement left, UIElement right)
    {
        var grid = new Grid { Padding = new Thickness(60, 96, 60, 48), ColumnSpacing = 60 };
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        Grid.SetColumn((FrameworkElement)right, 1);
        grid.Children.Add(left);
        grid.Children.Add(right);
        return grid;
    }

    private UIElement WithHeading(string title, string subtitle, UIElement child)
    {
        var stack = new StackPanel { Spacing = 24 };
        stack.Children.Add(Centered(title, 48, White(), true));
        stack.Children.Add(Centered(subtitle, 22, Soft(), false));
        stack.Children.Add(child);
        return stack;
    }

    private UIElement RecipePanel(Recipe recipe)
    {
        var panel = CardPanel();
        panel.Children.Add(Centered(recipe.Name, 32, White(), true));
        panel.Children.Add(Centered(IngredientText(recipe, ", "), 18, Muted(), false));
        return panel;
    }

    private StackPanel CardPanel()
    {
        return new StackPanel
        {
            MinHeight = 360,
            Padding = new Thickness(34),
            Spacing = 18,
            VerticalAlignment = VerticalAlignment.Center,
            Background = Panel()
        };
    }

    private Border Metric(string name) => new()
    {
        Background = Panel(),
        CornerRadius = new CornerRadius(8),
        Padding = new Thickness(18),
        Child = new StackPanel { Name = name, Spacing = 12, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center }
    };

    private Button TopCircleButton(string text, string label, HorizontalAlignment side, Action action)
    {
        var button = RoundButton(text, Panel());
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
        var button = TopCircleButton(text, label, side, () => { });
        button.Click += async (_, _) => await action();
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
        CornerRadius = new CornerRadius(28)
    };

    private Button ActionButton(string text, Brush background) => new()
    {
        Content = text,
        MinWidth = 160,
        MinHeight = 56,
        Padding = new Thickness(18, 0, 18, 0),
        FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
        Background = background,
        Foreground = White(),
        CornerRadius = new CornerRadius(8)
    };

    private Button LinkButton(string text) => new()
    {
        Content = text,
        Background = new SolidColorBrush(Colors.Transparent),
        Foreground = Blue(),
        MinHeight = 48,
        Padding = new Thickness(14, 0, 14, 0)
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

    private ProgressBar Bar(double value, Brush foreground) => new()
    {
        Value = value,
        Maximum = 100,
        Foreground = foreground,
        Background = ColorBrush(0x33, 0x41, 0x55),
        Height = 12,
        MinWidth = 280
    };

    private T? FindByName<T>(string name) where T : FrameworkElement => FindChild<T>(Root, name);

    private static T? FindChild<T>(DependencyObject parent, string name) where T : FrameworkElement
    {
        var count = VisualTreeHelper.GetChildrenCount(parent);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T element && element.Name == name) return element;
            var result = FindChild<T>(child, name);
            if (result is not null) return result;
        }
        return null;
    }

    private static string IngredientText(Recipe recipe, string separator) =>
        string.Join(separator, recipe.Ingredients.Select(i => $"{i.Name} ({i.Percentage:0}%)"));

    private static StepInfo? BuildStep(Recipe recipe, double totalWeight, double currentWeight)
    {
        double cumulative = 0;
        for (var i = 0; i < recipe.Ingredients.Count; i++)
        {
            var ingredient = recipe.Ingredients[i];
            var previous = cumulative;
            var target = totalWeight * ingredient.Percentage / 100.0;
            cumulative += target;
            if (currentWeight <= cumulative || i == recipe.Ingredients.Count - 1)
            {
                var progress = target <= 0 ? 0 : Math.Clamp((currentWeight - previous) / target * 100.0, 0, 100);
                return new StepInfo(i, ingredient, target, progress);
            }
        }
        return null;
    }

    private static SolidColorBrush ColorBrush(byte r, byte g, byte b) => new(Windows.UI.Color.FromArgb(255, r, g, b));
    private static SolidColorBrush White() => ColorBrush(0xFF, 0xFF, 0xFF);
    private static SolidColorBrush Muted() => ColorBrush(0x94, 0xA3, 0xB8);
    private static SolidColorBrush Soft() => ColorBrush(0xCB, 0xD5, 0xE1);
    private static SolidColorBrush Blue() => ColorBrush(0x60, 0xA5, 0xFA);
    private static SolidColorBrush Green() => ColorBrush(0x10, 0xB9, 0x81);
    private static SolidColorBrush Gray() => ColorBrush(0x4B, 0x55, 0x63);
    private static SolidColorBrush Panel() => ColorBrush(0x1E, 0x29, 0x3B);
    private static SolidColorBrush Deep() => ColorBrush(0x0F, 0x17, 0x2A);
    private static SolidColorBrush Border() => ColorBrush(0x33, 0x41, 0x55);
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

    public async Task StartMixAsync(Recipe recipe, double totalWeight) =>
        await PostAsync("/api/mix/start", new { recipe, totalWeight });

    public async Task StopMixAsync() => await PostAsync("/api/mix/stop", new { });
    public async Task CompleteMixAsync() => await PostAsync("/api/mix/complete", new { });
    public async Task TareAsync() => await PostAsync("/api/tare", new { });
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
internal sealed record WeightPayload(double Value = 0, string Unit = "kg", bool Stable = true);
internal sealed class MotorsPayload
{
    public Dictionary<string, bool> Motors { get; set; } = [];
}
internal sealed record MixStatus(bool InProgress = false, double TotalWeight = 0, string? RecipeID = null, Recipe? Recipe = null);
internal sealed record StepInfo(int Index, Ingredient Ingredient, double Target, double Progress);
