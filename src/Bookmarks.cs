using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>One bookmark (docs/plans/executed/26-PLAN-bookmarks.md 3.1): a folder or an item (a file), with what it was given.
/// Only Location is always there; Name and Icon null when not set, Key and KeyNew null without a key.</summary>
sealed class Bookmark
{
    public string Location = "";
    public bool Item, QuickAccess, Root;
    public string? Name, Icon, Key, KeyNew;

    public Bookmark Copy() => (Bookmark)MemberwiseClone();

    /// <summary>As bookmarks.json writes it: only what is set.</summary>
    public JsonObject ToJson()
    {
        var o = new JsonObject { ["location"] = Location };
        if (Item) o["item"] = true;
        if (QuickAccess) o["quickAccess"] = true;
        if (!string.IsNullOrEmpty(Name)) o["name"] = Name;
        if (!string.IsNullOrEmpty(Icon)) o["icon"] = Icon;
        if (!string.IsNullOrEmpty(Key)) o["key"] = Key;
        if (!string.IsNullOrEmpty(KeyNew)) o["keyNew"] = KeyNew;
        if (Root) o["root"] = true;
        return o;
    }

    /// <summary>An entry of bookmarks.json (or of the page); a plain string is a location. Null without a location.</summary>
    public static Bookmark? From(JsonNode? n)
    {
        if (n is JsonValue v && v.TryGetValue<string>(out var s)) return string.IsNullOrWhiteSpace(s) ? null : new() { Location = s };
        if (n is not JsonObject o || o["location"]?.GetValue<string>() is not { } location || string.IsNullOrWhiteSpace(location)) return null;
        string? Text(string key) => o[key] is JsonValue t && t.TryGetValue<string>(out var x) && x.Length > 0 ? x : null;
        bool Flag(string key) => o[key] is JsonValue t && t.TryGetValue<bool>(out var x) && x;
        return new()
        {
            Location = location, Item = Flag("item"), QuickAccess = Flag("quickAccess"), Root = Flag("root"),
            Name = Text("name"), Icon = Text("icon"), Key = Text("key"), KeyNew = Text("keyNew"),
        };
    }
}

