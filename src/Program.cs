using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json.Nodes;

namespace Foldex;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // The elevated helper (docs/plans/executed/05-PLAN-elevation.md 3.3): no window, no instance of its own.
        if (args.Length == 3 && args[0] == ElevatedHelper.Switch && int.TryParse(args[2], out var parent))
        {
            ElevatedHelper.Run(args[1], parent);
            return;
        }
        // The plugin helper (docs/plans/executed/33-PLAN-preview-plugins.md 3.2): the lister plugins' windows, unelevated.
        if (args.Length == 3 && args[0] == ListerHelper.Switch && int.TryParse(args[2], out var foldex))
        {
            ListerHelper.Run(args[1], foldex);
            return;
        }
        ApplicationConfiguration.Initialize();
        var (newWindow, rest) = ParseArgs(args);
        var shift = newWindow || (Control.ModifierKeys & Keys.Shift) != 0;
        var paths = rest.Select(FullName).ToArray();

        // One instance per user and exe: a debug build and the published one do not meet.
        var name = PipeName(Environment.ProcessPath ?? AppContext.BaseDirectory, WindowsIdentity.GetCurrent().User?.Value);

        using var mutex = new Mutex(true, @"Local\" + name, out var owner);
        if (!owner)
        {
            if (Send(name, paths, shift)) return;
            // The running instance is closing: wait for it, then take over.
            try { owner = mutex.WaitOne(TimeSpan.FromSeconds(5)); }
            catch (AbandonedMutexException) { owner = true; }
        }

        var app = new AppHost();
        app.Launch(paths, shift);
        if (owner) app.Listen(name);
        Application.Run(app);
        if (owner) mutex.ReleaseMutex();
    }

    /// <summary>The name of the instance's mutex and pipe: per user and per exe.</summary>
    internal static string PipeName(string exe, string? user)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(exe.ToLowerInvariant())))[..16];
        return $"Foldex-{user}-{hash}";
    }

    // "-n" or "--new-window": a new window, as with Shift held. Everything else is a folder (or file) to show.
    internal static (bool NewWindow, string[] Paths) ParseArgs(string[] args)
    {
        static bool IsNewWindow(string a) => a is "-n" or "--new-window";
        return (args.Any(IsNewWindow), args.Where(a => !IsNewWindow(a)).ToArray());
    }

    /// <summary>A path against this process's current folder; a shell name ("::{guid}", "shell:RecycleBinFolder") as it is.</summary>
    internal static string FullName(string arg) =>
        arg.StartsWith("::", StringComparison.Ordinal) || arg.StartsWith("shell:", StringComparison.OrdinalIgnoreCase) ? arg : Path.GetFullPath(arg);

    // Hands the paths to the running instance; false when it does not answer.
    static bool Send(string name, string[] paths, bool shift)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.CurrentUserOnly);
            client.Connect(3000);
            AllowSetForegroundWindow(-1);   // ASFW_ANY: let the running instance bring its window to the front
            var msg = new JsonObject
            {
                ["paths"] = new JsonArray(paths.Select(p => (JsonNode?)p).ToArray()),
                ["shift"] = shift,
            };
            client.Write(Encoding.UTF8.GetBytes(msg.ToJsonString() + "\n"));
            using var reader = new StreamReader(client);
            return reader.ReadLine() == "ok";
        }
        catch (Exception ex) when (ex is TimeoutException or IOException) { return false; }
    }

    [DllImport("user32.dll")]
    static extern bool AllowSetForegroundWindow(int processId);
}
