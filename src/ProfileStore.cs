using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Foldex;

/// <summary>
/// Profiles (docs/plans/executed/41-PLAN-profiles.md 3.1, 3.3, 3.4): each a complete Foldex of its own, with its own data folder
/// (DataFolder.ProfileDir) and its own process. Default (number 0) always exists, is the top folder, cannot be renamed
/// or deleted and has no password. Kept in the top folder's State\profiles.json, written whole and atomically, as
/// projects.json is. Every open profile's process writes it, so a change reads the file anew, changes it and writes it
/// under a named mutex (Change). Pure apart from that file, so the rules can be tested without windows.
/// </summary>
sealed class ProfileStore
{
    public const string FileName = "profiles.json";
    public const int Default = 0;
    public const string DefaultName = "Default";

    // PBKDF2 with SHA-256 at the count OWASP's Password Storage Cheat Sheet gives for it; kept per profile, so a later
    // count does not break the ones set before.
    public const int Iterations = 600_000;

    public sealed class Profile
    {
        public int Number;
        public string Name = "";
        public DateTime Created;
        public DateTime? Opened;
        public string? Salt, Hash;       // base64; null: no password
        public int Iterations;
        public bool NeverOpen;           // never opens by itself at start (3.3)
        public bool WasOpen;             // open when Foldex last ended (3.3)
        public bool Deleted;             // its folder goes once its process has ended (3.6)

        public bool Locked => Hash is not null;
    }

    readonly string path;
    public List<Profile> Profiles { get; } = [];
    int next = 1;

    ProfileStore(string path) => this.path = path;

    /// <summary>The profiles that are not deleted, Default first, then by name.</summary>
    public IEnumerable<Profile> Listed => Profiles.Where(p => !p.Deleted)
        .OrderByDescending(p => p.Number == Default).ThenBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(p => p.Number);

    public Profile? Get(int number) => Profiles.FirstOrDefault(p => p.Number == number && !p.Deleted);

    /// <summary>By number or by name (ignoring case); null when there is none.</summary>
    public Profile? Find(string numberOrName) =>
        int.TryParse(numberOrName, out var n) && Get(n) is { } byNumber ? byNumber
        : Profiles.FirstOrDefault(p => !p.Deleted && string.Equals(p.Name, numberOrName.Trim(), StringComparison.CurrentCultureIgnoreCase));

