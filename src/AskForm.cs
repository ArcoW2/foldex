using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Foldex's own question window, as LexPen's (..\LexPen\src\AskForm.cs, its plan PLAN-own-dialogs): modal, in the look
/// of a window (its colours, the app font, light or dark), moved by its title bar. A window of its own, so it is never
/// behind Windows' preview, which lies over the page. Placed just right of a point and a bit down (kept on that
/// screen), else in the middle of its window. A sign (information, question, warning, error), a heading, a text,
/// optional checkboxes (all checked) or choices (one checked), buttons, an optional "Show details". A button with a
/// note is a command link (one under the other, its note under its name); the others are in a row at the right. The
/// default button has the accent (Enter); one without a value is Cancel (Esc, as closing it). Each button has a key, as
/// in Windows' boxes (Yes: Y, No: N, Cancel: C; no Alt needed): the first letter of its name, else its first one not
/// taken by a button before it. Always underlined, not only once Alt is pressed.
/// Where it differs from LexPen's: Foldex's colours are worked out in the page (look.js), so the look comes from the
/// page (look.js hostLook: the colours as RGB, dark, the window font) rather than from the host's theme files; the
/// caption is not coloured (Foldex's windows do not colour theirs), only made dark in dark mode.
/// </summary>
sealed class AskForm : Form
{
    public enum Sign { None, Information, Question, Warning, Error }

    /// <summary>What to ask. Buttons: (value, name, note); a null value is Cancel. Default: the default button's value
    /// (else the first button). Choices: radio buttons, (value, text, checked).</summary>
    public sealed class Question
    {
        public string? Heading { get; init; }
        public string Text { get; init; } = "";
        public Sign Sign { get; init; }
        public IReadOnlyList<(string Value, string Text)> Boxes { get; init; } = [];
        public IReadOnlyList<(string Value, string Text, bool Checked)> Choices { get; init; } = [];
        public IReadOnlyList<(string? Value, string Text, string? Note)> Buttons { get; init; } = [];
        public string? Default { get; init; }
        public string? Details { get; init; }
        public Point? Near { get; init; }
    }

    readonly List<ButtonBase> picks = [];
    readonly Point? near;
    string? answer;

