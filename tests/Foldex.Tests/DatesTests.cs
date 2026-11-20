using System.Text.Json;

namespace Foldex.Tests;

// Dates as the date columns show them (src/web/dates.js): a pattern as .NET's and Windows'; the setting, else Windows'.
public class DatesTests
{
    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "dates.js"));

    static JsonElement Run(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void APatternAsWindowsHasIt()
    {
        var r = Run("""
            (() => {
              const ms = new Date(2026, 2, 5, 14, 7, 9).getTime(), morning = new Date(2026, 10, 20, 9, 30, 0).getTime();
              return [formatDateTime(ms, 'dd-MM-yyyy HH:mm'), formatDateTime(ms, 'd-M-yy H:m:s'), formatDateTime(ms, 'yyyy-MM-dd HH:mm:ss'),
                formatDateTime(ms, 'MM/dd/yyyy h:mm tt'), formatDateTime(morning, 'hh:mm tt'), formatDateTime(ms, "yyyy 'at' HH\\h")];
            })()
            """);
        Assert.Equal(["05-03-2026 14:07", "5-3-26 14:7:9", "2026-03-05 14:07:09", "03/05/2026 2:07 PM", "09:30 AM", "2026 at 14h"],
            r.EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public void YoursElseWindows()
    {
        var r = Run("""
            (() => {
              systemDate = 'd-M-yyyy H:mm';
              return [datePattern({ dateFormat: '' }), datePattern({ dateFormat: 'yyyy-MM-dd' }), datePattern(null)];
            })()
            """);
        Assert.Equal(["d-M-yyyy H:mm", "yyyy-MM-dd", "d-M-yyyy H:mm"], r.EnumerateArray().Select(x => x.GetString()));
    }
}
