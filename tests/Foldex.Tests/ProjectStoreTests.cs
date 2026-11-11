using System.Text.Json.Nodes;

namespace Foldex.Tests;

// Projects (docs/plans/15-PLAN-projects.md 3.1 to 3.4, 3.8): ProjectStore without windows.
public class ProjectStoreTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-projects-" + Guid.NewGuid().ToString("N"));
    string FilePath => Path.Combine(dir, ProjectStore.FileName);

    public void Dispose()
    {
        if (Directory.Exists(dir)) Directory.Delete(dir, true);
    }

    ProjectStore Empty() => ProjectStore.Load(FilePath);

    static JsonObject Layout(string active) => new() { ["panes"] = new JsonObject(), ["docks"] = new JsonObject(), ["active"] = active };

    [Fact]
    public void NumbersAreNeverReusedAndSurviveARoundTrip()
    {
        var s = Empty();
        var a = s.NewProject(" Klanten ");
        var w = s.AddWindow(a);
        w.Session = Layout("p1");
        (w.Bounds, w.Desktop) = ([1, 2, 300, 400], "d1");
        s.Delete(s.NewProject(""));   // project 2 gone: its number is not used again
        s.Save();

        var back = ProjectStore.Load(FilePath);
        Assert.Equal("Klanten", back.Get(1)!.Name);
        Assert.Equal("p1", back.WindowOf(w.Key)!.Session!["active"]!.GetValue<string>());
        Assert.Equal([1, 2, 300, 400], back.WindowOf(w.Key)!.Bounds!);
        Assert.Equal("d1", back.WindowOf(w.Key)!.Desktop);
        Assert.Equal(3, back.NewProject("").Id);
        Assert.Equal("Project 3", ProjectStore.Display(back.Get(3)!));
        Assert.False(File.Exists(FilePath + ".tmp"));
    }

    [Fact]
    public void TheOldStateLayoutBecomesProject1()
    {
        var s = ProjectStore.Load(FilePath, Layout("p7"), [5, 6, 700, 800], true);
        var w = Assert.Single(Assert.Single(s.Projects).Windows);
        Assert.True(w.Open);
        Assert.True(w.Maximized);
        Assert.Equal("p7", w.Session!["active"]!.GetValue<string>());
    }

    [Fact]
    public void AWindowClosedWhileAnotherOfItsProjectStaysIsForgotten()
    {
        var s = Empty();
        var p = s.NewProject("Klanten");
        var a = s.AddWindow(p);
        var b = s.AddWindow(p);
        s.CloseByHand(a.Key);
        Assert.Equal([b.Key], p.Windows.Select(w => w.Key));
        s.CloseByHand(b.Key);   // the last: kept, closed
        Assert.False(Assert.Single(p.Windows).Open);
        Assert.Same(p, s.Get(p.Id));
    }

    [Fact]
    public void AnUnnamedClosedProjectReplacesTheOlderOneOfItsDesktopOnly()
    {
        var s = Empty();
        ProjectStore.Window Closed(string desktop, string name = "")
        {
            var w = s.AddWindow(s.NewProject(name));
            w.Desktop = desktop;
            s.CloseByHand(w.Key);
            return w;
        }
        var first = Closed("d1");
        var other = Closed("d2");
        var named = Closed("d1", "Klanten");
        var second = Closed("d1");
        Assert.Null(s.ProjectOf(first.Key));   // the older unnamed one of d1 went
        Assert.NotNull(s.ProjectOf(other.Key));   // another desktop's stays
        Assert.NotNull(s.ProjectOf(named.Key));   // a named one stays
        Assert.NotNull(s.ProjectOf(second.Key));
        Assert.Same(s.ProjectOf(second.Key), s.LastClosedOn("d1"));
    }

    [Fact]
    public void CloseWithProjectKeepsEveryWindow()
    {
        var s = Empty();
        var p = s.NewProject("Klanten");
        var a = s.AddWindow(p);
        var b = s.AddWindow(p);
        s.CloseWithProject(a.Key);
        s.CloseWithProject(b.Key);
        Assert.Equal(2, p.Windows.Count);
        Assert.All(p.Windows, w => Assert.False(w.Open));
    }

    [Fact]
    public void MovingTheLastWindowOutDropsAnUnnamedProjectButNotANamedOne()
    {
        var s = Empty();
        var unnamed = s.NewProject("");
        var named = s.NewProject("Klanten");
        var target = s.NewProject("Archief");
        var a = s.AddWindow(unnamed);
        var b = s.AddWindow(named);
        s.MoveWindow(a.Key, target);
        s.MoveWindow(b.Key, target);
        Assert.Null(s.Get(unnamed.Id));
        Assert.NotNull(s.Get(named.Id));
        Assert.Equal(2, target.Windows.Count);
    }

    [Fact]
    public void MergeMovesTheWindowsAndDeleteRefusesAnOpenProject()
    {
        var s = Empty();
        var to = s.NewProject("Klanten");
        var from = s.NewProject("Oud");
        s.AddWindow(to);
        var w = s.AddWindow(from);
        s.Merge(to, [from]);
        Assert.Null(s.Get(from.Id));
        Assert.Same(to, s.ProjectOf(w.Key));
        Assert.False(s.Delete(to));   // its windows are open
        foreach (var o in to.Windows.ToList()) s.CloseWithProject(o.Key);
        Assert.True(s.Delete(to));
    }

    [Fact]
    public void ANewWindowTakesTheLayoutOfItsProjectsLastUsedWindow()
    {
        var s = Empty();
        var p = s.NewProject("Klanten");
        var old = s.AddWindow(p);
        old.Session = Layout("old");
        old.Used = DateTime.UtcNow.AddHours(-1);
        var recent = s.AddWindow(p);
        recent.Session = Layout("recent");
        var fresh = s.AddWindow(p);
        Assert.Equal("recent", s.LayoutOf(fresh.Key)!["active"]!.GetValue<string>());
        Assert.Equal("old", s.LayoutOf(old.Key)!["active"]!.GetValue<string>());
        Assert.Null(s.LayoutOf(s.AddWindow(s.NewProject("")).Key));   // a new project: the default layout
    }

    [Fact]
    public void StartWindowsAreTheOpenOnesAndForgetDropsAnEmptyProject()
    {
        var s = Empty();
        var a = s.AddWindow(s.NewProject("Klanten"));
        var b = s.AddWindow(s.NewProject(""));
        s.CloseByHand(a.Key);
        Assert.Equal([b.Key], s.StartWindows().Select(o => o.Window.Key));
        var p = s.ProjectOf(b.Key)!;
        s.Forget(b.Key);
        Assert.Null(s.Get(p.Id));
    }
}