    AskForm(Form? w, JsonObject? look, Question q)
    {
        near = q.Near;
        Color Of(string name, Color fallback) => look?["colours"]?[name] is JsonArray { Count: 3 } c
            ? Color.FromArgb(c[0]!.GetValue<int>(), c[1]!.GetValue<int>(), c[2]!.GetValue<int>()) : fallback;
        var bg = Of("--bg", SystemColors.Window);
        var fg = Of("--fg", SystemColors.WindowText);
        var bar = Of("--bg-bar", SystemColors.Control);
        var border = Of("--border", SystemColors.ControlDark);
        var accent = Of("--accent", SystemColors.Highlight);
        static Color Mix(Color a, Color b, double t) => Color.FromArgb((int)(a.R + (b.R - a.R) * t), (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));

        Text = "Foldex";
        Icon = w?.Icon ?? Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MinimizeBox = MaximizeBox = false;
        ShowInTaskbar = w is null;
        StartPosition = near is not null ? FormStartPosition.Manual : w is null ? FormStartPosition.CenterScreen : FormStartPosition.CenterParent;
        AutoSize = true;
        AutoSizeMode = AutoSizeMode.GrowAndShrink;
        BackColor = bg;
        ForeColor = fg;
        Font = LookFont(look);
        Padding = new Padding(20, 16, 20, 16);
        var width = LogicalToDeviceUnits(480);
        var defaultValue = q.Default ?? q.Buttons.FirstOrDefault().Value;

        // The sign at the left of all the rest, as Windows' boxes.
        var outer = new TableLayoutPanel { AutoSize = true, ColumnCount = 2, Location = new Point(Padding.Left, Padding.Top), Margin = Padding.Empty };
        if (SignIcon(q.Sign) is StockIconId id)
        {
            var side = LogicalToDeviceUnits(32);
            using var stock = SystemIcons.GetStockIcon(id, side);
            outer.Controls.Add(new PictureBox { Image = stock.ToBitmap(), Size = new Size(side, side), SizeMode = PictureBoxSizeMode.Zoom, Margin = new Padding(0, 0, 16, 0) }, 0, 0);
        }
        var layout = new TableLayoutPanel { AutoSize = true, ColumnCount = 1, Margin = Padding.Empty };
        outer.Controls.Add(layout, 1, 0);
        if (q.Heading is not null)
            layout.Controls.Add(new Label
            {
                Text = q.Heading, UseMnemonic = false, AutoSize = true, MaximumSize = new Size(width, 0), ForeColor = accent,
                Font = new Font(Font.FontFamily, Font.Size * 1.25f), Margin = new Padding(0, 0, 0, Font.Height / 2),
            });
        // The text, then one empty line.
        if (q.Text.Length > 0)
            layout.Controls.Add(new Label { Text = q.Text, UseMnemonic = false, AutoSize = true, MaximumSize = new Size(width, 0), Margin = new Padding(0, 0, 0, Font.Height) });
        foreach (var (value, label) in q.Boxes)
            Pick(new Box(Mix(bg, fg, .45), accent, Mix(bg, fg, .7)) { Text = label, Tag = value, Checked = true });
        foreach (var (value, label, on) in q.Choices)
            Pick(new Dot(Mix(bg, fg, .45), accent, Mix(bg, fg, .7)) { Text = label, Tag = value, Checked = on });
        void Pick(ButtonBase pick)
        {
            pick.AutoSize = true;
            pick.Margin = new Padding(0, 3, 0, 3);
            picks.Add(pick);
            layout.Controls.Add(pick);
        }

        Button Make(string? value, string label, string? note)
        {
            var main = value is not null && value == defaultValue;
            // A command link: its name in the accent, its note under it, as wide as the text; the default one framed in
            // the accent. The others: the default one filled with the accent.
            Button button = note is null
                ? new KeyButton
                {
                    Text = label, AutoSize = true, FlatStyle = FlatStyle.Flat, UseVisualStyleBackColor = false,
                    BackColor = main ? accent : bar, ForeColor = main ? Color.White : fg,
                    MinimumSize = new Size(LogicalToDeviceUnits(80), 0), Padding = new Padding(8, 2, 8, 2), Margin = new Padding(8, 0, 0, 0),
                }
                : new Link(label, note, accent, Mix(bg, fg, .7), main ? accent : border, Mix(bar, fg, .1))
                {
                    BackColor = bar, ForeColor = fg, Width = width, Margin = new Padding(0, 0, 0, 6),
                };
            if (note is null)
            {
                button.FlatAppearance.BorderColor = main ? accent : border;
                button.FlatAppearance.MouseOverBackColor = main ? Mix(accent, Color.White, .15) : Mix(bar, fg, .1);
            }
            button.Click += (_, _) => { answer = value; Close(); };
            if (main) AcceptButton = button;
            if (value is null) CancelButton = button;
            return button;
        }
        var taken = new HashSet<char>();
        var buttons = q.Buttons.Select(b => (b.Value, Text: Keyed(b.Text, taken), b.Note)).ToList();   // their keys in their order
        foreach (var (value, label, note) in buttons.Where(b => b.Note is not null))
            layout.Controls.Add(Make(value, label, note));
        // The other buttons at the right, in their order.
        var row = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Anchor = AnchorStyles.Right, Margin = new Padding(0, 10, 0, 0), WrapContents = false };
        foreach (var (value, label, _) in buttons.Where(b => b.Note is null).Reverse())
            row.Controls.Add(Make(value, label, null));
        if (q.Details is not null)
        {
            // Show details: the text under the buttons, at the left of their row.
            var details = new Label { Text = q.Details, UseMnemonic = false, AutoSize = true, MaximumSize = new Size(width, 0), Visible = false, Margin = new Padding(0, 10, 0, 0) };
            var toggle = new LinkLabel
            {
                Text = "Show details", AutoSize = true, LinkColor = accent, ActiveLinkColor = accent, VisitedLinkColor = accent,
                LinkBehavior = LinkBehavior.HoverUnderline, Margin = new Padding(0, 14, 0, 0), Anchor = AnchorStyles.Left,
            };
            toggle.LinkClicked += (_, _) =>
            {
                details.Visible = !details.Visible;
                toggle.Text = details.Visible ? "Hide details" : "Show details";
            };
            var foot = new TableLayoutPanel { AutoSize = true, ColumnCount = 2, Margin = Padding.Empty, Dock = DockStyle.Fill };
            foot.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            foot.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            foot.Controls.Add(toggle, 0, 0);
            foot.Controls.Add(row, 1, 0);
            layout.Controls.Add(foot);
            layout.Controls.Add(details);
        }
        else layout.Controls.Add(row);
        Controls.Add(outer);

