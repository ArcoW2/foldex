using System.Globalization;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// Everything Windows knows of a file or folder, for the Info pane: its properties (ShellProps.All) in groups, in
/// this order: the image's (EXIF: photo, image, GPS), the video's and sound's, the other details, and last the file
/// itself (name, folder, type, size, dates, attributes). Empty values and groups are left out; in a group the
/// properties by their name. Run on an STA thread.
/// </summary>
static class FileDetails
{
    static readonly string[] Image = ["System.Photo.", "System.Image.", "System.GPS."];
    static readonly string[] Gps = ["System.GPS.Latitude", "System.GPS.Longitude", "System.GPS.Altitude"];
    static readonly string[] Media =["System.Video.", "System.Audio.", "System.Media.", "System.Music."];

    // Shown with the file itself, or Windows' own bookkeeping: not among the details.
    static readonly string[] NotDetails =
    [
        "System.Item", "System.FileName", "System.FileExtension", "System.FileAttributes", "System.Size", "System.TotalFileSize",
        "System.DateModified", "System.DateCreated", "System.DateAccessed", "System.Parsing", "System.Kind", "System.Thumbnail",
        "System.Link", "System.Shell", "System.Search", "System.SFGAO", "System.ZoneIdentifier", "System.IsFolder",
        "System.Computer", "System.Volume", "System.NamespaceCLSID", "System.Sync", "System.Offline", "System.StorageProvider",
        "System.FilePlaceholderStatus", "System.PerceivedType", "System.ContentType", "System.IsShared", "System.SharedWith",
        "System.Security", "System.AppUserModel", "System.FileFRN", "System.FileIndex", "System.IsPinnedToNameSpaceTree",
        "System.ItemFolderPathDisplay",
    ];

    /// <summary>[{ title, rows: [[name, value]] }], the groups that have something. `folderSize`: a folder's size when
    /// it is known (FolderSizes), with what it holds.</summary>
    public static JsonArray Groups(string path, (long Size, int Files, int Folders)? folderSize = null)
    {
        // Values that are only an ID (a GUID: an audio format, a media class) say nothing to a reader: left out. A GPS
        // position in degrees, minutes and seconds with its N/S or E/W, and in decimal degrees.
        var all = ShellProps.All(path);
        // A video's GPS location (an iPhone's .MOV) Windows has, but does not list with the rest: asked by name.
        var gps = Gps.Where(n => !all.Any(p => p.Name == n)).ToList();
        if (gps.Count > 0) all.AddRange(ShellProps.Named(path, gps));
        // N/S and E/W have no display name of their own: asked by name.
        var refs = ShellProps.Values([path], ["System.GPS.LatitudeRef", "System.GPS.LongitudeRef"])[path] as JsonObject;
        string Ref(string name) => refs?[name + "Ref"]?[0]?.GetValue<string>() ?? "";
        var props = all.Where(p => !Guid.TryParse(p.Value, out _))
            .Select(p => p.Name is "System.GPS.Latitude" or "System.GPS.Longitude" ? (p.Name, p.Title, Value: Position(p.Value, Ref(p.Name)), p.Ms) : p)
            .ToList();
        bool Of(string name, string[] prefixes) => prefixes.Any(p => name.StartsWith(p, StringComparison.Ordinal));
        var groups = new JsonArray();
        // A row: [title, text], a date [title, ms] (the page shows it as the setting dateFormat says).
        void Add(string title, IEnumerable<(string Title, string Value, long? Ms)> rows)
        {
            var list = rows.ToList();
            if (list.Count == 0) return;
            groups.Add(new JsonObject { ["title"] = title, ["rows"] = new JsonArray([.. list.Select(r =>
                (JsonNode)new JsonArray(r.Title, r.Ms is { } ms ? JsonValue.Create(ms) : JsonValue.Create(r.Value)))]) });
        }
        // A property Windows has under two names (an alias) once.
        IEnumerable<(string, string, long?)> Rows(IEnumerable<(string Name, string Title, string Value, long? Ms)> of) =>
            of.GroupBy(p => (p.Title, p.Value)).Select(g => g.First()).OrderBy(p => p.Title, StringComparer.CurrentCultureIgnoreCase).Select(p => (p.Title, p.Value, p.Ms));
        Add("Image", Rows(props.Where(p => Of(p.Name, Image))));
        Add("Video and sound", Rows(props.Where(p => Of(p.Name, Media))));
        Add("Details", Rows(props.Where(p => !Of(p.Name, Image) && !Of(p.Name, Media) && !Of(p.Name, NotDetails))));
        Add("File", FileRows(path, props.FirstOrDefault(p => p.Name == "System.ItemTypeText").Value, folderSize));
        return groups;
    }

