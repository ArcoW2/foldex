using System.Text;
using Foldex.Shell;

namespace Foldex.Tests;

// Foldex's own preview (Shell/OwnPreview.cs): a file of an extension it does not know is shown as text when it is text.
public class OwnPreviewTests
{
    [Fact]
    public void PlainTextAndTextWithAByteOrderMarkLookLikeText()
    {
        Assert.True(OwnPreview.LooksLikeText(Encoding.UTF8.GetBytes("menu(title='Copy')\r\n{\r\n\titem(cmd='x')\r\n}\r\n")));
        Assert.True(OwnPreview.LooksLikeText(Encoding.UTF8.GetBytes("café € 10")));
        Assert.True(OwnPreview.LooksLikeText([0xFF, 0xFE, (byte)'a', 0, (byte)'b', 0]));   // UTF-16 with its mark: NULs allowed
    }

    [Fact]
    public void BinaryAndEmptyDoNotLookLikeText()
    {
        Assert.False(OwnPreview.LooksLikeText([0x4D, 0x5A, 0x90, 0x00, 0x03]));   // an exe's start
        Assert.False(OwnPreview.LooksLikeText(Enumerable.Range(1, 200).Select(i => (byte)(i % 8 == 0 ? 2 : 'a')).ToArray()));
        Assert.False(OwnPreview.LooksLikeText([]));
    }

    [Fact]
    public void TextIsDecodedByItsMarkElseAsUtf8ElseAsLatin1()
    {
        Assert.Equal("ab", OwnPreview.Decode([0xEF, 0xBB, 0xBF, (byte)'a', (byte)'b']));
        Assert.Equal("ab", OwnPreview.Decode([0xFF, 0xFE, (byte)'a', 0, (byte)'b', 0]));
        Assert.Equal("ab", OwnPreview.Decode([0xFE, 0xFF, 0, (byte)'a', 0, (byte)'b']));
        Assert.Equal("café", OwnPreview.Decode(Encoding.UTF8.GetBytes("café")));
        Assert.Equal("café", OwnPreview.Decode([(byte)'c', (byte)'a', (byte)'f', 0xE9]));   // ANSI
    }

    [Fact]
    public void ACharacterCutOffAtTheEndIsLeftOutNotTheWholeTextReadAsLatin1()
    {
        var bytes = Encoding.UTF8.GetBytes("café €");
        Assert.Equal("café ", OwnPreview.Decode(bytes.AsSpan(0, bytes.Length - 1), cut: true));
    }

    [Fact]
    public void AFileOfAnUnknownExtensionIsShownAsTextWhenItIsText()
    {
        var dir = Directory.CreateTempSubdirectory("foldex-own-").FullName;
        try
        {
            var text = Path.Combine(dir, "shell.nss");
            File.WriteAllText(text, "menu(title='Copy')\r\n");
            var own = OwnPreview.Read(text);
            Assert.Equal("text", own?["kind"]?.GetValue<string>());
            Assert.Equal("menu(title='Copy')\r\n", own?["text"]?.GetValue<string>());

            var binary = Path.Combine(dir, "data.nss");
            File.WriteAllBytes(binary, [0x4D, 0x5A, 0x90, 0x00, 0x03]);
            Assert.Null(OwnPreview.Read(binary, hex: false));   // the host tries Windows' picture of it first
            var hex = OwnPreview.Read(binary);
            Assert.Equal("hex", hex?["kind"]?.GetValue<string>());
            Assert.Equal(Convert.ToBase64String([0x4D, 0x5A, 0x90, 0x00, 0x03]), hex?["bytes"]?.GetValue<string>());
        }
        finally { Directory.Delete(dir, true); }
    }

    // The viewer per type (docs/plans/executed/04-PLAN-preview.md 3.1).
    [Theory]
    [InlineData("a.png", "image"), InlineData("a.SVG", "image"), InlineData("a.mp4", "video"), InlineData("a.flac", "audio"),
     InlineData("a.pdf", "pdf"), InlineData("a.md", "markdown"), InlineData("a.htm", "html"), InlineData("a.tsv", "csv"),
     InlineData("a.zip", "zip"), InlineData("a.cs", "code"), InlineData("a.pas", "code"), InlineData("a.log", "text"),
     InlineData("a.docx", null), InlineData("a", null)]
    public void KindByExtension(string name, string? kind) => Assert.Equal(kind, OwnPreview.KindOf(name));

    // The setting previewWindowsTypes: extensions with or without a dot or star, separated by ; , or spaces.
    [Fact]
    public void WindowsFirstByTheSetting()
    {
        Assert.True(OwnPreview.WindowsFirst(@"C:\x\a.PDF", ".pdf; .svg"));
        Assert.True(OwnPreview.WindowsFirst(@"C:\x\a.svg", "pdf,*.svg"));
        Assert.False(OwnPreview.WindowsFirst(@"C:\x\a.md", ".pdf .svg"));
        Assert.False(OwnPreview.WindowsFirst(@"C:\x\a.pdf", ""));
        Assert.False(OwnPreview.WindowsFirst(@"C:\x\a.pdf", null));
    }

    // Large files: only the start is read (said to be cut); Show all reads it all. A zip's listing; code's language; a
    // file's properties; a folder's summary.
    [Fact]
    public void ReadsTheStartListingsAndSummaries()
    {
        var dir = Path.Combine(Path.GetTempPath(), "foldex-own-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(dir, "sub"));
        try
        {
            var big = Path.Combine(dir, "big.txt");
            File.WriteAllText(big, new string('x', 5000));
            var start = OwnPreview.Read(big, textBytes: 1024)!;
            Assert.Equal(1024, start["text"]!.GetValue<string>().Length);
            Assert.True(start["cut"]!.GetValue<bool>());
            var all = OwnPreview.Read(big, textBytes: OwnPreview.AllBytes)!;
            Assert.Equal(5000, all["text"]!.GetValue<string>().Length);
            Assert.False(all["cut"]!.GetValue<bool>());

            var code = Path.Combine(dir, "a.cs");
            File.WriteAllText(code, "class A { }");
            Assert.Equal("csharp", OwnPreview.Read(code)!["lang"]!.GetValue<string>());

            var zip = Path.Combine(dir, "a.zip");
            using (var z = System.IO.Compression.ZipFile.Open(zip, System.IO.Compression.ZipArchiveMode.Create))
                using (var w = new StreamWriter(z.CreateEntry("in/b.txt").Open())) w.Write("hello");
            var listing = OwnPreview.Read(zip)!;
            Assert.Equal("zip", listing["kind"]!.GetValue<string>());
            Assert.Equal("in/b.txt", listing["entries"]![0]!["name"]!.GetValue<string>());
            Assert.Equal(5, listing["entries"]![0]!["size"]!.GetValue<long>());

            var props = OwnPreview.Properties(code);
            Assert.Equal("properties", props["kind"]!.GetValue<string>());
            Assert.Equal(11, props["size"]!.GetValue<long>());

            var folder = OwnPreview.Folder(dir)!;
            Assert.Equal(1, folder["folders"]!.GetValue<long>());
            Assert.Equal(3, folder["files"]!.GetValue<long>());
            Assert.Contains(folder["types"]!.AsArray(), t => t!["type"]!.GetValue<string>() == ".zip");
        }
        finally { Directory.Delete(dir, true); }
    }
}
