using System.Reflection;
using Microsoft.Web.WebView2.Core;

namespace Foldex;

/// <summary>
/// The page's files (web\ in the project: index.html, the scripts, app.css): built into the exe as resources, so
/// nothing of the page lies next to it (as LexPen's). A window serves them at https://foldex.example/ from there. A
/// debug build serves the project's own web\ folder instead, so an edit applies on a reload, without a build.
/// </summary>
static class WebFiles
{
    public const string Host = "foldex.example";
    // The same files for the panes' pages in their frames, as another site, so the browser runs a pane in a process of
    // its own (docs/plans/executed/14-PLAN-floating-panes.md 3.0; as LexPen's).
    public const string PaneHost = "foldex-panes.example";
    const string Prefix = "web\\";   // the resource names: web\app.css (Foldex.csproj)

    static readonly Assembly Assembly = typeof(WebFiles).Assembly;
    static readonly Dictionary<string, string> Names = Assembly.GetManifestResourceNames()
        .Where(n => n.StartsWith(Prefix, StringComparison.Ordinal))
        .ToDictionary(n => n[Prefix.Length..].Replace('\\', '/'), n => n, StringComparer.OrdinalIgnoreCase);

#if DEBUG
    static readonly string? ProjectWeb = AppHost.FindProjectFolder(AppContext.BaseDirectory, "web");
#else
    static readonly string? ProjectWeb = null;   // readonly, not const: a const null makes every test of it a warning
#endif

    static readonly Dictionary<string, string> Types = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8", [".js"] = "text/javascript; charset=utf-8", [".css"] = "text/css; charset=utf-8",
        [".json"] = "application/json; charset=utf-8", [".svg"] = "image/svg+xml", [".png"] = "image/png",
        [".woff2"] = "font/woff2", [".woff"] = "font/woff", [".ttf"] = "font/ttf", [".mjs"] = "text/javascript; charset=utf-8",
        [".wasm"] = "application/wasm",
    };

    /// <summary>The content type of a file by its extension.</summary>
    public static string ContentType(string path) => Types.GetValueOrDefault(Path.GetExtension(path), "application/octet-stream");

    /// <summary>The paths of all the page's files, as a URL names them ("app.css").</summary>
    public static IEnumerable<string> Paths => Names.Keys;

    /// <summary>One of the page's files ("app.css"), or null when there is none.</summary>
    public static Stream? Open(string path)
    {
        path = path.TrimStart('/');
        if (ProjectWeb is not null)
        {
            var file = Path.GetFullPath(Path.Combine(ProjectWeb, path));
            return file.StartsWith(ProjectWeb + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && File.Exists(file) ? File.OpenRead(file) : null;
        }
        return Resource(path);
    }

    /// <summary>One of the page's files from the exe's resources (a release build always; the tests).</summary>
    internal static Stream? Resource(string path) =>
        Names.TryGetValue(path.TrimStart('/'), out var name) ? Assembly.GetManifestResourceStream(name) : null;

    /// <summary>
    /// The browser's own right-click menu (Back, Refresh, Save as, ...) is not Foldex's: it shows only on a text field
    /// or a selection (Cut, Copy, Paste), never with Print. False: none shown.
    /// </summary>
    public static bool BrowserMenu(CoreWebView2ContextMenuRequestedEventArgs m)
    {
        if (!m.ContextMenuTarget.IsEditable && !m.ContextMenuTarget.HasSelection) { m.Handled = true; return false; }
        foreach (var item in m.MenuItems.Where(i => i.Name == "print").ToList()) m.MenuItems.Remove(item);
        return true;
    }

    /// <summary>Makes a WebView2 serve the page at https://foldex.example/, and the panes' pages at
    /// https://foldex-panes.example/ (the same files).</summary>
    public static void Serve(CoreWebView2 core)
    {
        if (ProjectWeb is not null)
        {
            core.SetVirtualHostNameToFolderMapping(Host, ProjectWeb, CoreWebView2HostResourceAccessKind.Deny);
            // DenyCors: the page may show it in a frame (a cross-origin load); fetches from other origins stay refused.
            core.SetVirtualHostNameToFolderMapping(PaneHost, ProjectWeb, CoreWebView2HostResourceAccessKind.DenyCors);
            return;
        }
        core.AddWebResourceRequestedFilter($"https://{Host}/*", CoreWebView2WebResourceContext.All);
        // All source kinds: the panes' frames run in a process of their own, and the filter without them only catches
        // the main page's requests (as LexPen found: the frame's document loaded, its scripts did not).
        core.AddWebResourceRequestedFilter($"https://{PaneHost}/*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
        core.WebResourceRequested += (_, e) =>
        {
            var uri = new Uri(e.Request.Uri);
            if (!uri.Host.Equals(Host, StringComparison.OrdinalIgnoreCase) && !uri.Host.Equals(PaneHost, StringComparison.OrdinalIgnoreCase)) return;
            var path = Uri.UnescapeDataString(uri.AbsolutePath);
            var stream = Open(path);
            e.Response = stream is null
                ? core.Environment.CreateWebResourceResponse(null, 404, "Not Found", "")
                : core.Environment.CreateWebResourceResponse(stream, 200, "OK", $"Content-Type: {ContentType(path)}");
        };
    }
}