/// <summary>
/// The bookmarks (docs/plans/executed/26-PLAN-bookmarks.md 3.1): one list in your order, bookmarks.json in Foldex's data folder,
/// for every project and window; the ones with QuickAccess are the shortcuts of a tree's Quick access area, the others
/// the Bookmarks menu. Written whole through a temporary file; a file that cannot be read counts as empty. A location
/// that comes twice (any case, or a known folder by its shell name and by its path) is kept once. Known folders are
/// kept by their shell names (shell:Downloads), so a moved Documents folder is still found.
/// </summary>
static class Bookmarks
{
    public const string FileName = "bookmarks.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>The list as kept; null when bookmarks.json is not there yet (Start makes it).</summary>
    public static List<Bookmark>? Load(string dataDir)
    {
        var path = Path.Combine(dataDir, FileName);
        if (!File.Exists(path)) return null;
        try
        {
            var root = JsonNode.Parse(File.ReadAllText(path), documentOptions: Options);
            return Unique(root?["bookmarks"]?.AsArray().Select(Bookmark.From).OfType<Bookmark>() ?? []);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
        {
            return [];
        }
    }

    /// <summary>The first list, when bookmarks.json is not there yet: plan 23's quickaccess.json (each a quick access
    /// shortcut), then its favourite-folders.json (a folder in both stays one shortcut); neither there either: Explorer's
    /// pinned folders (`pinned`, asked only then), as shortcuts. Not written here.</summary>
    public static List<Bookmark> Start(string dataDir, Func<List<string>> pinned)
    {
        var quick = OldList(dataDir, "quickaccess.json");
        var favourites = OldList(dataDir, "favourite-folders.json");
        if (quick is null && favourites is null) quick = pinned();
        return Unique((quick ?? []).Select(f => new Bookmark { Location = f, QuickAccess = true })
            .Concat((favourites ?? []).Select(f => new Bookmark { Location = f })));
    }

    // A list of plan 23 ({ "folders": [paths] }); null when its file is not there.
    static List<string>? OldList(string dataDir, string name)
    {
        var path = Path.Combine(dataDir, name);
        if (!File.Exists(path)) return null;
        try
        {
            var root = JsonNode.Parse(File.ReadAllText(path), documentOptions: Options);
            return root?["folders"]?.AsArray().Select(n => n?.GetValue<string>() ?? "").ToList() ?? [];
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
        {
            return [];
        }
    }

    public static List<Bookmark> Save(string dataDir, IEnumerable<Bookmark> bookmarks)
    {
        var list = Unique(bookmarks);
        var path = Path.Combine(dataDir, FileName);
        Directory.CreateDirectory(dataDir);
        var json = new JsonObject { ["bookmarks"] = new JsonArray(list.Select(b => (JsonNode)b.ToJson()).ToArray()) };
        File.WriteAllText(path + ".tmp", "// Bookmarks and quick access (docs/plans/executed/26-PLAN-bookmarks.md). Written by Foldex.\n" +
            json.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        File.Move(path + ".tmp", path, true);
        return list;
    }

    /// <summary>Each location once, the first place kept; a name that is empty or the location's own name dropped.</summary>
    public static List<Bookmark> Unique(IEnumerable<Bookmark> bookmarks)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var list = new List<Bookmark>();
        foreach (var b in bookmarks)
        {
            if (string.IsNullOrWhiteSpace(b.Location) || !seen.Add(Resolve(b.Location).TrimEnd('\\'))) continue;
            var c = b.Copy();
            if (string.IsNullOrWhiteSpace(c.Name) || c.Name == OwnName(c.Location)) c.Name = null;
            list.Add(c);
        }
        return list;
    }

    /// <summary>A location's own name: the last part of its path (a known folder's where it is now).</summary>
    public static string OwnName(string location)
    {
        var path = Resolve(location).TrimEnd('\\');
        var at = path.LastIndexOf('\\');
        return at >= 0 && at < path.Length - 1 ? path[(at + 1)..] : path;
    }

    /// <summary>Whether two locations are the same one (a known folder's shell name and its path too).</summary>
    public static bool Same(string a, string b) =>
        string.Equals(Resolve(a).TrimEnd('\\'), Resolve(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);

    /// <summary>A location put into the Quick access area at `at` (counted among its shortcuts; past the last: after
    /// it): a new entry with QuickAccess, or the one there already, given the flag and moved there. The bookmarks of
    /// the menu keep their places.</summary>
    public static List<Bookmark> ToQuickAccess(List<Bookmark> list, string location, bool item, int at)
    {
        var known = list.FirstOrDefault(b => Same(b.Location, location));
        var entry = known?.Copy() ?? new Bookmark { Location = Known(location), Item = item };
        entry.QuickAccess = true;
        var rest = list.Where(b => b != known).ToList();
        var shortcuts = rest.Where(b => b.QuickAccess).ToList();
        // Its place counted among the shortcuts as they were: one moved down lands where it was dropped.
        var before = list.Where(b => b.QuickAccess).Take(Math.Max(0, at)).Count(b => b != known);
        var index = before < shortcuts.Count ? rest.IndexOf(shortcuts[before])
            : shortcuts.Count > 0 ? rest.IndexOf(shortcuts[^1]) + 1
            : known is not null ? list.IndexOf(known) : rest.Count;
        rest.Insert(Math.Clamp(index, 0, rest.Count), entry);
        return rest;
    }

    /// <summary>A location added at the end (a quick access shortcut or a bookmark of the menu); one there already
    /// only gets the flag when added to quick access, else stays as it is.</summary>
    public static List<Bookmark> Add(List<Bookmark> list, string location, bool item, bool quickAccess)
    {
        if (list.FirstOrDefault(b => Same(b.Location, location)) is { } known)
        {
            if (!quickAccess || known.QuickAccess) return list;
            return list.Select(b => b == known ? WithFlag(b) : b).ToList();
        }
        return [.. list, new Bookmark { Location = Known(location), Item = item, QuickAccess = quickAccess }];
    }

    static Bookmark WithFlag(Bookmark b)
    {
        var c = b.Copy();
        c.QuickAccess = true;
        return c;
    }

    // The known folders by their shell names; their paths asked of Windows (they can be moved, to OneDrive for one).
    static readonly (string Shell, Guid Id)[] KnownFolders =
    [
        ("shell:Desktop", new("B4BFCC3A-DB2C-424C-B029-7FE99A87C641")),
        ("shell:Downloads", new("374DE290-123F-4565-9164-39C4925E467B")),
        ("shell:Personal", new("FDD39AD0-238F-46AF-ADB4-6C85480369C7")),
        ("shell:My Pictures", new("33E28130-4E1E-4676-835A-98395C3BC3BB")),
        ("shell:My Music", new("4BD8D571-6D19-48D3-BE97-422220080E43")),
        ("shell:My Video", new("18989B1D-99B5-455B-841C-AB7C74E4DDFC")),
    ];

    [DllImport("shell32.dll")]
    static extern int SHGetKnownFolderPath(ref Guid id, uint flags, IntPtr token, out IntPtr path);

    static string? KnownPath(Guid id)
    {
        if (SHGetKnownFolderPath(ref id, 0, IntPtr.Zero, out var p) < 0) return null;
        try { return Marshal.PtrToStringUni(p); }
        finally { Marshal.FreeCoTaskMem(p); }
    }

    /// <summary>A known folder's shell name to its path; anything else as it is.</summary>
    public static string Resolve(string folder)
    {
        foreach (var (shell, id) in KnownFolders)
            if (string.Equals(folder, shell, StringComparison.OrdinalIgnoreCase)) return KnownPath(id) ?? folder;
        return folder;
    }

    /// <summary>A path that is a known folder by its shell name; anything else as it is.</summary>
    public static string Known(string folder)
    {
        foreach (var (shell, id) in KnownFolders)
            if (KnownPath(id) is { } path && string.Equals(path.TrimEnd('\\'), folder.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)) return shell;
        return folder;
    }

    /// <summary>Explorer's pinned Quick access folders, in its order (its Home folder's items with System.Home.IsPinned;
    /// pinned files and the folders Windows adds as frequent left out). Run on an STA thread.</summary>
    public static List<string> ExplorerPinned()
    {
        var list = new List<string>();
        try
        {
            var type = Type.GetTypeFromProgID("Shell.Application");
            if (type is null) return list;
            dynamic shell = Activator.CreateInstance(type)!;
            dynamic? home = shell.Namespace("shell:::{679f85cb-0220-4080-b29b-5540cc05aab6}");
            if (home is null) return list;
            foreach (dynamic item in home.Items())
            {
                if (!(bool)item.IsFolder) continue;
                object pinned = item.ExtendedProperty("System.Home.IsPinned");
                string path = item.Path;
                if (pinned is true && !string.IsNullOrEmpty(path) && !path.StartsWith("::")) list.Add(Known(path));
            }
        }
        catch (Exception ex) when (ex is COMException or InvalidCastException or Microsoft.CSharp.RuntimeBinder.RuntimeBinderException) { }
        return list;
    }
}
