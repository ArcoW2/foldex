using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Projects (docs/plans/15-PLAN-projects.md 3.1, as LexPen's ProjectStore): a project has a number, a name you can give
/// it and windows; a window keeps its session (the page's layout: panes, docks, the active pane), its place and its
/// virtual desktop. Kept in State\projects.json, written whole and atomically (a crash never leaves a broken file).
/// Pure apart from that file, so the rules can be tested without windows. Unnamed projects: only the last closed one
/// of each desktop is kept (3.4).
/// </summary>
sealed class ProjectStore
{
    public const string FileName = "projects.json";

    public sealed class Project
    {
        public int Id;
        public string Name = "";
        public DateTime Used;
        public DateTime? Created;
        public List<Window> Windows = [];
    }

    public sealed class Window
    {
        public int Key;
        public bool Open;
        public JsonNode? Session;
        public int[]? Bounds;            // x, y, width, height
        public bool Maximized;
        public string? Desktop;
        public DateTime Used;
    }

    readonly string path;
    public List<Project> Projects { get; } = [];
    int nextProject = 1, nextWindow = 1;

    ProjectStore(string path) => this.path = path;

    /// <summary>Reads the file. Without one, the layout of the old state.json (the last closed window's, plan 12 3.4)
    /// becomes project 1 with one open window, at the old window place.</summary>
    public static ProjectStore Load(string path, JsonNode? legacyLayout = null, int[]? legacyBounds = null, bool legacyMaximized = false)
    {
        var store = new ProjectStore(path);
        JsonObject? root = null;
        try { root = JsonNode.Parse(File.ReadAllText(path)) as JsonObject; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        if (root is null)
        {
            if (legacyLayout is not null)
            {
                var p = store.NewProject("");
                var w = store.AddWindow(p);
                w.Session = legacyLayout.DeepClone();
                (w.Bounds, w.Maximized) = (legacyBounds, legacyMaximized);
            }
            return store;
        }
        store.nextProject = root["nextProject"]?.GetValue<int>() ?? 1;
        store.nextWindow = root["nextWindow"]?.GetValue<int>() ?? 1;
        foreach (var pn in root["projects"]?.AsArray() ?? [])
        {
            if (pn is not JsonObject po) continue;
            var p = new Project
            {
                Id = po["id"]?.GetValue<int>() ?? store.nextProject++,
                Name = po["name"]?.GetValue<string>() ?? "",
                Used = Time(po["used"]),
                Created = po["created"] is null ? null : Time(po["created"]),
            };
            foreach (var wn in po["windows"]?.AsArray() ?? [])
            {
                if (wn is not JsonObject wo) continue;
                p.Windows.Add(new Window
                {
                    Key = wo["key"]?.GetValue<int>() ?? store.nextWindow++,
                    Open = wo["open"]?.GetValue<bool>() ?? false,
                    Session = wo["session"]?.DeepClone(),
                    Bounds = wo["bounds"] is JsonArray b && b.Count == 4 ? b.Select(v => v!.GetValue<int>()).ToArray() : null,
                    Maximized = wo["maximized"]?.GetValue<bool>() ?? false,
                    Desktop = wo["desktop"]?.GetValue<string>(),
                    Used = Time(wo["used"]),
                });
            }
            store.Projects.Add(p);
        }
        store.nextProject = Math.Max(store.nextProject, store.Projects.Select(p => p.Id + 1).DefaultIfEmpty(1).Max());
        store.nextWindow = Math.Max(store.nextWindow, store.Projects.SelectMany(p => p.Windows).Select(w => w.Key + 1).DefaultIfEmpty(1).Max());
        return store;
    }

    static DateTime Time(JsonNode? n) =>
        n?.GetValueKind() == JsonValueKind.String && DateTime.TryParse(n.GetValue<string>(), null, System.Globalization.DateTimeStyles.RoundtripKind, out var t) ? t : DateTime.MinValue;

    /// <summary>Writes the whole file: first to a temporary file, then that one replaces the old file.</summary>
    public void Save()
    {
        var root = new JsonObject
        {
            ["nextProject"] = nextProject,
            ["nextWindow"] = nextWindow,
            ["projects"] = new JsonArray(Projects.Select(p => (JsonNode?)new JsonObject
            {
                ["id"] = p.Id, ["name"] = p.Name, ["used"] = p.Used.ToString("o"), ["created"] = p.Created?.ToString("o"),
                ["windows"] = new JsonArray(p.Windows.Select(w => (JsonNode?)new JsonObject
                {
                    ["key"] = w.Key, ["open"] = w.Open, ["session"] = w.Session?.DeepClone(),
                    ["bounds"] = w.Bounds is null ? null : new JsonArray(w.Bounds.Select(v => (JsonNode?)v).ToArray()),
                    ["maximized"] = w.Maximized, ["desktop"] = w.Desktop, ["used"] = w.Used.ToString("o"),
                }).ToArray()),
            }).ToArray()),
        };
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + ".tmp";
        File.WriteAllText(temp, root.ToJsonString());
        File.Move(temp, path, overwrite: true);
    }

    // ---------- Projects and windows ----------

    public static string Display(Project p) => p.Name.Length > 0 ? p.Name : $"Project {p.Id}";

    public Project NewProject(string name)
    {
        var now = DateTime.UtcNow;
        var p = new Project { Id = nextProject++, Name = name.Trim(), Used = now, Created = now };
        Projects.Add(p);
        return p;
    }

    /// <summary>A new, open window in the project.</summary>
    public Window AddWindow(Project p)
    {
        var w = new Window { Key = nextWindow++, Open = true, Used = DateTime.UtcNow };
        p.Windows.Add(w);
        return w;
    }

    public Project? ProjectOf(int key) => Projects.FirstOrDefault(p => p.Windows.Any(w => w.Key == key));
    public Window? WindowOf(int key) => Projects.SelectMany(p => p.Windows).FirstOrDefault(w => w.Key == key);
    public Project? Get(int id) => Projects.FirstOrDefault(p => p.Id == id);

    /// <summary>The layout a window opens with (3.2): its own; for a new window the one of the most recently used
    /// window of its project that has one; else null (the default layout).</summary>
    public JsonNode? LayoutOf(int key)
    {
        if (WindowOf(key)?.Session is JsonObject own) return own.DeepClone();
        return ProjectOf(key)?.Windows.Where(w => w.Key != key && w.Session is JsonObject)
            .OrderByDescending(w => w.Used).FirstOrDefault()?.Session!.DeepClone();
    }

    public void Touch(int key)
    {
        var now = DateTime.UtcNow;
        if (WindowOf(key) is { } w) w.Used = now;
        if (ProjectOf(key) is { } p) p.Used = now;
    }

    public void Rename(Project p, string name) => p.Name = name.Trim();

    /// <summary>Deletes a project without open windows.</summary>
    public bool Delete(Project p)
    {
        if (p.Windows.Any(w => w.Open)) return false;
        Projects.Remove(p);
        return true;
    }

    /// <summary>A window closed by hand while Foldex goes on, or the last one. Another open window of its project:
    /// this window is forgotten. The last open window of its project: the project is closed and keeps this window
    /// for when it is opened again. Then the rule for unnamed projects (DropIfUnwanted).</summary>
    public void CloseByHand(int key)
    {
        if (ProjectOf(key) is not { } p || WindowOf(key) is not { } w) return;
        var others = p.Windows.Any(o => o != w && o.Open);
        if (others) p.Windows.Remove(w);
        else (w.Open, w.Used) = (false, DateTime.UtcNow);   // Used: when it closed (LastClosedOn)
        if (!others) DropIfUnwanted(p);
    }

    /// <summary>A window closed with its whole project (Manage projects > Close): kept also while other windows of
    /// the project are still open (they close next).</summary>
    public void CloseWithProject(int key)
    {
        if (ProjectOf(key) is not { } p || WindowOf(key) is not { } w) return;
        (w.Open, w.Used) = (false, DateTime.UtcNow);
        if (!p.Windows.Any(o => o.Open)) DropIfUnwanted(p);
    }

    /// <summary>Merges projects into one: their windows move to <paramref name="to"/>, which keeps its name; the
    /// projects left empty go.</summary>
    public void Merge(Project to, IEnumerable<Project> from)
    {
        foreach (var p in from.Where(p => p != to).ToList())
        {
            to.Windows.AddRange(p.Windows);
            p.Windows.Clear();
            Projects.Remove(p);
        }
        to.Used = DateTime.UtcNow;
    }

    /// <summary>Forgets a window (a new one that became another project's, 3.5); its project per DropIfUnwanted.</summary>
    public void Forget(int key)
    {
        if (ProjectOf(key) is not { } p || WindowOf(key) is not { } w) return;
        p.Windows.Remove(w);
        DropIfUnwanted(p);
    }

    /// <summary>Moves the window to another project; the old project, left without open windows: per DropIfUnwanted.</summary>
    public void MoveWindow(int key, Project to)
    {
        if (ProjectOf(key) is not { } from || from == to || WindowOf(key) is not { } w) return;
        from.Windows.Remove(w);
        to.Windows.Add(w);
        to.Used = DateTime.UtcNow;
        if (!from.Windows.Any(o => o.Open)) DropIfUnwanted(from);
    }

    // The desktop a closed project was closed on: that of its window closed last.
    static string? ClosedOn(Project p) => p.Windows.MaxBy(w => w.Used)?.Desktop;

    static bool Closed(Project p) => !p.Windows.Any(w => w.Open);

    /// <summary>A project without open windows (3.4): a named one stays. An unnamed one without windows goes; with
    /// windows it is kept as the last closed unnamed project of its desktop, and an older closed unnamed project of
    /// that desktop goes.</summary>
    public void DropIfUnwanted(Project p)
    {
        if (p.Name.Length > 0 || !Closed(p)) return;
        if (p.Windows.Count == 0)
        {
            Projects.Remove(p);
            return;
        }
        var desktop = ClosedOn(p);
        Projects.RemoveAll(o => o != p && o.Name.Length == 0 && Closed(o) && ClosedOn(o) == desktop);
    }

    /// <summary>The project whose window was closed last on this virtual desktop (its windows all closed): what a
    /// launch on a desktop without a Foldex window opens again. Null when there is none, or the desktop is unknown.</summary>
    public Project? LastClosedOn(string? desktop) =>
        desktop is null ? null : Projects
            .Where(Closed)
            .SelectMany(p => p.Windows.Where(w => w.Desktop == desktop).Select(w => (Project: p, Window: w)))
            .OrderByDescending(o => o.Window.Used).Select(o => o.Project).FirstOrDefault();

    /// <summary>At start: the windows that were open (Windows closing Foldex, or a crash), to open again (3.4).</summary>
    public List<(Project Project, Window Window)> StartWindows() =>
        Projects.SelectMany(p => p.Windows.Where(w => w.Open).Select(w => (Project: p, Window: w))).OrderBy(o => o.Window.Key).ToList();
}
