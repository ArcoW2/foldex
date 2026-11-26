using System.Diagnostics;
using System.Security.Principal;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Profiles as processes (docs/plans/executed/41-PLAN-profiles.md 3.2, 3.3, 3.6): each open profile is a Foldex process of its
/// own, known by its mutex and reached over its pipe (Program.PipeName). Starting one, telling one something, its
/// password asked, its folder copied or removed.
/// </summary>
static class ProfileProcesses
{
    static string Exe => Environment.ProcessPath ?? Application.ExecutablePath;
    static readonly string? User = WindowsIdentity.GetCurrent().User?.Value;

    /// <summary>The name of a profile's mutex and pipe.</summary>
    public static string Name(int profile) => Program.PipeName(Exe, User, profile);

    /// <summary>Whether the profile's process runs: its mutex exists while it does.</summary>
    public static bool Running(int profile)
    {
        if (!Mutex.TryOpenExisting(@"Local\" + Name(profile), out var m)) return false;
        m.Dispose();
        return true;
    }

    /// <summary>Starts the profile's process (it asks its password itself).</summary>
    public static void Start(int profile)
    {
        var info = new ProcessStartInfo(Exe) { UseShellExecute = false };
        info.ArgumentList.Add("--profile");
        info.ArgumentList.Add(profile.ToString(System.Globalization.CultureInfo.InvariantCulture));
        using var _ = Process.Start(info);
    }

    public static bool Send(int profile, JsonObject msg) => Program.Send(Name(profile), msg);

    /// <summary>Its window to the front when it runs, else it is started.</summary>
    public static void Show(int profile)
    {
        if (!Running(profile) || !Send(profile, new JsonObject { ["paths"] = new JsonArray(), ["shift"] = false })) Start(profile);
    }

    /// <summary>Waits until the profile's process has ended; false when it still runs after `seconds`.</summary>
    public static async Task<bool> Ended(int profile, int seconds = 60)
    {
        for (var i = 0; i < seconds * 4; i++)
        {
            if (!Running(profile)) return true;
            await Task.Delay(250);
        }
        return !Running(profile);
    }

    // ---------- The password (3.4) ----------

    /// <summary>At start, before any window: the password of the profile, asked until it is right; false for Cancel.</summary>
    public static bool AskToOpen(ProfileStore.Profile p) =>
        Ask(null, null, p, $"Open profile {p.Name}", "This profile has a password.", "Open");

    /// <summary>The profile's password, asked over `owner` until it is right; false for Cancel.</summary>
    public static bool Unlock(AppHost app, IWin32Window? owner, ProfileStore.Profile p, string why) =>
        !p.Locked || Ask(app, owner, p, $"Profile {p.Name}", why, "OK");

    static bool Ask(AppHost? app, IWin32Window? owner, ProfileStore.Profile p, string heading, string text, string ok)
    {
        while (true)
        {
            var (answer, typed) = AskForm.AskSecret(app, owner, new AskForm.Question
            {
                Heading = heading, Text = text + " Password:", Secret = true,
                Buttons = [("ok", ok, null), (null, "Cancel", null)],
            });
            if (answer is null) return false;
            if (ProfileStore.Check(p, typed)) return true;
            AskForm.Tell(app, owner, AskForm.Sign.Error, "That is not the password.");
        }
    }

    /// <summary>A new password, typed twice; null for Cancel.</summary>
    public static string? AskNew(AppHost app, IWin32Window? owner, ProfileStore.Profile p)
    {
        while (true)
        {
            var (answer, first) = AskForm.AskSecret(app, owner, new AskForm.Question
            {
                Heading = $"Profile {p.Name}", Text = "The new password:", Secret = true,
                Buttons = [("ok", "OK", null), (null, "Cancel", null)],
            });
            if (answer is null) return null;
            if (first.Length == 0)
            {
                AskForm.Tell(app, owner, AskForm.Sign.Error, "A password cannot be empty. Remove password takes it away.");
                continue;
            }
            var (again, second) = AskForm.AskSecret(app, owner, new AskForm.Question
            {
                Heading = $"Profile {p.Name}", Text = "The new password again:", Secret = true,
                Buttons = [("ok", "OK", null), (null, "Cancel", null)],
            });
            if (again is null) return null;
            if (first == second) return first;
            AskForm.Tell(app, owner, AskForm.Sign.Error, "The two passwords are not the same.");
        }
    }

    // ---------- The folder (3.6) ----------

    /// <summary>A copy of a profile's folder for a new one: everything but its State\ (projects, caches, WebView2 data)
    /// and, for Default, the other profiles' folders.</summary>
    public static void CopyFolder(string from, string to)
    {
        Directory.CreateDirectory(to);
        foreach (var dir in Directory.GetDirectories(from))
        {
            var name = Path.GetFileName(dir);
            if (name.Equals(DataFolder.StateName, StringComparison.OrdinalIgnoreCase) || name.Equals(DataFolder.ProfilesName, StringComparison.OrdinalIgnoreCase)) continue;
            CopyAll(dir, Path.Combine(to, name));
        }
        foreach (var file in Directory.GetFiles(from)) File.Copy(file, Path.Combine(to, Path.GetFileName(file)), overwrite: true);
    }

    static void CopyAll(string from, string to)
    {
        Directory.CreateDirectory(to);
        foreach (var dir in Directory.GetDirectories(from)) CopyAll(dir, Path.Combine(to, Path.GetFileName(dir)));
        foreach (var file in Directory.GetFiles(from)) File.Copy(file, Path.Combine(to, Path.GetFileName(file)), overwrite: true);
    }

    /// <summary>The profiles marked deleted (3.6): once a process has ended, its folder is removed for good (tried
    /// again a while: the browser's own processes can hold files a bit longer) and it leaves the list. One still running
    /// or a folder that cannot go yet stays marked, for the next time.</summary>
    public static async Task RemoveDeleted(string top)
    {
        var path = DataFolder.ProfilesPath(top);
        foreach (var p in ProfileStore.Load(path).Profiles.Where(p => p.Deleted && p.Number != ProfileStore.Default).ToList())
        {
            if (!await Ended(p.Number)) continue;
            var dir = DataFolder.ProfileDir(top, p.Number);
            var gone = false;
            for (var i = 0; i < 40 && !gone; i++)
            {
                try
                {
                    if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
                    gone = true;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { await Task.Delay(500); }
            }
            if (gone) ProfileStore.Change(path, s => s.Remove(p.Number));
        }
    }
}
