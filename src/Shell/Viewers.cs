using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Win32;

namespace Foldex.Shell;

/// <summary>
/// The viewers a file can be shown in (docs/plans/33-PLAN-preview-plugins.md 3.1), in this order: Foldex's own viewer,
/// the Windows preview handler of its type, LexPen's preview handler for the types LexPen lists (3.3), and each lister
/// plugin whose detect string takes the file (3.2). The one shown: the one asked for (the bar's drop-down,
/// preview.nextViewer), else the one kept for the extension (the setting previewViewers), else the first.
/// </summary>
static class Viewers
{
    public record Viewer(string Id, string Name);

    public const string Foldex = "foldex", Windows = "windows", LexPen = "lexpen", ListerPrefix = "lister:";

    /// <summary>The viewers of a file. `windows`: the CLSID of its type's preview handler (PreviewHost.HandlerFor);
    /// `lexPen`: LexPen's handler, when installed; `listers`: the known plugins. Touches the file for a plugin whose
    /// detect string looks at its contents or size: off the window's thread.</summary>
    public static List<Viewer> For(string path, Guid? windows, LexPenHandler? lexPen, IEnumerable<Lister> listers)
    {
        var list = new List<Viewer>();
        var ext = Path.GetExtension(path);
        if (OwnPreview.KindOf(path) is not null) list.Add(new(Foldex, "Foldex"));
        var ours = lexPen is not null && ext.Length > 0 && lexPen.Extensions.Contains(ext);
        // LexPen's handler bound to the type for Explorer as well: offered once, as LexPen.
        if (windows is Guid clsid && !(ours && clsid == lexPen!.Clsid)) list.Add(new(Windows, "Windows"));
        if (ours) list.Add(new(LexPen, "LexPen"));
        var file = new Lazy<(long Size, byte[] Head)>(() => Head(path));
        foreach (var l in listers)
            if (ListerDetect.Matches(l.Detect, path, () => file.Value.Size, () => file.Value.Head)) list.Add(new(ListerPrefix + l.Name, l.Name));
        return list;
    }

    /// <summary>The viewer to show: `asked` when the file has it, else the one `kept` for its extension, else the first
    /// (Foldex's own, else Windows, else LexPen, else a plugin); null when there is none.</summary>
    public static string? Pick(IReadOnlyList<Viewer> viewers, string? asked, JsonObject? kept, string path)
    {
        bool Has(string? id) => id is not null && viewers.Any(v => v.Id == id);
        if (Has(asked)) return asked;
        var ext = Path.GetExtension(path).ToLowerInvariant();
        if (ext.Length > 0 && kept?[ext] is JsonValue v && v.TryGetValue<string>(out var id) && Has(id)) return id;
        return viewers.FirstOrDefault()?.Id;
    }

    /// <summary>The old setting previewWindowsTypes (".pdf; .svg") as previewViewers: each extension Windows' handler.</summary>
    public static JsonObject FromWindowsTypes(string? types)
    {
        var o = new JsonObject();
        foreach (var t in (types ?? "").Split([';', ',', ' '], StringSplitOptions.RemoveEmptyEntries))
            o["." + t.TrimStart('*', '.').ToLowerInvariant()] = Windows;
        return o;
    }

    // The size of a file and its first bytes (for FIND and [n] of a detect string).
    const int HeadBytes = 8192;
    static (long, byte[]) Head(string path)
    {
        try
        {
            using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            var buffer = new byte[Math.Min(HeadBytes, file.Length)];
            var read = file.ReadAtLeast(buffer, buffer.Length, false);
            return (file.Length, buffer[..read]);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { return (0, []); }
    }
}

/// <summary>
/// LexPen's preview handler (docs/plans/33-PLAN-preview-plugins.md 3.3), as LexPen registers it without binding it to
/// any type: Applications\LexPen.exe\shellex\{8895b1c6-b41f-4c1c-a562-0d564250836f} names its CLSID, and the value
/// PreviewExtensions under CLSID\{clsid} lists the extensions it shows (".md;.cs;...").
/// </summary>
sealed record LexPenHandler(Guid Clsid, HashSet<string> Extensions)
{
    const string Key = @"Applications\LexPen.exe\shellex\" + Native.PreviewHandlerKey;

    public static LexPenHandler? Find()
    {
        if (Registry.ClassesRoot.OpenSubKey(Key)?.GetValue("") is not string text || !Guid.TryParse(text, out var clsid)) return null;
        var list = Registry.ClassesRoot.OpenSubKey($@"CLSID\{clsid:B}")?.GetValue("PreviewExtensions") as string;
        return new LexPenHandler(clsid, Parse(list));
    }

    internal static HashSet<string> Parse(string? list) =>
        new((list ?? "").Split([';', ',', ' '], StringSplitOptions.RemoveEmptyEntries).Select(e => "." + e.TrimStart('*', '.')),
            StringComparer.OrdinalIgnoreCase);
}

/// <summary>A lister plugin as Foldex knows it (3.2): its DLL, its name (the file's) and its detect string.</summary>
sealed record Lister(string Path, string Name, string Detect);

/// <summary>
/// A Total Commander lister plugin's detect string (3.2), as ListGetDetectString gives it: EXT="TXT" | EXT="LOG",
/// SIZE&lt;100000, FIND("text"), FINDI("text") (in the first 8 KB), [0]=77 (a byte), with &amp;, |, !, AND, OR, NOT and
/// brackets. An empty string takes every file (as Total Commander tries such a plugin on all). MULTIMEDIA and FORCE
/// (Total Commander's own cases) are never true here; anything not understood takes no file.
/// </summary>
static class ListerDetect
{
    public static bool Matches(string detect, string path, Func<long> size, Func<byte[]> head)
    {
        if (string.IsNullOrWhiteSpace(detect)) return true;
        try
        {
            var p = new Parser(Tokens(detect), path, size, head);
            var result = p.Or();
            return p.AtEnd && result;
        }
        catch (FormatException) { return false; }
    }

