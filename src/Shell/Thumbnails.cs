using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Foldex.Shell;

/// <summary>
/// Foldex's own thumbnail cache (docs/plans/executed/22-PLAN-thumbnails.md 3.1), as FastStone has one: a thumbnail is made once
/// from what Windows gives for the item (IShellItemImageFactory: the thumbnail handlers of Explorer) and kept as a
/// JPEG (a PNG when it has transparency), by the item's path, its size and date changed, and the thumbnail size. A
/// changed file gets a new key, so a stale thumbnail is never found; the oldest go when the cache grows past its size.
/// Kept in Foldex's data folder (State\Thumbnails), or in a hidden .foldex-thumbs folder next to the images.
/// </summary>
static class Thumbnails
{
    /// <summary>The sizes made, in px (the longer side); the page draws from the nearest one not smaller.</summary>
    public static readonly int[] Sizes = [96, 192, 384];

    public const string FolderCache = ".foldex-thumbs";

    public sealed record Thumb(string? Url, int Width, int Height);

    /// <summary>A file's thumbnail at a size of <see cref="Sizes"/>: from the cache, else made and kept. Null Url:
    /// Windows has no thumbnail for it (its icon is shown). On an STA thread.</summary>
    public static Thumb Get(string path, int size, string dataDir, bool inFolder)
    {
        var info = new FileInfo(path);
        if (!info.Exists) return new Thumb(null, 0, 0);
        var dir = inFolder ? Path.Combine(info.DirectoryName!, FolderCache) : CacheDir(dataDir);
        var key = Key(path, info.Length, info.LastWriteTimeUtc.Ticks, size);
        foreach (var ext in new[] { ".jpg", ".png" })
        {
            var file = Path.Combine(dir, key + ext);
            if (!File.Exists(file)) continue;
            try
            {
                File.SetLastWriteTimeUtc(file, DateTime.UtcNow);   // used now: the last to go
                var bytes = File.ReadAllBytes(file);
                using var image = Image.FromStream(new MemoryStream(bytes));
                return new Thumb(Url(bytes, ext), image.Width, image.Height);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException) { }
        }
        using var bitmap = Make(path, size);
        if (bitmap is null) return new Thumb(null, 0, 0);
        var (data, extension) = Encode(bitmap);
        try
        {
            var created = !Directory.Exists(dir);
            Directory.CreateDirectory(dir);
            if (created && inFolder) File.SetAttributes(dir, File.GetAttributes(dir) | FileAttributes.Hidden);
            File.WriteAllBytes(Path.Combine(dir, key + extension), data);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }   // shown, not kept
        return new Thumb(Url(data, extension), bitmap.Width, bitmap.Height);
    }

    /// <summary>What Windows gives as a picture of a file at `size` (its thumbnail handler: a PSD, a PDF, a RAW when a
    /// program put one there), not kept: for the preview of a file nothing else shows. Null when Windows has none. On
    /// an STA thread.</summary>
    public static string? Picture(string path, int size)
    {
        using var bitmap = Make(path, size);
        if (bitmap is null) return null;
        var (data, extension) = Encode(bitmap);
        return Url(data, extension);
    }

    public static string CacheDir(string dataDir) => Path.Combine(DataFolder.StateDir(dataDir), "Thumbnails");

