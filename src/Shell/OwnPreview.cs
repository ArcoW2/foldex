using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace Foldex.Shell;

/// <summary>
/// Foldex's own preview (docs/plans/executed/04-PLAN-preview.md 3.1, 3.3): images (a GIF moving), video and audio in the
/// page's own players, a PDF in pdf.js, markdown rendered, code coloured, CSV as a table, a zip's listing, a binary file
/// as hex, a folder's summary. The page gets an image, a video, a sound or a PDF at a URL of Foldex's own
/// (https://foldex-files.example/file?path=...), served here from the file: in ranges when the player asks for them, so
/// a video can be wound; the file opened off the window's thread (a share may be slow), shared for reading and writing so
/// a file another program has open still shows. Text-like kinds get their first bytes (the setting previewTextKB) in the
/// message itself. A cloud file that is not on this PC (a placeholder) is not read until asked: reading it would
/// download it.
/// </summary>
static class OwnPreview
{
    const string FilesHost = "foldex-files.example";

    static readonly Dictionary<string, string> Images = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".jfif"] = "image/jpeg", [".gif"] = "image/gif",
        [".bmp"] = "image/bmp", [".webp"] = "image/webp", [".ico"] = "image/x-icon", [".svg"] = "image/svg+xml", [".avif"] = "image/avif",
    };
    static readonly Dictionary<string, string> Videos = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp4"] = "video/mp4", [".m4v"] = "video/mp4", [".webm"] = "video/webm", [".ogv"] = "video/ogg", [".mov"] = "video/quicktime",
        [".mkv"] = "video/x-matroska",
    };
    static readonly Dictionary<string, string> Sounds = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp3"] = "audio/mpeg", [".wav"] = "audio/wav", [".ogg"] = "audio/ogg", [".oga"] = "audio/ogg", [".opus"] = "audio/ogg",
        [".m4a"] = "audio/mp4", [".aac"] = "audio/aac", [".flac"] = "audio/flac", [".weba"] = "audio/webm",
    };
    static readonly HashSet<string> Markdowns = new(StringComparer.OrdinalIgnoreCase) { ".md", ".markdown", ".mdown", ".mkd" };
    static readonly HashSet<string> Htmls = new(StringComparer.OrdinalIgnoreCase) { ".html", ".htm", ".xhtml" };
    static readonly HashSet<string> Csvs = new(StringComparer.OrdinalIgnoreCase) { ".csv", ".tsv" };
    static readonly HashSet<string> Zips = new(StringComparer.OrdinalIgnoreCase) { ".zip", ".nupkg", ".jar", ".vsix" };
    // Code by its extension: highlight.js's name of its language (LexPen's core.js; preview.html).
    static readonly Dictionary<string, string> Codes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".cs"] = "csharp", [".js"] = "javascript", [".mjs"] = "javascript", [".ts"] = "typescript", [".css"] = "css",
        [".xml"] = "xml", [".xaml"] = "xml", [".svg"] = "xml", [".csproj"] = "xml", [".props"] = "xml",
        [".targets"] = "xml", [".json"] = "json", [".py"] = "python", [".ps1"] = "powershell", [".psm1"] = "powershell",
        [".bat"] = "dos", [".cmd"] = "dos", [".sh"] = "bash", [".sql"] = "sql", [".pas"] = "delphi", [".dpr"] = "delphi",
        [".dfm"] = "delphi", [".yml"] = "yaml", [".yaml"] = "yaml", [".ini"] = "ini", [".cfg"] = "ini", [".conf"] = "ini",
        [".toml"] = "ini", [".reg"] = "ini", [".java"] = "java", [".c"] = "c", [".h"] = "c", [".cpp"] = "cpp", [".hpp"] = "cpp",
        [".go"] = "go", [".rs"] = "rust", [".php"] = "php", [".rb"] = "ruby", [".vb"] = "vbnet", [".fs"] = "fsharp", [".kt"] = "kotlin",
        [".swift"] = "swift", [".lua"] = "lua", [".r"] = "r", [".diff"] = "diff", [".patch"] = "diff", [".dockerfile"] = "dockerfile",
    };
    static readonly HashSet<string> Texts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".log", ".sln", ".gitignore", ".gitattributes", ".editorconfig", ".nfo", ".text",
    };

    /// <summary>What kind of own preview a file gets: "image", "video", "audio", "pdf", "markdown", "html", "csv", "zip",
    /// "code", "text", or null (none by its extension: a look at it decides, Read).</summary>
    public static string? KindOf(string path)
    {
        var ext = Path.GetExtension(path);
        return Images.ContainsKey(ext) ? "image"
            : Videos.ContainsKey(ext) ? "video" : Sounds.ContainsKey(ext) ? "audio"
            : ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase) ? "pdf"
            : Markdowns.Contains(ext) ? "markdown" : Htmls.Contains(ext) ? "html" : Csvs.Contains(ext) ? "csv" : Zips.Contains(ext) ? "zip"
            : Codes.ContainsKey(ext) ? "code" : Texts.Contains(ext) ? "text" : null;
    }

    // The kinds served at a URL of Foldex's own (the others come in the message).
    static bool Served(string? kind) => kind is "image" or "video" or "audio" or "pdf";

    static string TypeOf(string path)
    {
        var ext = Path.GetExtension(path);
        return Images.GetValueOrDefault(ext) ?? Videos.GetValueOrDefault(ext) ?? Sounds.GetValueOrDefault(ext)
            ?? (ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase) ? "application/pdf" : "application/octet-stream");
    }

    /// <summary>A file of its own preview's kind that Windows is asked first for (the setting previewWindowsTypes:
    /// extensions such as ".docx;.pdf").</summary>
    public static bool WindowsFirst(string path, string? types) =>
        !string.IsNullOrWhiteSpace(types) && types.Split([';', ',', ' '], StringSplitOptions.RemoveEmptyEntries)
            .Any(t => ("." + t.TrimStart('*', '.')).Equals(Path.GetExtension(path), StringComparison.OrdinalIgnoreCase));

    /// <summary>The most of a text file shown by default (the setting previewTextKB), and of a binary one as hex.</summary>
    public const int TextBytes = 256 * 1024, HexBytes = 64 * 1024;

    /// <summary>The most Show all reads: a text larger still shows its start, said to be cut.</summary>
    public const int AllBytes = 32 * 1024 * 1024;

    // Cloud files not on this PC (Synology Drive, OneDrive files on demand): offline, or read only by downloading.
    const FileAttributes RecallOnOpen = (FileAttributes)0x40000, RecallOnDataAccess = (FileAttributes)0x400000;
    public static bool Placeholder(string path)
    {
        try { return (File.GetAttributes(path) & (FileAttributes.Offline | RecallOnOpen | RecallOnDataAccess)) != 0; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return false; }
    }

    /// <summary>The own preview of a file for the page (event previewShown's `own`): its kind and what it shows (a URL,
    /// its text, a zip's entries, its bytes as hex). A file of an extension not known here is shown as text when its start
    /// looks like text (an .nss, a .reg), else as hex. A placeholder: only that (download: read all the same, which
    /// downloads it). A file another program holds: why it cannot be read. Null for a file that is not there. Touches the
    /// file: off the window's thread.</summary>
    public static JsonObject? Read(string path, int textBytes = TextBytes, bool download = false, bool hex = true)
    {
        if (!File.Exists(path)) return null;
        if (!download && Placeholder(path)) return With(Properties(path), "placeholder");
        var kind = KindOf(path);
        if (Served(kind)) return new JsonObject { ["kind"] = kind, ["url"] = UrlOf(path) };
        try
        {
            if (kind == "zip") return Zip(path) ?? (hex ? Hex(path) : null);
            using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            if (kind is null)
            {
                var start = new byte[Math.Min(SniffBytes, file.Length)];
                var got = file.ReadAtLeast(start, start.Length, false);
                if (!LooksLikeText(start.AsSpan(0, got))) return hex ? Hex(path) : null;
                file.Position = 0;
                kind = "text";
            }
            var buffer = new byte[Math.Min(textBytes, file.Length)];
            var read = file.ReadAtLeast(buffer, buffer.Length, false);
            var cut = file.Length > textBytes;
            var o = new JsonObject { ["kind"] = kind, ["text"] = Decode(buffer.AsSpan(0, read), cut), ["cut"] = cut, ["size"] = file.Length };
            if (kind == "code") o["lang"] = Codes[Path.GetExtension(path)];
            if (kind == "csv") o["tab"] = Path.GetExtension(path).Equals(".tsv", StringComparison.OrdinalIgnoreCase);
            if (kind is "markdown" or "html") o["folder"] = Path.GetDirectoryName(path);
            return o;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { var o = With(Properties(path), "locked"); o["error"] = ex.Message; return o; }
    }

    /// <summary>The properties of a file without a viewer (3.1, Anything else): size, dates, attributes.</summary>
    public static JsonObject Properties(string path)
    {
        var f = new FileInfo(path);
        return new JsonObject { ["kind"] = "properties", ["name"] = f.Name, ["size"] = f.Length,
            ["created"] = new DateTimeOffset(f.CreationTimeUtc).ToUnixTimeMilliseconds(),
            ["modified"] = new DateTimeOffset(f.LastWriteTimeUtc).ToUnixTimeMilliseconds(),
            ["accessed"] = new DateTimeOffset(f.LastAccessTimeUtc).ToUnixTimeMilliseconds(),
            ["attributes"] = f.Attributes.ToString() };
    }

    static JsonObject With(JsonObject o, string kind) { o["kind"] = kind; return o; }

    /// <summary>A URL of Foldex's own for a file the page shows by itself (an image, a video, a sound, a PDF).</summary>
    public static string UrlOf(string path) => $"https://{FilesHost}/file?path={Uri.EscapeDataString(path)}";

    // A zip's entries (at most ZipEntries): name, size, packed size, modified; null when it is no zip.
    const int ZipEntries = 5000;
    static JsonObject? Zip(string path)
    {
        try
        {
            using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var zip = new System.IO.Compression.ZipArchive(file, System.IO.Compression.ZipArchiveMode.Read);
            var entries = new JsonArray();
            foreach (var e in zip.Entries.Take(ZipEntries))
                entries.Add(new JsonObject { ["name"] = e.FullName, ["size"] = e.Length, ["packed"] = e.CompressedLength,
                    ["modified"] = e.LastWriteTime.ToUnixTimeMilliseconds() });
            return new JsonObject { ["kind"] = "zip", ["entries"] = entries, ["count"] = zip.Entries.Count, ["size"] = file.Length };
        }
        catch (InvalidDataException) { return null; }
    }

    // The start of a file as hex: its first HexBytes, base64.
    public static JsonObject Hex(string path)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var buffer = new byte[Math.Min(HexBytes, file.Length)];
        var read = file.ReadAtLeast(buffer, buffer.Length, false);
        return new JsonObject { ["kind"] = "hex", ["bytes"] = Convert.ToBase64String(buffer, 0, read), ["size"] = file.Length, ["cut"] = file.Length > HexBytes };
    }

    /// <summary>A folder's summary (3.1): its folders and files (at most SummaryItems looked at), its files' size, the
    /// file types by count with their size, its dates. Off the window's thread.</summary>
    const int SummaryItems = 100_000;
    public static JsonObject? Folder(string path)
    {
        try
        {
            var dir = new DirectoryInfo(path);
            long folders = 0, files = 0, size = 0;
            var types = new Dictionary<string, (long Count, long Size)>(StringComparer.OrdinalIgnoreCase);
            var all = true;
            foreach (var e in dir.EnumerateFileSystemInfos("*", new EnumerationOptions { IgnoreInaccessible = true, AttributesToSkip = 0 }))
            {
                if (folders + files >= SummaryItems) { all = false; break; }
                if (e is DirectoryInfo) { folders++; continue; }
                var f = (FileInfo)e;
                files++;
                size += f.Length;
                var ext = f.Extension.Length > 0 ? f.Extension.ToLowerInvariant() : "(none)";
                var t = types.GetValueOrDefault(ext);
                types[ext] = (t.Count + 1, t.Size + f.Length);
            }
            var byType = new JsonArray(types.OrderByDescending(kv => kv.Value.Count).Take(15)
                .Select(kv => (JsonNode)new JsonObject { ["type"] = kv.Key, ["count"] = kv.Value.Count, ["size"] = kv.Value.Size }).ToArray());
            return new JsonObject { ["kind"] = "folder", ["name"] = dir.Name.Length > 0 ? dir.Name : path, ["folders"] = folders, ["files"] = files,
                ["size"] = size, ["types"] = byType, ["more"] = types.Count > 15, ["all"] = all,
                ["created"] = new DateTimeOffset(dir.CreationTimeUtc).ToUnixTimeMilliseconds(),
                ["modified"] = new DateTimeOffset(dir.LastWriteTimeUtc).ToUnixTimeMilliseconds() };
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or System.Security.SecurityException) { return null; }
    }

    /// <summary>How much of a file of an unknown extension is looked at to tell whether it is text.</summary>
    const int SniffBytes = 8 * 1024;

    /// <summary>Whether bytes look like text: a byte order mark, or no NUL byte and hardly any other control bytes (tab,
    /// line ends, form feed and escape count as text). An empty file is not shown as text.</summary>
    internal static bool LooksLikeText(ReadOnlySpan<byte> bytes)
    {
        if (bytes.IsEmpty) return false;
        if (bytes.StartsWith((byte[])[0xEF, 0xBB, 0xBF]) || bytes.StartsWith((byte[])[0xFF, 0xFE]) || bytes.StartsWith((byte[])[0xFE, 0xFF])) return true;
        var control = 0;
        foreach (var b in bytes)
        {
            if (b == 0) return false;
            if (b < 0x20 && b is not (9 or 10 or 12 or 13 or 27)) control++;
        }
        return control * 100 <= bytes.Length;   // at most 1 in 100
    }

    /// <summary>Text by its byte order mark (UTF-8, UTF-16 LE or BE); without one UTF-8 when it is valid UTF-8, else
    /// Latin-1 (an old ANSI file still reads). `cut`: the text was cut at TextBytes, so a UTF-8 character cut off at its
    /// end is left out rather than taking the whole text for Latin-1.</summary>
    internal static string Decode(ReadOnlySpan<byte> bytes, bool cut = false)
    {
        if (bytes.StartsWith((byte[])[0xEF, 0xBB, 0xBF])) return Encoding.UTF8.GetString(bytes[3..]);
        if (bytes.StartsWith((byte[])[0xFF, 0xFE])) return Encoding.Unicode.GetString(bytes[2..]);
        if (bytes.StartsWith((byte[])[0xFE, 0xFF])) return Encoding.BigEndianUnicode.GetString(bytes[2..]);
        for (var off = 0; off <= (cut ? Math.Min(3, bytes.Length) : 0); off++)
            if (System.Text.Unicode.Utf8.IsValid(bytes[..^off])) return Encoding.UTF8.GetString(bytes[..^off]);
        return Encoding.Latin1.GetString(bytes);
    }

    /// <summary>Makes a WebView2 serve the files of the own preview (before its page is loaded).</summary>
    public static void Serve(CoreWebView2 core)
    {
        // All source kinds: a docked preview is a frame of its own process (WebFiles.Serve).
        core.AddWebResourceRequestedFilter($"https://{FilesHost}/*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
        core.WebResourceRequested += async (_, e) =>
        {
            var uri = new Uri(e.Request.Uri);
            if (!uri.Host.Equals(FilesHost, StringComparison.OrdinalIgnoreCase)) return;
            var query = uri.Query.TrimStart('?').Split('&').Select(p => p.Split('=', 2)).FirstOrDefault(p => p[0] == "path");
            var path = query is { Length: 2 } ? Uri.UnescapeDataString(query[1]) : "";
            var range = e.Request.Headers.Contains("Range") ? e.Request.Headers.GetHeader("Range") : null;
            // Completed once below, not disposed: its Dispose completes it again, which WebView2 refuses (0x8000000E).
            var deferral = e.GetDeferral();
            // Only a kind the preview shows; opened off this thread. Readable by the preview's page (pdf.js fetches the
            // PDF from the panes' origin): only Foldex's own pages run scripts in this WebView2.
            var part = Served(KindOf(path)) ? await Task.Run(() => Open(path, range)) : null;
            try
            {
                e.Response = part is null
                    ? core.Environment.CreateWebResourceResponse(null, 404, "Not Found", "")
                    : core.Environment.CreateWebResourceResponse(part.Value.Stream, part.Value.Status, part.Value.Status == 206 ? "Partial Content" : "OK",
                        $"Content-Type: {TypeOf(path)}\r\nAccept-Ranges: bytes\r\nContent-Length: {part.Value.Length}\r\nAccess-Control-Allow-Origin: *"
                        + (part.Value.Status == 206 ? $"\r\nContent-Range: bytes {part.Value.From}-{part.Value.From + part.Value.Length - 1}/{part.Value.Total}" : ""));
                deferral.Complete();
            }
            catch (Exception ex) when (ex is System.Runtime.InteropServices.COMException or InvalidOperationException or ObjectDisposedException)
            {
                part?.Stream.Dispose();   // the request was given up meanwhile (another file shown, the window closing)
            }
        };
    }

    // The file, or the part a "Range: bytes=a-b" asks for (206).
    static (Stream Stream, int Status, long From, long Length, long Total)? Open(string path, string? range)
    {
        try
        {
            if (NetworkGuard.IsNetwork(path) && !NetworkGuard.Reachable(path).GetAwaiter().GetResult()) return null;
            var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 64 * 1024);
            var total = file.Length;
            if (range is null || !range.StartsWith("bytes=")) return (file, 200, 0, total, total);
            var ends = range[6..].Split(',')[0].Split('-');
            long from, to;
            if (ends[0] == "") { from = Math.Max(0, total - long.Parse(ends[1])); to = total - 1; }   // the last n bytes
            else { from = long.Parse(ends[0]); to = ends.Length > 1 && ends[1] != "" ? Math.Min(long.Parse(ends[1]), total - 1) : total - 1; }
            if (from >= total || to < from) { file.Dispose(); return null; }
            file.Position = from;
            return (new Part(file, to - from + 1), 206, from, to - from + 1, total);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or FormatException or OverflowException or ArgumentException) { return null; }
    }

    // A file read from where it stands for `length` bytes.
    sealed class Part(Stream inner, long length) : Stream
    {
        long left = length;
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => length;
        public override long Position { get => length - left; set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count)
        {
            if (left <= 0) return 0;
            var n = inner.Read(buffer, offset, (int)Math.Min(count, left));
            left -= n;
            return n;
        }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing)
        {
            if (disposing) inner.Dispose();
            base.Dispose(disposing);
        }
    }
}