    record Token(char Kind, string Text);   // 'w' word, 's' string, 'n' number, else the symbol itself (< > = ! & | ( ) [ ] and 'l' <=, 'g' >=, 'x' !=)

    static List<Token> Tokens(string s)
    {
        var list = new List<Token>();
        for (var i = 0; i < s.Length;)
        {
            var c = s[i];
            if (char.IsWhiteSpace(c)) { i++; continue; }
            if (c == '"')
            {
                var end = s.IndexOf('"', i + 1);
                if (end < 0) throw new FormatException();
                list.Add(new('s', s[(i + 1)..end]));
                i = end + 1;
            }
            else if (char.IsDigit(c))
            {
                var start = i;
                while (i < s.Length && char.IsDigit(s[i])) i++;
                list.Add(new('n', s[start..i]));
            }
            else if (char.IsLetter(c))
            {
                var start = i;
                while (i < s.Length && (char.IsLetterOrDigit(s[i]) || s[i] == '_')) i++;
                list.Add(new('w', s[start..i].ToUpperInvariant()));
            }
            else if (i + 1 < s.Length && s[i + 1] == '=' && c is '<' or '>' or '!')
            {
                list.Add(new(c == '<' ? 'l' : c == '>' ? 'g' : 'x', s.Substring(i, 2)));
                i += 2;
            }
            else if ("<>=!&|()[]".Contains(c)) { list.Add(new(c, c.ToString())); i++; }
            else throw new FormatException();
        }
        return list;
    }

    sealed class Parser(List<Token> tokens, string path, Func<long> size, Func<byte[]> head)
    {
        int at;
        public bool AtEnd => at == tokens.Count;
        Token? Peek => at < tokens.Count ? tokens[at] : null;
        Token Next() => at < tokens.Count ? tokens[at++] : throw new FormatException();
        bool Take(char kind, string? word = null)
        {
            if (Peek is { } t && t.Kind == kind && (word is null || t.Text == word)) { at++; return true; }
            return false;
        }
        void Expect(char kind) { if (!Take(kind)) throw new FormatException(); }

        public bool Or()
        {
            var v = And();
            while (Take('|') || Take('w', "OR")) v = And() | v;
            return v;
        }

        bool And()
        {
            var v = Not();
            while (Take('&') || Take('w', "AND")) v = Not() & v;
            return v;
        }

        bool Not() => Take('!') || Take('w', "NOT") ? !Not() : Primary();

        bool Primary()
        {
            if (Take('('))
            {
                var v = Or();
                Expect(')');
                return v;
            }
            if (Peek is { Kind: 'w', Text: "FIND" or "FINDI" } f)
            {
                at++;
                Expect('(');
                var text = Next();
                if (text.Kind != 's') throw new FormatException();
                Expect(')');
                return Find(text.Text, f.Text == "FINDI");
            }
            if (Take('w', "MULTIMEDIA") || Take('w', "FORCE")) return false;
            var left = Operand();
            var op = Next();
            if (op.Kind is not ('=' or 'x' or '<' or '>' or 'l' or 'g')) throw new FormatException();
            return Compare(left, op.Kind, Operand());
        }

        // EXT (the extension without its dot), SIZE, [n] (the byte at n, or -1 past the end), a "string" or a number.
        object Operand()
        {
            var t = Next();
            switch (t.Kind)
            {
                case 's': return t.Text;
                case 'n': return long.Parse(t.Text);
                case 'w' when t.Text == "EXT": return Path.GetExtension(path).TrimStart('.');
                case 'w' when t.Text == "SIZE": return size();
                case '[':
                    var n = Next();
                    if (n.Kind != 'n') throw new FormatException();
                    Expect(']');
                    var bytes = head();
                    var k = long.Parse(n.Text);
                    return k < bytes.Length ? (long)bytes[k] : -1L;
                default: throw new FormatException();
            }
        }

        static bool Compare(object a, char op, object b)
        {
            int c;
            if (a is long x && b is long y) c = x.CompareTo(y);
            else if (a is long n && b is string s && s.Length == 1) c = n.CompareTo((long)s[0]);   // [0]="M"
            else if (a is string s1 && b is long n1 && s1.Length == 1) c = ((long)s1[0]).CompareTo(n1);
            else c = string.Compare(a.ToString(), b.ToString(), StringComparison.OrdinalIgnoreCase);
            return op switch { '=' => c == 0, 'x' => c != 0, '<' => c < 0, '>' => c > 0, 'l' => c <= 0, _ => c >= 0 };
        }

        bool Find(string text, bool anyCase)
        {
            var hay = Encoding.Latin1.GetString(head());
            return hay.Contains(text, anyCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        }
    }
}