    static string Key(string path, long length, long ticks, int size) =>
        Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes($"{path.ToLowerInvariant()}|{length}|{ticks}|{size}"))).ToLowerInvariant();

    static string Url(byte[] data, string ext) =>
        $"data:image/{(ext == ".png" ? "png" : "jpeg")};base64,{Convert.ToBase64String(data)}";

    /// <summary>The cache in Foldex's data folder back under `limit` bytes: the files used longest ago go first,
    /// down to nine tenths of it. The total before, in bytes.</summary>
    public static long Trim(string dataDir, long limit)
    {
        var dir = new DirectoryInfo(CacheDir(dataDir));
        if (!dir.Exists) return 0;
        var files = dir.GetFiles().OrderBy(f => f.LastWriteTimeUtc).ToList();
        var total = files.Sum(f => f.Length);
        var size = total;
        foreach (var f in files)
        {
            if (size <= limit * 9 / 10 || total <= limit) break;
            var length = f.Length;   // before: a deleted file has none
            try
            {
                f.Delete();
                size -= length;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        }
        return total;
    }

    // ---------- Making one ----------

    const int ThumbnailOnly = 0x8, ResizeToFit = 0x0, BiggerSizeOk = 0x1;

    // Windows' thumbnail of the item at `size` (the longer side), its proportions kept; null when it has none (no
    // icon in its place: the page shows the icon).
    static Bitmap? Make(string path, int size)
    {
        IShellItemImageFactory? factory = null;
        var hbitmap = IntPtr.Zero;
        try
        {
            var iid = typeof(IShellItemImageFactory).GUID;
            if (SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out var ppv) < 0) return null;
            factory = (IShellItemImageFactory)Marshal.GetObjectForIUnknown(ppv);
            Marshal.Release(ppv);
            if (factory.GetImage(new NativeSize { cx = size, cy = size }, ResizeToFit | BiggerSizeOk | ThumbnailOnly, out hbitmap) < 0) return null;
            return ToBitmap(hbitmap, size);
        }
        catch (COMException) { return null; }
        finally
        {
            if (hbitmap != IntPtr.Zero) DeleteObject(hbitmap);
            if (factory is not null) Marshal.ReleaseComObject(factory);
        }
    }

    // The 32-bit bitmap Windows gives (alpha premultiplied) as one with straight alpha, made smaller to `size` when it
    // came larger (BiggerSizeOk).
    static Bitmap? ToBitmap(IntPtr hbitmap, int size)
    {
        var bm = new NativeBitmap();
        if (GetObject(hbitmap, Marshal.SizeOf<NativeBitmap>(), ref bm) == 0 || bm.bmWidth <= 0 || bm.bmHeight == 0) return null;
        int w = bm.bmWidth, h = Math.Abs(bm.bmHeight);
        var header = new BitmapInfoHeader { biSize = Marshal.SizeOf<BitmapInfoHeader>(), biWidth = w, biHeight = -h, biPlanes = 1, biBitCount = 32 };
        var pixels = new byte[w * h * 4];
        var dc = GetDC(IntPtr.Zero);
        try { if (GetDIBits(dc, hbitmap, 0, (uint)h, pixels, ref header, 0) == 0) return null; }
        finally { ReleaseDC(IntPtr.Zero, dc); }
        var bitmap = new Bitmap(w, h, PixelFormat.Format32bppPArgb);
        var data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppPArgb);
        // A bitmap without alpha (all 0) is opaque.
        if (!pixels.Where((_, i) => i % 4 == 3).Any(a => a != 0)) for (var i = 3; i < pixels.Length; i += 4) pixels[i] = 255;
        Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        bitmap.UnlockBits(data);
        if (Math.Max(w, h) <= size) return bitmap;
        var scale = (double)size / Math.Max(w, h);
        var smaller = new Bitmap(Math.Max(1, (int)Math.Round(w * scale)), Math.Max(1, (int)Math.Round(h * scale)), PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(smaller))
        {
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.DrawImage(bitmap, 0, 0, smaller.Width, smaller.Height);
        }
        bitmap.Dispose();
        return smaller;
    }

    // JPEG for an opaque thumbnail (small), PNG for one with transparency.
    static (byte[] Data, string Ext) Encode(Bitmap bitmap)
    {
        var opaque = true;
        for (var y = 0; y < bitmap.Height && opaque; y += Math.Max(1, bitmap.Height / 16))
            for (var x = 0; x < bitmap.Width && opaque; x += Math.Max(1, bitmap.Width / 16))
                if (bitmap.GetPixel(x, y).A < 255) opaque = false;
        using var stream = new MemoryStream();
        if (!opaque)
        {
            bitmap.Save(stream, ImageFormat.Png);
            return (stream.ToArray(), ".png");
        }
        var jpeg = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
        using var options = new EncoderParameters(1);
        options.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 85L);
        bitmap.Save(stream, jpeg, options);
        return (stream.ToArray(), ".jpg");
    }

    [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItemImageFactory
    {
        [PreserveSig] int GetImage(NativeSize size, int flags, out IntPtr phbm);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct NativeSize { public int cx, cy; }

    [StructLayout(LayoutKind.Sequential)]
    struct NativeBitmap
    {
        public int bmType, bmWidth, bmHeight, bmWidthBytes;
        public ushort bmPlanes, bmBitsPixel;
        public IntPtr bmBits;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct BitmapInfoHeader
    {
        public int biSize, biWidth, biHeight;
        public ushort biPlanes, biBitCount;
        public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, out IntPtr ppv);

    [DllImport("gdi32.dll")]
    static extern int GetObject(IntPtr h, int size, ref NativeBitmap bm);

    [DllImport("gdi32.dll")]
    static extern int GetDIBits(IntPtr hdc, IntPtr hbm, uint start, uint lines, byte[] bits, ref BitmapInfoHeader bmi, uint usage);

    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr h);

    [DllImport("user32.dll")]
    static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("user32.dll")]
    static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
}
