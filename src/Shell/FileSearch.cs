using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Foldex.Shell;

/// <summary>
/// Finding files and folders by name for a scrap (docs/plans/executed/06-PLAN-search-and-scrap.md 3.3, 3.4). With Use search
/// index an index answers where it can (Everything when it runs and has the folder, else the Windows Search index
/// where the folder is indexed); else, and for what no index can do (a fuzzy name), Foldex walks the folders itself.
/// Every candidate an index gives is tested by Foldex's own name test, so each engine finds the same. A search inside
/// a scrap tests only the scrap's entries. What is found is handed over in batches while it runs.
/// </summary>
static class FileSearch
{
    /// <summary>`TextPattern`: the Containing text as the page built it (plan 20 3.1; null: none), `TextCase`, `AllFiles`
    /// and `StartBytes` (only that much of each file read; 0: all of it).</summary>
    public sealed record Options(string? LookIn, IReadOnlyList<string>? Within, bool Subfolders, bool DepthFirst,
        bool UseIndex, bool Files, bool Folders, bool Regex, int Fuzzy, string Named,
        string? TextPattern = null, bool TextCase = false, bool AllFiles = false, long StartBytes = 0)
    {
        public static Options From(JsonObject m) => new(
            m["lookIn"]?.GetValue<string>(),
            m["within"] is JsonArray w ? w.Select(n => n!.GetValue<string>()).ToList() : null,
            m["subfolders"]?.GetValue<bool>() ?? true,
            m["depthFirst"]?.GetValue<bool>() ?? true,
            m["useIndex"]?.GetValue<bool>() ?? true,
            m["files"]?.GetValue<bool>() ?? true,
            m["folders"]?.GetValue<bool>() ?? true,
            m["regex"]?.GetValue<bool>() ?? false,
            Math.Clamp(m["fuzzy"]?.GetValue<int>() ?? 100, 0, 100),
            m["named"]?.GetValue<string>() ?? "",
            m["textPattern"]?.GetValue<string>() is { Length: > 0 } p ? p : null,
            m["textCase"]?.GetValue<bool>() ?? false,
            m["allFiles"]?.GetValue<bool>() ?? false,
            m["startOnly"]?.GetValue<bool>() == true ? Math.Max(1, m["startKB"]?.GetValue<long>() ?? 2048) * 1024 : 0);
    }

    /// <summary>The engine used (walk, everything, windows, scrap) and how many were found; throws ArgumentException for
    /// a regular expression that does not parse or a folder that is not there.</summary>
    public static (string Engine, int Count) Run(Options o, Action<JsonArray> batch, CancellationToken cancel)
    {
        var test = NameTest(o);
        var text = TextSearch.Make(o.TextPattern, o.TextCase);
        var found = 0;
        var pending = new JsonArray();
        var since = System.Diagnostics.Stopwatch.StartNew();
        // What was found goes over every 250 ms, also while candidates that do not match are tested (a text check can
        // take a while per file), so an item shows soon after it is found (plan 20 3.6).
        void Flush()
        {
            if (pending.Count == 0 || since.ElapsedMilliseconds < 250) return;
            batch(pending);
            pending = [];
            since.Restart();
        }
        void Found(FileSystemInfo info)
        {
            Flush();
            var folder = (info.Attributes & FileAttributes.Directory) != 0;
            if (!(folder ? o.Folders : o.Files) || !test(info.Name)) return;
            // A text: folders never hold one; a file is read last, as it is the slowest test (plan 20 3.1).
            if (text is not null && (folder || !TextSearch.Holds(info.FullName, text, o.AllFiles, o.StartBytes, cancel))) return;
            try { pending.Add(ShellListing.DiskEntry(info)); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return; }
            found++;
            Flush();
        }
        string engine;
        if (o.Within is not null)
        {
            engine = "scrap";
            foreach (var id in o.Within)
            {
                if (cancel.IsCancellationRequested) break;
                if (Path.IsPathFullyQualified(id) && Info(id) is { } info) Found(info);
            }
        }
        else
        {
            var root = o.LookIn ?? "";
            if (!Path.IsPathFullyQualified(root) || !Directory.Exists(root)) throw new ArgumentException($"{root}: no folder on disk to look in");
            engine = "walk";
            // A fuzzy name only Foldex's own test knows; for the rest an index gives the candidates.
            var indexed = o.UseIndex && (o.Regex || o.Fuzzy >= 100) ? Indexed(o, root, cancel) : null;
            if (indexed is not null)
            {
                engine = indexed.Value.Engine;
                foreach (var path in indexed.Value.Paths)
                {
                    if (cancel.IsCancellationRequested) break;
                    if (Info(path) is { } info) Found(info);
                }
            }
            else Walk(root, o.Subfolders, o.DepthFirst, Found, cancel);
        }
        batch(pending);
        return (engine, found);
    }

