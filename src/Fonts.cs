using System.Drawing.Text;

namespace Foldex;

/// <summary>
/// The installed font families for the font settings (docs/plans/executed/08-PLAN-fonts.md 3.1, as LexPen's Fonts without the
/// monospaced mark). Built once per run.
/// </summary>
static class Fonts
{
    static List<string>? list;
    static readonly object building = new();

    public static List<string> List()
    {
        lock (building)
        {
            if (list != null) return list;
            using var installed = new InstalledFontCollection();
            list = installed.Families
                .Select(f => f.Name)
                .Where(n => !n.StartsWith('@'))   // the vertical variants of East Asian fonts
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                .ToList();
            return list;
        }
    }
}
