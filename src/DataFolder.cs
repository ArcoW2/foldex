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

    public static string StateDir(string dataDir) => Path.Combine(dataDir, StateName);

    public static string StatePath(string dataDir, string name) => Path.Combine(StateDir(dataDir), name);
}
