using System.Collections.Concurrent;
using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// Nothing in Foldex waits on a network share (docs/plans/executed/24-PLAN-folder-cache.md 3.8). A path on a share (a UNC path or
/// a mapped drive; telling that touches no network) is checked before the window's thread does anything with it: the
/// check runs on a worker with a time limit. A share that does not answer within it is marked unreachable (per server)
/// and is not tried again for a while; then one quick check, on a worker, tells whether it is back.
/// </summary>
static class NetworkGuard
{
    /// <summary>How long a share may take to answer before it counts as down. A share that answers took 17 ms here (165
    /// ms the first time, by its IP address; loopback, no real network share measured); one that does not answer kept
    /// Windows waiting 21.6 s.</summary>
    public static int LimitMs { get; set; } = 2000;

    /// <summary>How long a share found down is left alone before it is tried again.</summary>
    public static TimeSpan RetryAfter { get; set; } = TimeSpan.FromSeconds(30);

    static readonly ConcurrentDictionary<string, DateTime> down = new(StringComparer.OrdinalIgnoreCase);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern uint GetDriveType(string root);

    const uint DriveRemote = 4;

    /// <summary>Whether a path is on a network share: a UNC path, or a drive letter Windows has as a network drive.</summary>
    public static bool IsNetwork(string? path)
    {
        if (string.IsNullOrEmpty(path)) return false;
        if (path.StartsWith(@"\\?\")) return false;
        if (path.StartsWith(@"\\")) return true;
        return path.Length >= 2 && path[1] == ':' && GetDriveType(path[..2] + @"\") == DriveRemote;
    }

    /// <summary>The server of a network path (\\server, or the mapped drive's letter).</summary>
    public static string Server(string path) => path.StartsWith(@"\\") ? @"\\" + path[2..].Split('\\')[0] : path[..2];

    /// <summary>The share's root (\\server\share, or the mapped drive's root): what a check reads.</summary>
    static string Root(string path)
    {
        if (!path.StartsWith(@"\\")) return path[..2] + @"\";
        var parts = path[2..].Split('\\');
        return parts.Length >= 2 ? $@"\\{parts[0]}\{parts[1]}" : $@"\\{parts[0]}";
    }

    /// <summary>When a server was found down (null: not marked).</summary>
    public static DateTime? DownSince(string path) => IsNetwork(path) && down.TryGetValue(Server(path), out var since) ? since : null;

    /// <summary>Whether a path can be used now without waiting: not on a share, or its share answers within the limit. A
    /// share marked down answers false at once until RetryAfter has passed. Never blocks the caller's thread.</summary>
    public static async Task<bool> Reachable(string? path)
    {
        if (!IsNetwork(path)) return true;
        var server = Server(path!);
        if (down.TryGetValue(server, out var since) && DateTime.UtcNow - since < RetryAfter) return false;
        var root = Root(path!);
        var check = Task.Run(() => { try { return Directory.Exists(root); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return true; } });
        if (await Task.WhenAny(check, Task.Delay(LimitMs)) == check && check.Result)
        {
            down.TryRemove(server, out _);
            return true;
        }
        down[server] = DateTime.UtcNow;
        return false;
    }

    /// <summary>Whether every path can be used now (Reachable for each of their servers once).</summary>
    public static async Task<bool> Reachable(IEnumerable<string> paths)
    {
        foreach (var server in paths.Where(IsNetwork).GroupBy(Server, StringComparer.OrdinalIgnoreCase))
            if (!await Reachable(server.First())) return false;
        return true;
    }
}