        var dark = look?["dark"]?.GetValue<bool>() == true;
        HandleCreated += (_, _) =>
        {
            var on = dark ? 1 : 0;
            DwmSetWindowAttribute(Handle, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, ref on, sizeof(int));
        };
    }

    // The window font of the look (its first family, its size in CSS px), else Segoe UI 9 pt.
    static Font LookFont(JsonObject? look)
    {
        var family = look?["font"]?.GetValue<string>()?.Split(',')[0].Trim().Trim('"', '\'');
        var px = look?["size"]?.GetValue<double>() ?? 0;
        try { return new Font(string.IsNullOrEmpty(family) ? "Segoe UI" : family, px > 0 ? (float)(px * 0.75) : 9f); }
        catch (ArgumentException) { return new Font("Segoe UI", 9f); }
    }

    // A button's name with its key marked (&), an & of the name itself kept as one (&&).
    static string Keyed(string label, HashSet<char> taken)
    {
        var at = Enumerable.Range(0, label.Length).FirstOrDefault(i => char.IsLetterOrDigit(label[i]) && taken.Add(char.ToUpperInvariant(label[i])), -1);
        var text = label.Replace("&", "&&");
        return at < 0 ? text : text.Insert(at + label[..at].Count(c => c == '&'), "&");
    }

    static StockIconId? SignIcon(Sign sign) => sign switch
    {
        Sign.Information => StockIconId.Info,
        Sign.Question => StockIconId.Help,
        Sign.Warning => StockIconId.Warning,
        Sign.Error => StockIconId.Error,
        _ => null,
    };

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        if (near is not Point at) return;
        var area = Screen.FromPoint(at).WorkingArea;
        var x = Math.Min(at.X + LogicalToDeviceUnits(24), area.Right - Width);
        var y = Math.Min(at.Y + LogicalToDeviceUnits(12), area.Bottom - Height);
        Location = new Point(Math.Max(area.Left, x), Math.Max(area.Top, y));
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        (AcceptButton as Control ?? CancelButton as Control)?.Focus();
    }

    /// <summary>Asks over `owner`, the window the question comes from; when there is none (or it is gone or hidden), over the
    /// window last worked in. In `look` (the page's, look.js hostLook), else in the look the window last worked in
    /// told (MainForm.Look). Gives the value of the button chosen (null: Cancel, Esc or closed) and the values of the
    /// checked boxes or the choice.</summary>
    public static (string? Answer, List<string> Checked) Ask(AppHost app, IWin32Window? owner, Question q, JsonObject? look = null)
    {
        var over = owner as Form;
        if (over is null || over.IsDisposed || !over.Visible) over = app.LastActive;
        look ??= (over as MainForm ?? app.LastActive)?.Look;
        using var form = new AskForm(over, look, q);
        if (over is null) form.ShowDialog(); else form.ShowDialog(over);
        return (form.answer, form.picks.Where(p => p is CheckBox { Checked: true } or RadioButton { Checked: true }).Select(p => (string)p.Tag!).ToList());
    }

    /// <summary>The button chosen, nothing else to check: Ask's answer alone.</summary>
    public static string? Answer(AppHost app, IWin32Window? owner, Question q, JsonObject? look = null) => Ask(app, owner, q, look).Answer;

    /// <summary>A message with OK.</summary>
    public static void Tell(AppHost app, IWin32Window? owner, Sign sign, string text) =>
        Ask(app, owner, new Question { Sign = sign, Text = text, Buttons = [("ok", "OK", null)] });

    /// <summary>A yes / no question of a page (askYes): its title, then its lines after an empty line; true for Yes.</summary>
    public static bool Confirm(AppHost app, IWin32Window owner, JsonNode msg, JsonObject? look = null)
    {
        var text = msg["text"]?.GetValue<string>() ?? "";
        var lines = msg["lines"]?.AsArray().Select(n => n?.GetValue<string>() ?? "").ToList() ?? [];
        if (lines.Count > 0) text += "\n\n" + string.Join("\n", lines);
        return Answer(app, owner, new Question
        {
            Text = text,
            Sign = Sign.Warning,
            Buttons = [("yes", "Yes", null), (null, "No", null)],
        }, look) == "yes";
    }

    // A button with its key always underlined: Windows hides them until Alt is pressed.
    sealed class KeyButton : Button
    {
        protected override bool ShowKeyboardCues => true;
    }

    // A checkbox drawn as Settings' are (18 px, the accent colour): a rounded box in the border colour; checked, filled with the
    // accent and a white tick. Hovered, the border gets `hover`; with the focus, a dotted line around the text.
    sealed class Box(Color border, Color accent, Color hover) : CheckBox
    {
        bool over;

        protected override void OnCreateControl() { SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true); base.OnCreateControl(); }

        protected override void OnMouseEnter(EventArgs e) { over = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { over = false; Invalidate(); base.OnMouseLeave(e); }

        public override Size GetPreferredSize(Size proposed) => PickSize(this, Side);

        int Side => LogicalToDeviceUnits(18);   // as Settings' checkboxes (settings.css)

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? BackColor);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            var side = Side;
            var r = new RectangleF(.5f, (Height - side) / 2f + .5f, side - 1, side - 1);
            using var path = Rounded(r, LogicalToDeviceUnits(2));
            if (Checked)
            {
                using var fill = new SolidBrush(accent);
                g.FillPath(fill, path);
                using var tick = new Pen(Color.White, Math.Max(1.5f, side / 8f)) { StartCap = System.Drawing.Drawing2D.LineCap.Round, EndCap = System.Drawing.Drawing2D.LineCap.Round, LineJoin = System.Drawing.Drawing2D.LineJoin.Round };
                g.DrawLines(tick, [new PointF(r.X + r.Width * .24f, r.Y + r.Height * .52f), new PointF(r.X + r.Width * .43f, r.Y + r.Height * .71f), new PointF(r.X + r.Width * .77f, r.Y + r.Height * .31f)]);
            }
            else
            {
                using var pen = new Pen(over ? hover : border, LogicalToDeviceUnits(1));
                g.DrawPath(pen, path);
            }
            PickText(this, g, side, Focused && ShowFocusCues);
        }

        static System.Drawing.Drawing2D.GraphicsPath Rounded(RectangleF r, float radius)
        {
            var path = new System.Drawing.Drawing2D.GraphicsPath();
            var d = radius * 2;
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    // A choice drawn to go with Box: a circle in the border colour; checked, an accent ring with an accent dot.
    sealed class Dot(Color border, Color accent, Color hover) : RadioButton
    {
        bool over;

        protected override void OnCreateControl() { SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true); base.OnCreateControl(); }

        protected override void OnMouseEnter(EventArgs e) { over = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { over = false; Invalidate(); base.OnMouseLeave(e); }

        public override Size GetPreferredSize(Size proposed) => PickSize(this, Side);

        int Side => LogicalToDeviceUnits(18);

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Parent?.BackColor ?? BackColor);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            var side = Side;
            var r = new RectangleF(1, (Height - side) / 2f + 1, side - 2, side - 2);
            using var pen = new Pen(Checked ? accent : over ? hover : border, LogicalToDeviceUnits(Checked ? 2 : 1));
            g.DrawEllipse(pen, r);
            if (Checked)
            {
                using var fill = new SolidBrush(accent);
                var d = side * .45f;
                g.FillEllipse(fill, r.X + (r.Width - d) / 2, r.Y + (r.Height - d) / 2, d, d);
            }
            PickText(this, g, side, Focused && ShowFocusCues);
        }
    }

    // A command link, as Windows' task dialogs have: its name a bit larger in the accent, its note under it in a dimmer
    // colour, framed; hovered, a lighter background. Its Text holds both (what UI Automation reads).
    sealed class Link : Button
    {
        readonly string label, note;
        readonly Color nameColour, noteColour, frame, hoverBack;
        Font? big;
        bool over;

        public Link(string label, string note, Color nameColour, Color noteColour, Color frame, Color hoverBack)
        {
            (this.label, this.note, this.nameColour, this.noteColour, this.frame, this.hoverBack) = (label, note, nameColour, noteColour, frame, hoverBack);
            Text = label + "\n" + note.Replace("&", "&&");   // label: with its key (&)
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
        }

        int Pad => LogicalToDeviceUnits(10);

        protected override void OnFontChanged(EventArgs e)
        {
            base.OnFontChanged(e);
            big?.Dispose();
            big = new Font(Font.FontFamily, Font.Size * 1.15f);
            Height = Pad * 2 + big.Height + LogicalToDeviceUnits(2) + Font.Height;
        }

        protected override void OnMouseEnter(EventArgs e) { over = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { over = false; Invalidate(); base.OnMouseLeave(e); }

        protected override bool ShowKeyboardCues => true;   // as KeyButton

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(over ? hoverBack : BackColor);
            using (var pen = new Pen(frame, LogicalToDeviceUnits(1))) g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
            var font = big ?? Font;
            var flags = TextFormatFlags.Left | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix;
            // Its key underlined.
            TextRenderer.DrawText(g, label, font, new Rectangle(Pad, Pad, Width - 2 * Pad, font.Height), nameColour, flags & ~TextFormatFlags.NoPrefix);
            TextRenderer.DrawText(g, note, Font, new Rectangle(Pad, Pad + font.Height + LogicalToDeviceUnits(2), Width - 2 * Pad, Font.Height), noteColour, flags);
            if (Focused && ShowFocusCues) ControlPaint.DrawFocusRectangle(g, Rectangle.Inflate(ClientRectangle, -3, -3));
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) big?.Dispose();
            base.Dispose(disposing);
        }
    }

    static Size PickSize(Control c, int side)
    {
        var text = TextRenderer.MeasureText(c.Text, c.Font, Size.Empty, TextFormatFlags.NoPrefix);
        return new Size(side + c.LogicalToDeviceUnits(8) + text.Width, Math.Max(side, text.Height) + 2);
    }

    // The text of a box or choice right of its mark; with the focus, a dotted line around it.
    static void PickText(Control c, Graphics g, int side, bool focused)
    {
        var gap = c.LogicalToDeviceUnits(8);
        var textRect = new Rectangle(side + gap, 0, c.Width - side - gap, c.Height);
        TextRenderer.DrawText(g, c.Text, c.Font, textRect, c.ForeColor, TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix);
        if (focused) ControlPaint.DrawFocusRectangle(g, Rectangle.Inflate(textRect with { Width = TextRenderer.MeasureText(c.Text, c.Font, Size.Empty, TextFormatFlags.NoPrefix).Width }, 2, 0));
    }

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
