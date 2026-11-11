using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// The Git status column (docs/plans/executed/11-PLAN-columns.md 3.1), from LexPen's git status code: per item of a folder its
/// status in the working tree it is in. A file: M (modified), A (added), D (deleted), R (renamed), U (untracked),
/// I (ignored) or ! (a conflict); a folder: the strongest status of what is under it (a conflict, then a change, then
/// untracked, then ignored). Null outside a working tree or without git.
/// </summary>
static class GitStatus
{
    /// <summary>{ name: status } for the items of `folder` that have one.</summary>
    public static JsonObject? Of(string folder)
    {
        var top = Git(folder, "rev-parse", "--show-toplevel")?.Trim();
        if (top is null) return null;
        var output = Git(folder, "status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignored", "--", ".");
        if (output is null) return null;
        var here = Path.GetFullPath(folder).TrimEnd('\\') + "\\";
        var result = new JsonObject();
        var entries = output.Split('\0');
        for (var i = 0; i < entries.Length; i++)
        {
            var entry = entries[i];   // "XY path": X = staged, Y = working tree
            if (entry.Length < 4) continue;
            var (x, y) = (entry[0], entry[1]);
            if (x is 'R' or 'C') i++;   // followed by the original path
            var status = Code(x, y);
            var path = Path.GetFullPath(Path.Combine(top, entry[3..].TrimEnd('/')));
            if (!path.StartsWith(here, StringComparison.OrdinalIgnoreCase)) continue;
            // The item of this folder the path is in: the path itself, or the folder it lies under.
            var rest = path[here.Length..];
            var cut = rest.IndexOf('\\');
            var name = cut < 0 ? rest : rest[..cut];
            var under = cut >= 0 || entry.EndsWith('/');
            var shown = under && status is not ('U' or 'I') ? 'M' : status;
            if (result[name]?.GetValue<string>() is { } was && Rank(was[0]) >= Rank(shown)) continue;
            result[name] = shown.ToString();
        }
        return result;
    }

    static char Code(char x, char y) =>
        x == '?' ? 'U'
        : x == '!' ? 'I'
        : x == 'U' || y == 'U' || (x == y && x is 'A' or 'D') ? '!'
        : x == 'D' || y == 'D' ? 'D'
        : x == 'A' ? 'A'
        : x is 'R' or 'C' ? 'R'
        : 'M';

    // Which status a folder shows when several are under it.
    static int Rank(char status) => status switch { '!' => 4, 'I' => 1, 'U' => 2, _ => 3 };

    static string? Git(string folder, params string[] args)
    {
        var start = new ProcessStartInfo("git")
        {
            WorkingDirectory = folder,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            CreateNoWindow = true,
            UseShellExecute = false,
        };
        // Otherwise status rewrites the index, which the folder watcher reports, which asks for the status again.
        start.Environment["GIT_OPTIONAL_LOCKS"] = "0";
        foreach (var arg in args) start.ArgumentList.Add(arg);
        try
        {
            using var git = Process.Start(start)!;
            _ = git.StandardError.ReadToEndAsync();
            var output = git.StandardOutput.ReadToEnd();
            git.WaitForExit();
            return git.ExitCode == 0 ? output : null;
        }
        catch (Win32Exception) { return null; }   // git not installed
    }
}
