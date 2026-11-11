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
    public void AClosedProjectKeepsItsWindow()
    {
        var s = Empty();
        var p = s.NewProject("Klanten");
        var w = s.AddWindow(p);
        w.Session = Layout("p1");
        s.CloseByHand(w.Key);
        Assert.False(Assert.Single(p.Windows).Open);
        Assert.Equal("p1", s.LayoutOf(w.Key)!["active"]!.GetValue<string>());
        Assert.Null(s.LayoutOf(s.AddWindow(s.NewProject("")).Key));   // a new project: the default layout
    }

    [Fact]
    public void ThePanesAreATreeOfRootsAndTheirChildren()
    {
        // Two roots, A (a tree) and E; A drives B and D, B drives C (a preview). Each pane by its branch's state.
        var session = JsonNode.Parse("""
            { "panes": { "panes": [
              { "id": "A", "kind": "tree", "source": null, "lastKey": 0, "states": { "0": { "focus": "C:\\" } } },
              { "id": "B", "kind": "list", "source": "A", "lastKey": "", "states": { "": { "location": "C:\\Users" } } },
              { "id": "E", "kind": "list", "source": null, "states": { "": { "location": null } } },
              { "id": "C", "kind": "preview", "source": "B", "states": {} },
              { "id": "D", "kind": "list", "source": "A", "lastKey": "", "states": { "": { "location": "D:\\" } } } ] } }
            """);
        var tree = ProjectStore.PaneTree(session).Select(t => $"{t.Depth} {t.Kind} {t.Folder}");
        Assert.Equal(["0 tree C:\\", "1 list C:\\Users", "2 preview ", "1 list D:\\", "0 list "], tree);
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
    public void DeleteRefusesAnOpenProject()
    {
        var s = Empty();
        var p = s.NewProject("Klanten");
        var w = s.AddWindow(p);
        Assert.False(s.Delete(p));
        s.CloseByHand(w.Key);
        Assert.True(s.Delete(p));
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
