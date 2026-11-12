using System.Drawing.Imaging;
using System.Text.Json;
using Foldex.Shell;

namespace Foldex.Tests;

// Thumbnails (docs/plans/executed/22-PLAN-thumbnails.md): the layouts of web/thumbs.js under Jint, and the host's cache.
public class ThumbnailTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-thumbs-" + Guid.NewGuid().ToString("N"));
    string Data => Path.Combine(dir, "data");
    string Pics => Path.Combine(dir, "pics");

    public ThumbnailTests() => Directory.CreateDirectory(Pics);

    public void Dispose() => Directory.Delete(dir, true);

    static readonly string Web = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!;

    static JsonElement Js(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(File.ReadAllText(Path.Combine(Web, "thumbs.js")));
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    const string Opts = "{ line: 20, names: true, info: 3, card: 240 }";
    const string NoNames = "{ line: 20, names: false, info: 3, card: 240 }";

    [Fact]
    public void AGridHasEqualCellsAsManyAcrossAsFit()
    {
        // 100 px cells and a 6 px gap in 330 px: three across; a name line under each.
        var r = Js($"thumbLayout('grid-cut', [1, 2, 0.5, 1], 330, 100, {Opts}).boxes.map(b => [b.x, b.y, b.w, b.h])");
        Assert.Equal("[[0,0,100,120],[106,0,100,120],[212,0,100,120],[0,126,100,120]]", r.GetRawText());
    }

    [Fact]
    public void AMosaicPutsEachImageInTheShortestColumnAtItsProportions()
    {
        // Two columns of 97 px in 200 px; a tall one (0.5) is 194 px high, so the next ones go to the other column.
        var r = Js("thumbLayout('mosaic', [0.5, 1, 1, 1], 200, 97, " + NoNames + ").boxes.map(b => [b.x, Math.round(b.y), Math.round(b.h)])");
        Assert.Equal("[[0,0,194],[103,0,97],[103,103,97],[0,200,97]]", r.GetRawText());
    }

    [Fact]
    public void ARiverFillsEachFullRowExactlyAndLeavesTheLastAsItIs()
    {
        var r = Js("(() => { const l = thumbLayout('river', [1, 1, 1, 2, 1], 400, 100, " + NoNames + "); const rows = {};" +
            " for (const b of l.boxes) (rows[Math.round(b.y)] ??= []).push(b);" +
            " return Object.values(rows).map(row => [row.length, Math.round(row.at(-1).x + row.at(-1).w), Math.round(row[0].ih)]); })()");
        // Row 1: three squares fill 400 px (each a little larger); row 2, the last: 2:1 and 1:1 at 100 px, not stretched.
        Assert.Equal("[[3,400,129],[2,306,100]]", r.GetRawText());
    }

    [Fact]
    public void DetailsAreOnePerLineAndCardsAsManyAsFit()
    {
        var r = Js($"[thumbLayout('details', [1, 1], 500, 80, {Opts}).boxes.map(b => [b.y, b.tx]), thumbLayout('cards', [1, 1, 1], 500, 120, {Opts}).boxes.map(b => [b.x, b.y])]");
        Assert.Equal("[[[0,92],[86,92]],[[0,0],[246,0],[0,192]]]", r.GetRawText());
    }

    [Fact]
    public void TheArrowsGoToTheNearestItemAboveOrBelow()
    {
        var r = Js("(() => { const { boxes } = thumbLayout('mosaic', [0.5, 1, 1, 1], 200, 97, " + NoNames + ");" +
            " return [thumbNeighbour(boxes, 1, 'ArrowDown'), thumbNeighbour(boxes, 2, 'ArrowUp'), thumbNeighbour(boxes, 0, 'ArrowDown')," +
            " thumbNeighbour(boxes, 0, 'ArrowRight'), thumbNeighbour(boxes, 0, 'ArrowLeft')]; })()");
        Assert.Equal("[2,1,3,1,0]", r.GetRawText());
    }

    [Fact]
    public void RawFilesAreKnownByTheirExtension()
    {
        Assert.Equal("[true,true,false]", Js("[isRaw('a.CR2'), isRaw('b.dng'), isRaw('c.jpg')]").GetRawText());
    }

    // ---------- The host's cache ----------

    string Jpeg(string name, int w, int h)
    {
        var path = Path.Combine(Pics, name);
        using var b = new Bitmap(w, h);
        using (var g = Graphics.FromImage(b)) g.Clear(Color.SteelBlue);
        b.Save(path, ImageFormat.Jpeg);
        return path;
    }

    [Fact]
    public async Task AThumbnailIsMadeOnceKeptAndMadeAgainWhenTheFileChanges()
    {
        var path = Jpeg("a.jpg", 800, 400);
        var first = await StaWorker.Once("t", () => Thumbnails.Get(path, 192, Data, false));
        Assert.NotNull(first.Url);
        Assert.Equal(2.0, (double)first.Width / first.Height, 1);   // its proportions kept
        var cache = Thumbnails.CacheDir(Data);
        Assert.Single(Directory.GetFiles(cache));
        var again = await StaWorker.Once("t", () => Thumbnails.Get(path, 192, Data, false));
        Assert.Equal(first.Url, again.Url);
        Assert.Single(Directory.GetFiles(cache));   // found, not made anew
        File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddMinutes(1));   // changed
        await StaWorker.Once("t", () => Thumbnails.Get(path, 192, Data, false));
        Assert.Equal(2, Directory.GetFiles(cache).Length);
        Assert.False(Directory.Exists(Path.Combine(Pics, Thumbnails.FolderCache)));   // nothing next to the images
    }

    [Fact]
    public async Task NextToTheImagesTheCacheIsAHiddenFolder()
    {
        var path = Jpeg("b.jpg", 300, 600);
        await StaWorker.Once("t", () => Thumbnails.Get(path, 96, Data, true));
        var folder = new DirectoryInfo(Path.Combine(Pics, Thumbnails.FolderCache));
        Assert.True(folder.Exists);
        Assert.True(folder.Attributes.HasFlag(FileAttributes.Hidden));
        Assert.False(Directory.Exists(Thumbnails.CacheDir(Data)));
    }

    [Fact]
    public async Task AFileWithoutAThumbnailGetsNone()
    {
        var path = Path.Combine(Pics, "notes.txt");
        File.WriteAllText(path, "hello");
        var t = await StaWorker.Once("t", () => Thumbnails.Get(path, 96, Data, false));
        Assert.Null(t.Url);
    }

    [Fact]
    public void TrimmingRemovesTheThumbnailsUsedLongestAgo()
    {
        var cache = Thumbnails.CacheDir(Data);
        Directory.CreateDirectory(cache);
        for (var k = 0; k < 10; k++)
        {
            var f = Path.Combine(cache, $"{k}.jpg");
            File.WriteAllBytes(f, new byte[1000]);
            File.SetLastWriteTimeUtc(f, DateTime.UtcNow.AddMinutes(k));   // 0 used longest ago
        }
        Assert.Equal(10000, Thumbnails.Trim(Data, 5000));
        var left = Directory.GetFiles(cache).Select(Path.GetFileNameWithoutExtension).Order().ToArray();
        Assert.Equal(["6", "7", "8", "9"], left);   // down to nine tenths of the limit: 4000 bytes
    }
}
