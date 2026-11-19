using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

namespace Foldex.Shell;

/// <summary>
/// Whether a file holds a text (docs/plans/20-PLAN-extended-search.md 3.1): the Find dialog's Containing text. The page
/// builds the regular expression (scraps.js searchExpression), as LexPen's page does for its FolderSearch, so the
/// search and the preview's find bar agree on what matches. Known files are the ones Foldex reads as text (the own
/// preview's text kinds, or a file whose start looks like text), read as its preview reads them (OwnPreview.Decode);
/// All files also reads the others: through Windows' IFilter where one is installed for the type, else their bytes.
/// </summary>
static class TextSearch
{
    /// <summary>The expression the page built; null for none (no text). Throws ArgumentException when it does not parse.</summary>
    public static Regex? Make(string? pattern, bool matchCase) =>
        string.IsNullOrEmpty(pattern) ? null
            : new Regex(pattern, RegexOptions.CultureInvariant | RegexOptions.Multiline | (matchCase ? 0 : RegexOptions.IgnoreCase), TimeSpan.FromSeconds(2));

    // The own preview's kinds that are text.
    static bool TextKind(string? kind) => kind is "text" or "code" or "markdown" or "html" or "csv";

    /// <summary>Whether the file holds a match. `startBytes`: only that much of it is read (0: all of it). A file that
    /// cannot be read, or not text with Known files, holds nothing.</summary>
    public static bool Holds(string path, Regex re, bool allFiles, long startBytes, CancellationToken cancel = default)
    {
        try
        {
            var text = Text(path, allFiles, startBytes, cancel);
            return text is not null && re.IsMatch(text);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or RegexMatchTimeoutException or COMException or InvalidCastException) { return false; }
    }

    /// <summary>A file's text as the search reads it; null when it is not searched (not text with Known files).</summary>
    internal static string? Text(string path, bool allFiles, long startBytes, CancellationToken cancel = default)
    {
        var kind = OwnPreview.KindOf(path);
        using (var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
        {
            var length = startBytes > 0 ? Math.Min(startBytes, file.Length) : file.Length;
            var text = TextKind(kind);
            if (!text && kind is null)
            {
                var start = new byte[Math.Min(8 * 1024, file.Length)];
                var got = file.ReadAtLeast(start, start.Length, false);
                text = OwnPreview.LooksLikeText(start.AsSpan(0, got));
                file.Position = 0;
            }
            if (text) return Read(file, length);
            if (!allFiles) return null;
        }
        // A filter that gives no text (one for a type without text, as .bin can have): the bytes after all.
        return Filtered(path, startBytes, cancel) is { Length: > 0 } filtered ? filtered : Bytes(path, startBytes);
    }

    static string Read(FileStream file, long length)
    {
        var buffer = new byte[length];
        var read = file.ReadAtLeast(buffer, buffer.Length, false);
        return OwnPreview.Decode(buffer.AsSpan(0, read), length < file.Length);
    }

    // Any other file with All files and no IFilter: its bytes, as text.
    static string Bytes(string path, long startBytes)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        return Read(file, startBytes > 0 ? Math.Min(startBytes, file.Length) : file.Length);
    }

    // ---------- Windows' IFilter (the filters Windows Search reads files with) ----------

    /// <summary>The text an IFilter gives for the file, at most `startBytes` characters (0: all); null when Windows
    /// has no IFilter for its type or it fails.</summary>
    internal static string? Filtered(string path, long startBytes, CancellationToken cancel = default)
    {
        if (LoadIFilter(path, IntPtr.Zero, out var unknown) != 0 || unknown == IntPtr.Zero) return null;
        IFilter? filter = null;
        try
        {
            filter = (IFilter)Marshal.GetObjectForIUnknown(unknown);
            // Without the attributes to apply, a filter may give no text at all (the plain text one gives none).
            const int CanonParagraphs = 1, HardLineBreaks = 2, CanonHyphens = 4, CanonSpaces = 8, IndexAttributes = 16, OtherAttributes = 32;
            if (filter.Init(CanonParagraphs | HardLineBreaks | CanonHyphens | CanonSpaces | IndexAttributes | OtherAttributes, 0, IntPtr.Zero, out _) != 0) return null;
            var text = new StringBuilder();
            var buffer = new char[4096];
            var max = startBytes > 0 ? startBytes : long.MaxValue;
            while (text.Length < max && !cancel.IsCancellationRequested)
            {
                var hr = filter.GetChunk(out var chunk);
                if (hr is EmbeddingUnavailable or LinkUnavailable) continue;   // a part it cannot read: the next one
                if (hr < 0) break;                                              // the end, or a failure
                if ((chunk.Flags & ChunkText) == 0) continue;
                for (;;)
                {
                    var size = buffer.Length;
                    hr = filter.GetText(ref size, buffer);
                    if (hr == NoMoreText || hr < 0) break;
                    text.Append(buffer, 0, Math.Min(size, buffer.Length));
                    if (text.Length >= max || hr == LastText) break;
                }
                text.Append('\n');
            }
            return text.Length > max ? text.ToString(0, (int)max) : text.ToString();
        }
        catch (Exception ex) when (ex is COMException or InvalidCastException) { return null; }
        finally
        {
            if (filter is not null) Marshal.ReleaseComObject(filter);
            Marshal.Release(unknown);
        }
    }

    const int EmbeddingUnavailable = unchecked((int)0x80041707), LinkUnavailable = unchecked((int)0x80041708), NoMoreText = unchecked((int)0x80041701), LastText = 0x00041709, ChunkText = 1;

    [DllImport("query.dll", CharSet = CharSet.Unicode)]
    static extern int LoadIFilter(string path, IntPtr outer, out IntPtr filter);

    [StructLayout(LayoutKind.Sequential)]
    struct FullPropSpec
    {
        public Guid PropSet;
        public uint Kind;
        public IntPtr Value;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct StatChunk
    {
        public uint Id;
        public int BreakType;
        public int Flags;
        public uint Locale;
        public FullPropSpec Attribute;
        public uint IdSource;
        public uint StartSource;
        public uint LengthSource;
    }

    [ComImport, Guid("89BCB740-6119-101A-BCB7-00DD010655AF"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFilter
    {
        [PreserveSig] int Init(int flags, int attributeCount, IntPtr attributes, out int filterFlags);
        [PreserveSig] int GetChunk(out StatChunk chunk);
        [PreserveSig] int GetText(ref int size, [Out, MarshalAs(UnmanagedType.LPArray)] char[] buffer);
        [PreserveSig] int GetValue(out IntPtr value);
        [PreserveSig] int BindRegion(IntPtr region, ref Guid iid, out IntPtr unknown);
    }
}
