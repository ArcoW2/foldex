using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace Foldex.Shell;

/// <summary>
/// A preview of Foldex's own for a file Windows has no preview handler for: images (a GIF moving), video and audio
/// in the page's own players, text as text. The page gets an image, a video or a sound at a URL of Foldex's own
/// (https://foldex-files.example/file?path=...), served here from the file: in ranges when the player asks for them,
/// so a video can be wound; the file opened off the window's thread (a share may be slow).
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
    static readonly HashSet<string> Texts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".log", ".md", ".csv", ".tsv", ".json", ".xml", ".ini", ".cfg", ".conf", ".yml", ".yaml", ".toml",
        ".cs", ".js", ".ts", ".css", ".html", ".htm", ".py", ".ps1", ".bat", ".cmd", ".sh", ".sql", ".pas", ".dpr",
        ".dfm", ".csproj", ".sln", ".props", ".targets", ".gitignore", ".editorconfig",
    };

    /// <summary>The most of a text file shown (the rest is said to be left out).</summary>
    public const int TextBytes = 256 * 1024;

    /// <summary>What kind of own preview a file gets: "image", "video", "audio", "text", or null (none).</summary>
    public static string? KindOf(string path)
    {
        var ext = Path.GetExtension(path);
        return Images.ContainsKey(ext) ? "image" : Videos.ContainsKey(ext) ? "video" : Sounds.ContainsKey(ext) ? "audio" : Texts.Contains(ext) ? "text" : null;
    }

    static string TypeOf(string path)
    {
        var ext = Path.GetExtension(path);
        return Images.GetValueOrDefault(ext) ?? Videos.GetValueOrDefault(ext) ?? Sounds.GetValueOrDefault(ext) ?? "application/octet-stream";
    }

    /// <summary>The own preview of a file for the page (event previewShown's `own`): its kind, and its URL or (text) its
    /// first TextBytes. Null when Foldex has none for it. Touches the file: off the window's thread.</summary>
    public static JsonObject? Read(string path)
    {
        var kind = KindOf(path);
        if (kind is null || !File.Exists(path)) return null;
        if (kind != "text") return new JsonObject { ["kind"] = kind, ["url"] = $"https://{FilesHost}/file?path={Uri.EscapeDataString(path)}" };
        using var file = File.OpenRead(path);
        var buffer = new byte[Math.Min(TextBytes, file.Length)];
        var read = file.ReadAtLeast(buffer, buffer.Length, false);
        return new JsonObject { ["kind"] = kind, ["text"] = Encoding.UTF8.GetString(buffer, 0, read), ["cut"] = file.Length > TextBytes };
    }

    /// <summary>Makes a WebView2 serve the files of the own preview (before its page is loaded).</summary>
    public static void Serve(CoreWebView2 core)
    {
        core.AddWebResourceRequestedFilter($"https://{FilesHost}/*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += async (_, e) =>
        {
            var uri = new Uri(e.Request.Uri);
            if (!uri.Host.Equals(FilesHost, StringComparison.OrdinalIgnoreCase)) return;
            var query = uri.Query.TrimStart('?').Split('&').Select(p => p.Split('=', 2)).FirstOrDefault(p => p[0] == "path");
            var path = query is { Length: 2 } ? Uri.UnescapeDataString(query[1]) : "";
            var range = e.Request.Headers.Contains("Range") ? e.Request.Headers.GetHeader("Range") : null;
            // Completed once below, not disposed: its Dispose completes it again, which WebView2 refuses (0x8000000E).
            var deferral = e.GetDeferral();
            // Only a kind the preview shows; opened off this thread.
            var part = KindOf(path) is string kind && kind != "text" ? await Task.Run(() => Open(path, range)) : null;
            try
            {
                e.Response = part is null
                    ? core.Environment.CreateWebResourceResponse(null, 404, "Not Found", "")
                    : core.Environment.CreateWebResourceResponse(part.Value.Stream, part.Value.Status, part.Value.Status == 206 ? "Partial Content" : "OK",
                        $"Content-Type: {TypeOf(path)}\r\nAccept-Ranges: bytes\r\nContent-Length: {part.Value.Length}"
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
