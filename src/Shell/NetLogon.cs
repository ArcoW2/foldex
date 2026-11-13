using System.Runtime.InteropServices;

namespace Foldex.Shell;

/// <summary>
/// A machine or share on the network that wants a user name and password (Windows answers "access denied"): told
/// apart from an empty one, and logged on to with Windows' own prompt, as Explorer does.
/// </summary>
static class NetLogon
{
    [DllImport("netapi32.dll", CharSet = CharSet.Unicode)]
    static extern int NetShareEnum(string server, int level, out IntPtr buffer, int max, out int read, out int total, ref int resume);

    [DllImport("netapi32.dll")]
    static extern int NetApiBufferFree(IntPtr buffer);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct NetResource
    {
        public int Scope, Type, DisplayType, Usage;
        public string? LocalName, RemoteName, Comment, Provider;
    }

    [DllImport("mpr.dll", CharSet = CharSet.Unicode)]
    static extern int WNetAddConnection3(IntPtr owner, ref NetResource resource, string? password, string? user, int flags);

    const int AccessDenied = 5, ResourceTypeDisk = 1, ResourceTypeAny = 0, ConnectInteractive = 0x08, ConnectPrompt = 0x10;

    /// <summary>Whether a machine (\\server) refuses to list its shares to you (a log-on needed).</summary>
    public static bool Denied(string server)
    {
        var resume = 0;
        var r = NetShareEnum(server.TrimEnd('\\'), 1, out var buffer, -1, out _, out _, ref resume);
        if (buffer != IntPtr.Zero) NetApiBufferFree(buffer);
        return r == AccessDenied;
    }

    /// <summary>Windows' log-on prompt for a machine (its IPC$) or a share, owned by `owner`. True when connected; false
    /// when cancelled or refused.</summary>
    public static bool LogOn(IntPtr owner, string path)
    {
        var parts = path[2..].TrimEnd('\\').Split('\\');
        var server = @"\\" + parts[0];
        var share = parts.Length >= 2 ? $@"{server}\{parts[1]}" : $@"{server}\IPC$";
        var resource = new NetResource { Type = parts.Length >= 2 ? ResourceTypeDisk : ResourceTypeAny, RemoteName = share };
        return WNetAddConnection3(owner, ref resource, null, null, ConnectInteractive | ConnectPrompt) == 0;
    }
}
