using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>The drives for the drives bar (docs/plans/executed/10-PLAN-bars.md 3.2): per drive its root, letter, the name the
/// shell shows (Local Disk (C:)), and its size and free space when it is ready. Run on an STA thread (the names come
/// from the shell); a drive that is not ready (an empty card reader, a network drive away) has no sizes.</summary>
static class Drives
{
    /// <summary>The letters of the drives there are now, cheap enough to poll: "CDE".</summary>
    public static string Letters() => string.Concat(Environment.GetLogicalDrives().Select(d => d[0]));

    public static JsonArray List()
    {
        var list = new JsonArray();
        foreach (var drive in DriveInfo.GetDrives())
        {
            var root = drive.Name;
            var entry = new JsonObject
            {
                ["id"] = root,
                ["letter"] = root[..1],
                ["name"] = ShellListing.NameOf(root),
                ["type"] = drive.DriveType.ToString().ToLowerInvariant(),
            };
            try
            {
                if (drive.IsReady)
                {
                    entry["total"] = drive.TotalSize;
                    entry["free"] = drive.AvailableFreeSpace;
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
            list.Add(entry);
        }
        return list;
    }

    /// <summary>The free space (for the user: quotas count) and the size of the volume a folder is on, a share's too;
    /// null when Windows cannot say (no such folder, a place that is no folder on disk). Touches the volume: off the
    /// window's thread, a share checked first.</summary>
    public static (long Free, long Total)? Space(string folder) =>
        GetDiskFreeSpaceEx(folder.EndsWith('\\') ? folder : folder + '\\', out var free, out var total, out _) ? ((long)free, (long)total) : null;

    [System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
    [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
    static extern bool GetDiskFreeSpaceEx(string directory, out ulong freeForUser, out ulong total, out ulong totalFree);
}
