using System.Diagnostics;
using Foldex.Shell;

namespace Foldex.Tests;

// A macro's run (docs/plans/executed/34-PLAN-macros.md 3.3): the start each request makes; one run started and waited for.
public class MacroRunTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-run-" + Guid.NewGuid().ToString("N"));

    public MacroRunTests() => Directory.CreateDirectory(Path.Combine(dir, "sub"));

    public void Dispose()
    {
        try { Directory.Delete(dir, true); } catch (IOException) { }
    }

    static MacroRun.Request R(string what, string folder = "", string window = "normal", bool admin = false, string args = "") =>
        new(what, args, folder, window, admin, false);

    [Fact]
    public void EachOptionBuildsTheStartItShould()
    {
        var (s, error) = MacroRun.StartOf(R(" notepad.exe ", args: "\"a b.txt\""));
        Assert.Null(error);
        Assert.Equal("notepad.exe", s!.FileName);
        Assert.Equal("\"a b.txt\"", s.Arguments);
        Assert.True(s.UseShellExecute);
        Assert.Equal(ProcessWindowStyle.Normal, s.WindowStyle);
        Assert.Equal("", s.Verb);
        Assert.Equal("", s.WorkingDirectory);
        Assert.Equal(ProcessWindowStyle.Minimized, MacroRun.StartOf(R("x", window: "minimized")).Start!.WindowStyle);
        Assert.Equal(ProcessWindowStyle.Maximized, MacroRun.StartOf(R("x", window: "maximized")).Start!.WindowStyle);
        Assert.Equal(ProcessWindowStyle.Hidden, MacroRun.StartOf(R("x", window: "hidden")).Start!.WindowStyle);
        Assert.Equal("runas", MacroRun.StartOf(R("x", admin: true)).Start!.Verb);
        // The folder with .. worked out; one that is not there, nothing to run: why.
        Assert.Equal(dir, MacroRun.StartOf(R("x", Path.Combine(dir, "sub") + "\\..")).Start!.WorkingDirectory);
        Assert.Equal($"run: the folder \"{Path.Combine(dir, "gone")}\" is not there", MacroRun.StartOf(R("x", Path.Combine(dir, "gone"))).Error);
        Assert.Equal("run: nothing to run", MacroRun.StartOf(R("  ")).Error);
    }

    // Started in its folder and waited for: its exit code; a program that is not there: why.
    [Fact]
    public async Task ARunThatWaitsGivesItsExitCode()
    {
        var done = await MacroRun.Run(new MacroRun.Request("cmd.exe", "/c if exist sub exit 7", dir, "hidden", false, true));
        Assert.Equal(7, done["exitCode"]!.GetValue<int>());
        var failed = await MacroRun.Run(new MacroRun.Request(Path.Combine(dir, "none.exe"), "", "", "hidden", false, true));
        Assert.StartsWith($"run: {Path.Combine(dir, "none.exe")}: ", failed["error"]!.GetValue<string>());
    }

    // A macro's rights (docs/plans/executed/39-PLAN-elevated-macros.md 3.3): under never a program starts directly with
    // __COMPAT_LAYER, a document through cmd's start; admin_forced as administrator under every setting.
    [Fact]
    public void TheRightsOfTheMacroBuildTheStart()
    {
        var never = MacroRun.StartOf(R("notepad.exe") with { Rights = "never" }).Start!;
        Assert.False(never.UseShellExecute);
        Assert.Equal("RunAsInvoker", never.Environment["__COMPAT_LAYER"]);
        var doc = MacroRun.StartOf(R("C:\\a b\\read me.txt", args: "x") with { Rights = "never", Wait = true }).Start!;
        Assert.Equal("cmd.exe", doc.FileName);
        Assert.Equal("/c start \"\" /wait \"C:\\a b\\read me.txt\" x", doc.Arguments);
        Assert.Equal("RunAsInvoker", doc.Environment["__COMPAT_LAYER"]);
        foreach (var rights in new[] { "", "never" })
        {
            var forced = MacroRun.StartOf(R("x.exe") with { AdminForced = true, Rights = rights }).Start!;
            Assert.Equal("runas", forced.Verb);
            Assert.True(forced.UseShellExecute);
        }
        Assert.Null(Environment.GetEnvironmentVariable("__COMPAT_LAYER"));   // never on Foldex itself
    }

    // Under never, a program that waits gives its exit code as always.
    [Fact]
    public async Task UnderNeverAProgramGivesItsExitCode()
    {
        var done = await MacroRun.Run(new MacroRun.Request("cmd.exe", "/c exit 7", dir, "hidden", false, true, Rights: "never"));
        Assert.Equal(7, done["exitCode"]!.GetValue<int>());
    }

    // With the rights the helper is asked to start it; the helper's own refusals of its new operations.
    [Fact]
    public async Task WithTheRightsTheHelperStartsItAndRefusesWhatIsNotItsOwn()
    {
        System.Text.Json.Nodes.JsonObject? asked = null;
        var a = await MacroRun.Run(new MacroRun.Request("x.exe", "p", dir, "hidden", false, true, Rights: "elevated"),
            r => { asked = r; return Task.FromResult(new System.Text.Json.Nodes.JsonObject { ["exitCode"] = 4 }); });
        Assert.Equal(4, a["exitCode"]!.GetValue<int>());
        Assert.Equal("start", asked!["op"]!.GetValue<string>());
        Assert.Equal("x.exe", asked["what"]!.GetValue<string>());
        string Error(string line) => ElevatedHelper.Answer(line)["error"]?.GetValue<string>() ?? "";
        Assert.Equal("", Error("""{"op":"hello"}"""));
        Assert.Equal("fileOp needs a file operation, full paths and its flags", Error("""{"op":"fileOp","kind":"format","ids":["C:\\x"],"flags":0}"""));
        Assert.Equal("fileOp needs a file operation, full paths and its flags", Error("""{"op":"fileOp","kind":"copy","ids":["x"],"target":"C:\\y","flags":0}"""));
        Assert.Equal("fileOp needs a file operation, full paths and its flags", Error("""{"op":"fileOp","kind":"copy","ids":["C:\\x"],"target":"y","flags":0}"""));
        Assert.Equal("start needs what it starts", Error("""{"op":"start"}"""));
        // A copy as the helper does it (here not elevated): done.
        File.WriteAllText(Path.Combine(dir, "a.txt"), "a");
        var copied = ElevatedHelper.Answer(new System.Text.Json.Nodes.JsonObject
        {
            ["op"] = "fileOp", ["kind"] = "copy", ["ids"] = new System.Text.Json.Nodes.JsonArray(Path.Combine(dir, "a.txt")),
            ["target"] = Path.Combine(dir, "sub"), ["flags"] = 0x614,
        }.ToJsonString());
        Assert.Null(copied["error"]);
        Assert.False(copied["aborted"]!.GetValue<bool>());
        Assert.True(File.Exists(Path.Combine(dir, "sub", "a.txt")));
    }
}
