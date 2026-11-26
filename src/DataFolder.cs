namespace Foldex;

/// <summary>
/// The data folder (%LOCALAPPDATA%\Foldex, or FOLDEX_DATA): your settings at the top (settings.json), what Foldex
/// remembers by itself in State\ (state.json, EBWebView\).
/// </summary>
static class DataFolder
{
    public const string StateName = "State";

    /// <summary>The data folder: FOLDEX_DATA when set (a test copy, away from the real state), else
    /// %LOCALAPPDATA%\Foldex.</summary>
    public static string Resolve(string? variable, string localAppData) =>
        variable is { Length: > 0 } dir ? dir : Path.Combine(localAppData, "Foldex");

    /// <summary>The folder of the profiles other than Default, under the top folder (docs/plans/executed/41-PLAN-profiles.md 3.1).</summary>
    public const string ProfilesName = "Profiles";

    /// <summary>A profile's data folder: Default's is the top folder, as Foldex had before profiles; any other's is
    /// Profiles\&lt;number&gt;\ under it.</summary>
    public static string ProfileDir(string top, int profile) =>
        profile == ProfileStore.Default ? top : Path.Combine(top, ProfilesName, profile.ToString(System.Globalization.CultureInfo.InvariantCulture));

    /// <summary>The list of profiles: in the top folder's State\, whichever profile reads it.</summary>
    public static string ProfilesPath(string top) => StatePath(top, ProfileStore.FileName);

    public static string StateDir(string dataDir) => Path.Combine(dataDir, StateName);

    public static string StatePath(string dataDir, string name) => Path.Combine(StateDir(dataDir), name);
}