    static IEnumerable<(string, string, long?)> FileRows(string path, string? type, (long Size, int Files, int Folders)? folderSize)
    {
        FileSystemInfo info = Directory.Exists(path) ? new DirectoryInfo(path) : new FileInfo(path);
        if (!info.Exists) yield break;
        static long Ms(DateTime utc) => new DateTimeOffset(utc, TimeSpan.Zero).ToUnixTimeMilliseconds();
        yield return ("Name", info.Name, null);
        yield return ("Folder", Path.GetDirectoryName(info.FullName.TrimEnd('\\')) ?? "", null);
        if (!string.IsNullOrEmpty(type)) yield return ("Type", type, null);
        if (info is FileInfo file) yield return ("Size", $"{Size(file.Length)} ({file.Length.ToString("N0", CultureInfo.CurrentCulture)} bytes)", null);
        if (info is DirectoryInfo && folderSize is { } s)
        {
            yield return ("Size", $"{Size(s.Size)} ({s.Size.ToString("N0", CultureInfo.CurrentCulture)} bytes)", null);
            yield return ("Contains", $"{s.Files.ToString("N0", CultureInfo.CurrentCulture)} {(s.Files == 1 ? "file" : "files")}, "
                + $"{s.Folders.ToString("N0", CultureInfo.CurrentCulture)} {(s.Folders == 1 ? "folder" : "folders")}", null);
        }
        yield return ("Created", "", Ms(info.CreationTimeUtc));
        yield return ("Modified", "", Ms(info.LastWriteTimeUtc));
        yield return ("Accessed", "", Ms(info.LastAccessTimeUtc));
        var words = Enum.GetValues<FileAttributes>().Where(a => a != 0 && a != FileAttributes.Normal && a != FileAttributes.Directory && info.Attributes.HasFlag(a))
            .Select(a => a switch
            {
                FileAttributes.ReadOnly => "read-only", FileAttributes.Hidden => "hidden", FileAttributes.System => "system",
                FileAttributes.Archive => "archive", FileAttributes.Compressed => "compressed", FileAttributes.Encrypted => "encrypted",
                FileAttributes.Offline => "offline", FileAttributes.ReparsePoint => "link", FileAttributes.SparseFile => "sparse",
                FileAttributes.Temporary => "temporary", FileAttributes.NotContentIndexed => "not indexed",
                _ => a.ToString().ToLowerInvariant(),
            }).Distinct().ToList();
        if (words.Count > 0) yield return ("Attributes", string.Join(", ", words), null);
    }

    // "52; 1; 33.1199999" (as Windows gives degrees, minutes, seconds) and "N": 52 1' 33.12" N (52.02587).
    static string Position(string value, string reference)
    {
        var parts = value.Split(';').Select(s => double.TryParse(s.Trim().Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : double.NaN).ToList();
        if (parts.Count != 3 || parts.Any(double.IsNaN)) return value;
        var dec = parts[0] + parts[1] / 60 + parts[2] / 3600;
        var inv = CultureInfo.InvariantCulture;
        return $"{parts[0].ToString("0", inv)} {parts[1].ToString("0", inv)}' {parts[2].ToString("0.##", inv)}\" {reference}".TrimEnd()
            + $" ({dec.ToString("0.00000", inv)})";
    }

    static string Size(long bytes)
    {
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double v = bytes;
        var u = 0;
        while (v >= 1024 && u < units.Length - 1) { v /= 1024; u++; }
        return u == 0 ? $"{bytes} B" : $"{v.ToString(v < 10 ? "0.0" : "0", CultureInfo.CurrentCulture)} {units[u]}";
    }
}