    /// <summary>Reads the file; without one (or a broken one), only Default, open.</summary>
    public static ProfileStore Load(string path)
    {
        var store = new ProfileStore(path);
        JsonObject? root = null;
        try { root = JsonNode.Parse(File.ReadAllText(path)) as JsonObject; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        store.next = root?["next"]?.GetValue<int>() ?? 1;
        foreach (var n in root?["profiles"]?.AsArray() ?? [])
        {
            if (n is not JsonObject o || o["number"]?.GetValue<int>() is not int number) continue;
            store.Profiles.Add(new Profile
            {
                Number = number,
                Name = o["name"]?.GetValue<string>() ?? "",
                Created = Time(o["created"]) ?? DateTime.Now,
                Opened = Time(o["opened"]),
                Salt = o["salt"]?.GetValue<string>(),
                Hash = o["hash"]?.GetValue<string>(),
                Iterations = o["iterations"]?.GetValue<int>() ?? Iterations,
                NeverOpen = o["neverOpen"]?.GetValue<bool>() ?? false,
                WasOpen = o["wasOpen"]?.GetValue<bool>() ?? false,
                Deleted = o["deleted"]?.GetValue<bool>() ?? false,
            });
            store.next = Math.Max(store.next, number + 1);
        }
        if (store.Profiles.FirstOrDefault(p => p.Number == Default) is { } d)
        {
            // Default is always there as it should be, whatever the file says.
            (d.Name, d.Salt, d.Hash, d.Deleted) = (DefaultName, null, null, false);
        }
        else store.Profiles.Insert(0, new Profile { Number = Default, Name = DefaultName, Created = DateTime.Now, WasOpen = true });
        return store;
    }

    static DateTime? Time(JsonNode? n) =>
        n?.GetValue<string>() is { } s && DateTime.TryParse(s, null, System.Globalization.DateTimeStyles.RoundtripKind, out var t) ? t : null;

    public void Save()
    {
        var root = new JsonObject
        {
            ["next"] = next,
            ["profiles"] = new JsonArray(Profiles.Select(p => (JsonNode)new JsonObject
            {
                ["number"] = p.Number,
                ["name"] = p.Name,
                ["created"] = p.Created.ToString("o"),
                ["opened"] = p.Opened?.ToString("o"),
                ["salt"] = p.Salt,
                ["hash"] = p.Hash,
                ["iterations"] = p.Hash is null ? null : p.Iterations,
                ["neverOpen"] = p.NeverOpen,
                ["wasOpen"] = p.WasOpen,
                ["deleted"] = p.Deleted,
            }).ToArray()),
        };
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + ".tmp";
        File.WriteAllText(temp, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temp, path, overwrite: true);
    }

    /// <summary>Reads the file anew, lets `change` change it and writes it, under a mutex all of Foldex's processes
    /// share for this file; gives what `change` gave.</summary>
    public static T Change<T>(string path, Func<ProfileStore, T> change)
    {
        using var mutex = new Mutex(false, @"Local\Foldex-profiles-" + Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(path.ToLowerInvariant())))[..16]);
        var owned = false;
        try
        {
            try { owned = mutex.WaitOne(TimeSpan.FromSeconds(10)); }
            catch (AbandonedMutexException) { owned = true; }
            var store = Load(path);
            var result = change(store);
            store.Save();
            return result;
        }
        finally { if (owned) mutex.ReleaseMutex(); }
    }

    public static void Change(string path, Action<ProfileStore> change) => Change(path, s => { change(s); return 0; });

    /// <summary>A name not used yet: the one asked when free, else with a number after it.</summary>
    string FreeName(string name, int? except = null)
    {
        name = name.Trim();
        if (name.Length == 0) name = "Profile";
        bool Taken(string n) => Profiles.Any(p => !p.Deleted && p.Number != except && string.Equals(p.Name, n, StringComparison.CurrentCultureIgnoreCase));
        if (!Taken(name)) return name;
        for (var i = 2; ; i++) if (!Taken($"{name} {i}")) return $"{name} {i}";
    }

    /// <summary>A new profile (for a copy, 3.6): the next number, never one used before; no password, closed.</summary>
    public Profile Add(string name)
    {
        var p = new Profile { Number = next++, Name = FreeName(name), Created = DateTime.Now };
        Profiles.Add(p);
        return p;
    }

    /// <summary>False for Default, which keeps its name.</summary>
    public bool Rename(Profile p, string name)
    {
        if (p.Number == Default) return false;
        p.Name = FreeName(name, p.Number);
        return true;
    }

    /// <summary>Marked deleted (its folder goes once its process has ended: Remove); false for Default.</summary>
    public bool MarkDeleted(Profile p)
    {
        if (p.Number == Default) return false;
        p.Deleted = true;
        p.WasOpen = false;
        return true;
    }

    /// <summary>Taken out for good, once its folder is gone; its number is not given again (next stays).</summary>
    public void Remove(int number) => Profiles.RemoveAll(p => p.Number == number && number != Default);

    /// <summary>Sets or (null, empty) removes the password; false for Default, which has none.</summary>
    public bool SetPassword(Profile p, string? password)
    {
        if (p.Number == Default) return false;
        if (string.IsNullOrEmpty(password))
        {
            (p.Salt, p.Hash) = (null, null);
            return true;
        }
        var salt = RandomNumberGenerator.GetBytes(16);
        p.Iterations = Iterations;
        p.Salt = Convert.ToBase64String(salt);
        p.Hash = Convert.ToBase64String(Derive(password, salt, p.Iterations));
        return true;
    }

    /// <summary>True when the profile has no password or this is it.</summary>
    public static bool Check(Profile p, string? password)
    {
        if (p.Hash is null || p.Salt is null) return true;
        if (string.IsNullOrEmpty(password)) return false;
        var hash = Convert.FromBase64String(p.Hash);
        return CryptographicOperations.FixedTimeEquals(Derive(password, Convert.FromBase64String(p.Salt), p.Iterations), hash);
    }

    static byte[] Derive(string password, byte[] salt, int iterations) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, 32);

    /// <summary>The profiles that come back at start (3.3), Default left out: open when Foldex last ended, not switched
    /// to never open by themselves, not deleted.</summary>
    public IEnumerable<Profile> StartProfiles() =>
        Profiles.Where(p => p.Number != Default && p.WasOpen && !p.NeverOpen && !p.Deleted);

    /// <summary>Whether Default shows its own window at start: open at the last end and not never-open, or nothing
    /// else comes back.</summary>
    public bool DefaultAtStart() =>
        Get(Default) is { } d && d.WasOpen && !d.NeverOpen || !StartProfiles().Any();
}
