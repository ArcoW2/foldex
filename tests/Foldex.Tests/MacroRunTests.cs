using System.Diagnostics;
using Foldex.Shell;

namespace Foldex.Tests;

// A macro's run (docs/plans/34-PLAN-macros.md 3.3): the start each request makes; one run started and waited for.
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
}
