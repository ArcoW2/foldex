using System.Data.OleDb;

namespace Foldex.Shell;

/// <summary>
/// The Windows Search index as a search index (docs/plans/executed/06-PLAN-search-and-scrap.md 3.4), through its OLE DB
/// provider. Null when the folder is not indexed (nothing below it in the index), the name cannot be put in its LIKE
/// syntax, or the index does not answer: the caller then walks the folders itself.
/// </summary>
static class WindowsSearch
{
    const string Connection = "Provider=Search.CollatorDSO;Extended Properties='Application=Windows'";

    public static List<string>? Search(FileSearch.Options o, string root)
    {
        var patterns = FileSearch.Patterns(o.Named);
        if (patterns.Any(p => p.IndexOfAny(['%', '_', '[', '\'']) >= 0) || root.Contains('\'')) return null;
        var scope = $"{(o.Subfolders ? "SCOPE" : "DIRECTORY")}='file:{root.TrimEnd('\\')}{(root.EndsWith(":\\") ? "\\" : "")}'";
        var kind = o.Files && !o.Folders ? " AND System.ItemType <> 'Directory'" : o.Folders && !o.Files ? " AND System.ItemType = 'Directory'" : "";
        var names = patterns.Count == 0 ? ""
            : " AND (" + string.Join(" OR ", patterns.Select(p => $"System.FileName LIKE '{Like(p)}'")) + ")";
        try
        {
            using var db = new OleDbConnection(Connection);
            db.Open();
            using (var any = new OleDbCommand($"SELECT TOP 1 System.ItemPathDisplay FROM SystemIndex WHERE {scope}", db))
            using (var reader = any.ExecuteReader())
                if (!reader.Read()) return null;
            var paths = new List<string>();
            using var query = new OleDbCommand($"SELECT System.ItemPathDisplay FROM SystemIndex WHERE {scope}{kind}{names}", db);
            using var rows = query.ExecuteReader();
            while (rows.Read())
                if (rows[0] is string path) paths.Add(path);
            return paths;
        }
        catch (Exception ex) when (ex is OleDbException or InvalidOperationException) { return null; }
    }

    // A pattern as LIKE takes it: * and ? as % and _; without them, contained anywhere.
    static string Like(string pattern) =>
        FileSearch.Wild(pattern) ? pattern.Replace('*', '%').Replace('?', '_') : $"%{pattern}%";
}
