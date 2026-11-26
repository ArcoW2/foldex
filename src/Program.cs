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
        var (profileArg, afterProfile) = ParseProfile(args);
        var (newWindow, rest) = ParseArgs(afterProfile);
        var shift = newWindow || (Control.ModifierKeys & Keys.Shift) != 0;
        var paths = rest.Select(FullName).ToArray();

        // The profile (docs/plans/executed/41-PLAN-profiles.md 3.2): --profile <name or number>, else Default. Set for AppHost
        // (and the helpers it starts) before anything reads its data folder.
        var top = DataFolder.Resolve(Environment.GetEnvironmentVariable("FOLDEX_DATA"), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
        var profilesPath = DataFolder.ProfilesPath(top);
        var store = ProfileStore.Load(profilesPath);
        var profile = ProfileStore.Default;
        if (profileArg is not null)
        {
            if (store.Find(profileArg) is not { } named)
            {
                AskForm.Tell(null, null, AskForm.Sign.Error, $"There is no profile \"{profileArg}\".");
                return;
            }
            profile = named.Number;
        }
        Environment.SetEnvironmentVariable(AppHost.ProfileVariable, profile.ToString(System.Globalization.CultureInfo.InvariantCulture));

        // One instance per user, exe and profile: a debug build and the published one do not meet.
        var name = ProfileProcesses.Name(profile);

        using var mutex = new Mutex(true, @"Local\" + name, out var owner);
        if (!owner)
        {
            if (Send(name, Launch(paths, shift))) return;
            // The running instance is closing: wait for it, then take over.
            try { owner = mutex.WaitOne(TimeSpan.FromSeconds(5)); }
            catch (AbandonedMutexException) { owner = true; }
        }

        // A profile with a password asks it before any window (3.4); Cancel: it stays closed.
        if (store.Get(profile) is { Locked: true } locked && !ProfileProcesses.AskToOpen(locked))
        {
            if (owner) mutex.ReleaseMutex();
            return;
        }

        // Foldex started while no profile runs (3.3): the profiles open at the last end come back, each in its own
        // process; Default shows its own window only when it was open too, nothing else comes back, or it was given
        // something to show.
        if (owner && profileArg is null && !store.Listed.Any(p => p.Number != profile && ProfileProcesses.Running(p.Number)))
        {
            foreach (var p in store.StartProfiles()) ProfileProcesses.Start(p.Number);
            if (!store.DefaultAtStart() && paths.Length == 0)
            {
                mutex.ReleaseMutex();
                return;
            }
        }
        ProfileStore.Change(profilesPath, s =>
        {
            if (s.Get(profile) is { } me) (me.WasOpen, me.Opened) = (true, DateTime.Now);
        });

        var app = new AppHost();
        app.Launch(paths, shift);
        if (owner) app.Listen(name);
        Application.Run(app);
        if (owner) mutex.ReleaseMutex();
    }

    /// <summary>"--profile &lt;name or number&gt;" taken out (docs/plans/executed/41-PLAN-profiles.md 3.3): the profile (null: none
    /// given, Default) and the other arguments.</summary>
    internal static (string? Profile, string[] Others) ParseProfile(string[] args)
    {
        var at = Array.FindIndex(args, a => a == "--profile");
        if (at < 0 || at + 1 >= args.Length) return (null, at < 0 ? args : args[..at]);
        return (args[at + 1], [.. args[..at], .. args[(at + 2)..]]);
    }

    static JsonObject Launch(string[] paths, bool shift) => new()
    {
        ["paths"] = new JsonArray(paths.Select(p => (JsonNode?)p).ToArray()),
        ["shift"] = shift,
    };
    /// <summary>The name of the instance's mutex and pipe: per user, exe and profile; Default's is the name Foldex had
    /// before profiles.</summary>
    internal static string PipeName(string exe, string? user, int profile = ProfileStore.Default)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(exe.ToLowerInvariant())))[..16];
        return profile == ProfileStore.Default ? $"Foldex-{user}-{hash}" : $"Foldex-{user}-{hash}-p{profile}";
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

    // Hands a message (the paths of a launch, or a profile's command) to the running instance; false when it does not
    // answer.
    internal static bool Send(string name, JsonObject msg)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.CurrentUserOnly);
            client.Connect(3000);
            AllowSetForegroundWindow(-1);   // ASFW_ANY: let the running instance bring its window to the front
            client.Write(Encoding.UTF8.GetBytes(msg.ToJsonString() + "\n"));
            using var reader = new StreamReader(client);
            return reader.ReadLine() == "ok";
        }
        catch (Exception ex) when (ex is TimeoutException or IOException) { return false; }
    }
    [DllImport("user32.dll")]
    static extern bool AllowSetForegroundWindow(int processId);
}
