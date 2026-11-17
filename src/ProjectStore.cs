using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Projects (docs/plans/executed/15-PLAN-projects.md 3.1, as LexPen's ProjectStore): a project has a number, a name you can give
/// it and one window (kept as a list of windows, as LexPen's file has it); the window keeps its session (the page's
/// layout: panes, docks, the active pane), its place and its virtual desktop. Kept in State\projects.json, written whole and atomically (a crash never leaves a broken file).
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

    /// <summary>A new project with a copy of another's windows (their layouts, places and sizes), closed.</summary>
    public Project Clone(Project from, string name)
    {
        var p = NewProject(name);
        foreach (var w in from.Windows)
            p.Windows.Add(new Window
            {
                Key = nextWindow++, Open = false, Session = w.Session?.DeepClone(), Bounds = w.Bounds?.ToArray(),
                Maximized = w.Maximized, Desktop = w.Desktop, Used = p.Used,
            });
        return p;
    }

    public Project? ProjectOf(int key) => Projects.FirstOrDefault(p => p.Windows.Any(w => w.Key == key));
    public Window? WindowOf(int key) => Projects.SelectMany(p => p.Windows).FirstOrDefault(w => w.Key == key);
    public Project? Get(int id) => Projects.FirstOrDefault(p => p.Id == id);

    /// <summary>The layout a window opens with (3.2): its own; null for a new one (the default layout).</summary>
    public JsonNode? LayoutOf(int key) => WindowOf(key)?.Session is JsonObject own ? own.DeepClone() : null;

    /// <summary>A session's panes as a tree (3.6): the roots in their order, each followed by its children (a level
    /// deeper), down to the end; per pane its name as its head shows it (the page keeps them in "names"; from before
    /// that, as the page makes them: Folders, Preview, a list's folder) and its folder (a list's location, a tree's
    /// focus; null for none).</summary>
    public static List<(int Depth, string Id, string Name, string? Folder)> PaneTree(JsonNode? session)
    {
        var panes = session?["panes"]?["panes"]?.AsArray().OfType<JsonObject>().ToList() ?? [];
        var names = session?["names"] as JsonObject;
        var tree = new List<(int, string, string, string?)>();
        var seen = new HashSet<string>();
        void Add(JsonObject pane, int depth)
        {
            var id = pane["id"]?.ToString() ?? "";
            if (!seen.Add(id)) return;   // a cycle in a broken file
            var folder = FolderOf(pane);
            var name = names?[id]?.GetValueKind() == JsonValueKind.String ? names[id]!.GetValue<string>()
                : pane["kind"]?.ToString() switch
                {
                    "tree" => "Folders",
                    "preview" => "Preview",
                    _ => folder?.Split('\\', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "Files",
                };
            tree.Add((depth, id, name, folder));
            foreach (var child in panes.Where(c => c["source"]?.ToString() == id)) Add(child, depth + 1);
        }
        foreach (var root in panes.Where(p => p["source"] is null)) Add(root, 0);
        return tree;
    }

    // What a pane shows: the state of the branch it showed last (else its first), a list's location or a tree's focus.
    static string? FolderOf(JsonObject pane)
    {
        var states = pane["states"] as JsonObject;
        var state = states?[pane["lastKey"]?.ToString() ?? ""] ?? states?.Select(s => s.Value).FirstOrDefault();
        var folder = state?["location"] ?? state?["focus"];
        return folder?.GetValueKind() == JsonValueKind.String ? folder.GetValue<string>() : null;
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

    /// <summary>A window closed by hand (or from Manage projects): its project is closed and keeps the window for when
    /// it is opened again. Then the rule for unnamed projects (DropIfUnwanted).</summary>
    public void CloseByHand(int key)
    {
        if (ProjectOf(key) is not { } p || WindowOf(key) is not { } w) return;
        (w.Open, w.Used) = (false, DateTime.UtcNow);   // Used: when it closed (LastClosedOn)
        DropIfUnwanted(p);
    }

    /// <summary>Forgets a window (a new one that became another project's, 3.5); its project per DropIfUnwanted.</summary>
    public void Forget(int key)
    {
        if (ProjectOf(key) is not { } p || WindowOf(key) is not { } w) return;
        p.Windows.Remove(w);
        DropIfUnwanted(p);
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
