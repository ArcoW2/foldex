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
            Assert.Null(OwnPreview.Read(binary));
        }
        finally { Directory.Delete(dir, true); }
    }
}
