using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Foldex.Shell;

/// <summary>
/// Shell property columns (docs/plans/executed/11-PLAN-columns.md 3.1): every property of Windows' property system that can be
/// a column, with its display name, and the values of given properties for given items, read through each item's
/// property store and formatted as Explorer shows them. Run on an STA thread.
/// </summary>
static class ShellProps
{
    /// <summary>Every property that can be a column: [{ name (canonical), title, kind (text, number, date) }].</summary>
    public static JsonArray List()
    {
        var list = new JsonArray();
        var iid = typeof(IPropertyDescriptionList).GUID;
        if (PSEnumeratePropertyDescriptions(PdefColumn, ref iid, out var descriptions) < 0) return list;
        try
        {
            descriptions.GetCount(out var count);
            var descIid = typeof(IPropertyDescription).GUID;
            for (uint i = 0; i < count; i++)
            {
                if (descriptions.GetAt(i, ref descIid, out var description) < 0) continue;
                try
                {
                    if (description.GetCanonicalName(out var name) < 0 || description.GetDisplayName(out var title) < 0
                        || string.IsNullOrEmpty(title)) continue;
                    description.GetDisplayType(out var display);
                    list.Add(new JsonObject
                    {
                        ["name"] = name,
                        ["title"] = title,
                        ["kind"] = display switch { 1 => "number", 3 => "date", _ => "text" },
                    });
                }
                finally { Marshal.ReleaseComObject(description); }
            }
        }
        finally { Marshal.ReleaseComObject(descriptions); }
        return list;
    }

    /// <summary>The values of `names` for each of `ids`: { id: { name: [shown, raw] } }; raw a number (dates in ms
    /// since 1970) or null, for sorting. An item without a value for a property has none for it.</summary>
    public static JsonObject Values(IEnumerable<string> ids, IReadOnlyList<string> names)
    {
        var keys = new List<(string Name, PropertyKey Key)>();
        foreach (var name in names)
            if (PSGetPropertyKeyFromName(name, out var key) >= 0) keys.Add((name, key));
        var result = new JsonObject();
        var iid = typeof(IPropertyStore).GUID;
        foreach (var id in ids)
        {
            var values = new JsonObject();
            result[id] = values;
            if (SHGetPropertyStoreFromParsingName(id, IntPtr.Zero, GpsBestEffort, ref iid, out var store) < 0) continue;
            try
            {
                foreach (var (name, k) in keys)
                {
                    var key = k;
                    if (store.GetValue(ref key, out var value) < 0) continue;
                    try
                    {
                        if (value.vt == 0) continue;   // empty
                        // Without the direction marks Windows puts around some values ("40 x 30" between them).
                        var shown = PSFormatForDisplayAlloc(ref key, ref value, 0, out var text) >= 0
                            ? DirectionMarks.Replace(text, "") : null;
                        double? raw = value.vt == VtFiletime ? DateTimeOffset.FromFileTime(value.l).ToUnixTimeMilliseconds()
                            : NumberTypes.Contains(value.vt) && PropVariantToDouble(ref value, out var d) >= 0 ? d : null;
                        values[name] = new JsonArray(shown, raw);
                    }
                    finally { PropVariantClear(ref value); }
                }
            }
            finally { Marshal.ReleaseComObject(store); }
        }
        return result;
    }

    static readonly System.Text.RegularExpressions.Regex DirectionMarks = new("[\u200E\u200F\u202A-\u202E]");

    const int PdefColumn = 6, GpsBestEffort = 0x40;
    const ushort VtFiletime = 64;
    static readonly HashSet<ushort> NumberTypes = [2, 3, 4, 5, 16, 17, 18, 19, 20, 21, 22, 23];

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    struct PropertyKey
    {
        public Guid fmtid;
        public uint pid;
    }

    // PROPVARIANT: the type, then 8 bytes of padding, then the value (16 bytes on x64).
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public long l;
    }

    [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
    }

    [ComImport, Guid("1f9fc1d0-c39b-4b26-817f-011967d3440e"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyDescriptionList
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, ref Guid riid, out IPropertyDescription description);
    }

    // Only the first methods, in their order; the rest are not called.
    [ComImport, Guid("6f79d558-3e96-4549-a1d1-7d75d2288814"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyDescription
    {
        [PreserveSig] int GetPropertyKey(out PropertyKey key);
        [PreserveSig] int GetCanonicalName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int GetPropertyType(out ushort vt);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int GetEditInvitation(out IntPtr invitation);
        [PreserveSig] int GetTypeFlags(int mask, out int flags);
        [PreserveSig] int GetViewFlags(out int flags);
        [PreserveSig] int GetDefaultColumnWidth(out uint chars);
        [PreserveSig] int GetDisplayType(out int display);
    }

    [DllImport("propsys.dll")]
    static extern int PSEnumeratePropertyDescriptions(int filter, ref Guid riid, out IPropertyDescriptionList list);

    [DllImport("propsys.dll", CharSet = CharSet.Unicode)]
    static extern int PSGetPropertyKeyFromName(string name, out PropertyKey key);

    [DllImport("propsys.dll", CharSet = CharSet.Unicode)]
    static extern int PSFormatForDisplayAlloc(ref PropertyKey key, ref PropVariant value, int flags,
        [MarshalAs(UnmanagedType.LPWStr)] out string text);

    [DllImport("propsys.dll")]
    static extern int PropVariantToDouble(ref PropVariant value, out double d);

    [DllImport("ole32.dll")]
    static extern int PropVariantClear(ref PropVariant value);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHGetPropertyStoreFromParsingName(string path, IntPtr bindContext, int flags, ref Guid riid,
        out IPropertyStore store);
}