    static FileSystemInfo? Info(string path)
    {
        FileSystemInfo info = Directory.Exists(path) ? new DirectoryInfo(path) : new FileInfo(path);
        return info.Exists ? info : null;
    }

    static (string Engine, List<string> Paths)? Indexed(Options o, string root, CancellationToken cancel)
    {
        if (Everything.Search(o, root, cancel) is { } everything) return ("everything", everything);
        if (!o.Regex && WindowsSearch.Search(o, root) is { } windows) return ("windows", windows);
        return null;
    }

    // ---------- The name test ----------

    /// <summary>Named: empty finds everything; a regular expression (Regex) found anywhere in the name; else patterns
    /// separated by ';': one with * or ? the whole name, one without contained in the name, or (Fuzzy below 100) found
    /// in it at least that close (Similarity). Case never counts.</summary>
    public static Func<string, bool> NameTest(Options o)
    {
        var named = o.Named.Trim();
        if (named.Length == 0) return _ => true;
        if (o.Regex)
        {
            Regex re;
            try { re = new Regex(named, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1)); }
            catch (ArgumentException ex) { throw new ArgumentException($"the regular expression: {ex.Message}"); }
            return name =>
            {
                try { return re.IsMatch(name); }
                catch (RegexMatchTimeoutException) { return false; }
            };
        }
        var tests = Patterns(named).Select(p => Wild(p)
            ? (Func<string, bool>)new Regex(WildRegex(p), RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).IsMatch
            : o.Fuzzy < 100 ? name => Similarity(p, name) >= o.Fuzzy
            : name => name.Contains(p, StringComparison.OrdinalIgnoreCase)).ToList();
        return name => tests.Any(t => t(name));
    }

    internal static List<string> Patterns(string named) =>
        named.Split(';').Select(p => p.Trim()).Where(p => p.Length > 0).ToList();

    internal static bool Wild(string pattern) => pattern.IndexOfAny(['*', '?']) >= 0;

    internal static string WildRegex(string pattern) =>
        "^" + Regex.Escape(pattern).Replace(@"\*", ".*").Replace(@"\?", ".") + "$";

    /// <summary>How closely a pattern is found in a name, 0 to 100: 100 minus the share of the pattern's length that
    /// the fewest edits (a character added, left out or changed) take to make it a part of the name. 100: contained as
    /// it is.</summary>
    public static int Similarity(string pattern, string name)
    {
        var p = pattern.ToLowerInvariant();
        var t = name.ToLowerInvariant();
        if (p.Length == 0) return 100;
        // Edit distance with a free start and end in the name (Sellers): row i, column j.
        var row = new int[t.Length + 1];
        for (var i = 1; i <= p.Length; i++)
        {
            var diagonal = row[0];
            row[0] = i;
            for (var j = 1; j <= t.Length; j++)
            {
                var up = row[j];
                row[j] = Math.Min(Math.Min(up + 1, row[j - 1] + 1), diagonal + (p[i - 1] == t[j - 1] ? 0 : 1));
                diagonal = up;
            }
        }
        var best = row.Min();
        return Math.Max(0, 100 - (int)Math.Ceiling(best * 100.0 / p.Length));
    }

    // ---------- Foldex's own walk ----------

    static readonly EnumerationOptions Listing = new()
    {
        IgnoreInaccessible = true, AttributesToSkip = 0, RecurseSubdirectories = false, ReturnSpecialDirectories = false,
    };

    /// <summary>Every item below a folder: depth first (a folder's subfolders before the next folder at its level) or
    /// breadth first (level by level). A junction or symbolic link is found but not gone into (it may point up).</summary>
    internal static void Walk(string root, bool subfolders, bool depthFirst, Action<FileSystemInfo> found, CancellationToken cancel)
    {
        var pending = new LinkedList<string>();
        pending.AddFirst(root);
        while (pending.First is { } next && !cancel.IsCancellationRequested)
        {
            pending.RemoveFirst();
            var subs = new List<string>();
            try
            {
                foreach (var info in new DirectoryInfo(next.Value).EnumerateFileSystemInfos("*", Listing))
                {
                    if (cancel.IsCancellationRequested) return;
                    found(info);
                    if (subfolders && (info.Attributes & FileAttributes.Directory) != 0 && (info.Attributes & FileAttributes.ReparsePoint) == 0)
                        subs.Add(info.FullName);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { }
            if (depthFirst)
                for (var k = subs.Count - 1; k >= 0; k--) pending.AddFirst(subs[k]);
            else
                foreach (var s in subs) pending.AddLast(s);
        }
    }
}
