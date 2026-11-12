using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Quick access and favourite folders (docs/plans/executed/23-PLAN-quick-access-and-favourites.md 3.1): two lists of folders in
/// your order, quickaccess.json and favourite-folders.json in Foldex's data folder, for every project and window. Each
/// written whole through a temporary file; a file that cannot be read counts as empty. A folder that comes twice (any
/// case, or a known folder by its shell name and by its path) is kept once. Quick access holds the shell's known folders
/// by their own names (shell:Downloads), so a moved Documents folder is still found.
/// </summary>
static class FolderLists
{
    public const string QuickAccess = "quickaccess", Favourites = "favourites";

    static string FileName(string kind) => kind == QuickAccess ? "quickaccess.json" : "favourite-folders.json";

    static readonly JsonDocumentOptions Options = new() { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };

    /// <summary>A list as kept; null when its file is not there yet (quick access then starts from Explorer's).</summary>
    public static List<string>? Load(string dataDir, string kind)
    {
        var path = Path.Combine(dataDir, FileName(kind));
        if (!File.Exists(path)) return null;
        try
        {
            var root = JsonNode.Parse(File.ReadAllText(path), documentOptions: Options);
            return Unique(root?["folders"]?.AsArray().Select(n => n?.GetValue<string>() ?? "") ?? []);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
        {
            return [];
        }
    }

    public static List<string> Save(string dataDir, string kind, IEnumerable<string> folders)
    {
        var list = Unique(folders);
        var path = Path.Combine(dataDir, FileName(kind));
        Directory.CreateDirectory(dataDir);
        var json = new JsonObject { ["folders"] = new JsonArray(list.Select(f => (JsonNode)f).ToArray()) };
        File.WriteAllText(path + ".tmp", $"// {(kind == QuickAccess ? "Quick access" : "Favourite folders")} " +
            "(docs/plans/executed/23-PLAN-quick-access-and-favourites.md). Written by Foldex.\n" +
            json.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        File.Move(path + ".tmp", path, true);
        return list;
    }

    /// <summary>Each folder once, the first place kept; empty ones left out.</summary>
    public static List<string> Unique(IEnumerable<string> folders)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        return folders.Where(f => !string.IsNullOrWhiteSpace(f) && seen.Add(Resolve(f).TrimEnd('\\'))).ToList();
    }

    /// <summary>Whether two folders are the same one (a known folder's shell name and its path too).</summary>
    public static bool Same(string a, string b) =>
        string.Equals(Resolve(a).TrimEnd('\\'), Resolve(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);

    /// <summary>A list with a folder put in at `at` (the end when out of range), the same folder elsewhere taken out.</summary>
    public static List<string> Insert(List<string> list, string folder, int at)
    {
        var rest = list.Where(f => !Same(f, folder)).ToList();
        // Its place counted in the list as it was: a folder moved down lands where it was dropped.
        var before = list.Take(Math.Clamp(at, 0, list.Count)).Count(f => !Same(f, folder));
        rest.Insert(Math.Clamp(before, 0, rest.Count), Known(folder));
        return rest;
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
        return Unique(list);
    }
}
