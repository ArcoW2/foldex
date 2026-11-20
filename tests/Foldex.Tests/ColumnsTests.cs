using System.Diagnostics;
using System.Drawing;
using System.Text.Json;
using System.Text.Json.Nodes;
using Foldex.Shell;

namespace Foldex.Tests;

// Columns (docs/plans/executed/11-PLAN-columns.md): the column sets and the folders' choices (ColumnSetsFile), the rules of the
// page (web/columns.js under Jint), the Git status of a folder's items and a property read from a file.
public class ColumnsTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-columns-" + Guid.NewGuid().ToString("N"));

    public ColumnsTests() => Directory.CreateDirectory(dir);

    public void Dispose()
    {
        // A test repository's files are read-only in places (.git/objects).
        foreach (var f in Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories)) File.SetAttributes(f, FileAttributes.Normal);
        Directory.Delete(dir, true);
    }

    static string Shipped => Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "defaults")!, ColumnSetsFile.SetsName);

    static string[] Names(JsonObject r) => r["sets"]!.AsArray().Select(s => s!["name"]!.GetValue<string>()).ToArray();

    [Fact]
    public void TheShippedSetsAreThere()
    {
        var r = ColumnSetsFile.Load(dir, Shipped);
        Assert.Empty(r["problems"]!.AsArray());
        Assert.Equal(["Generic", "Dates", "Pictures", "Music", "Films", "Documents", "Git"], Names(r));
        Assert.Equal("name", r["sets"]![0]!["columns"]![0]!["id"]!.GetValue<string>());
    }

    [Fact]
    public void YoursReplaceAShippedSetByNameAddAndDelete()
    {
        File.WriteAllText(Path.Combine(dir, ColumnSetsFile.SetsName), """
            { "sets": [
              { "name": "git", "columns": [ { "id": "name" }, { "id": "git", "width": 5 } ] },
              { "name": "Films", "deleted": true },
              { "name": "Mine", "columns": [ { "id": "name", "width": 30 } ], "sort": { "id": "name", "desc": true }, "fit": true } ] }
            """);
        var r = ColumnSetsFile.Load(dir, Shipped);
        Assert.Equal(["Generic", "Dates", "Pictures", "Music", "Documents", "git", "Mine"], Names(r));
        var git = r["sets"]!.AsArray().First(s => s!["name"]!.GetValue<string>() == "git")!;
        Assert.True(git["shipped"]!.GetValue<bool>() && git["mine"]!.GetValue<bool>());
        Assert.Equal(5, git["columns"]![1]!["width"]!.GetValue<double>());
        var mine = r["sets"]!.AsArray().Last()!;
        // Written before plan 28: its sort a list of one, "fit": true every column fitting both ways (3.9).
        Assert.True(mine["sort"]![0]!["desc"]!.GetValue<bool>() && mine["columns"]![0]!["fit"]!.GetValue<string>() == "both"
            && !mine["shipped"]!.GetValue<bool>());
    }

    [Fact]
    public void AWrongEntryIsReportedAndSkipped()
    {
        var problems = new JsonArray();
        var sets = ColumnSetsFile.Sets(JsonNode.Parse("""
            { "sets": [ { "columns": [] }, { "name": "A" }, { "name": "B", "columns": [ { "width": 3 }, { "id": "size", "width": -1 } ] } ] }
            """), problems, "yours");
        Assert.Single(sets);
        Assert.Equal("""{"name":"B","columns":[{"id":"size"}]}""", sets[0].ToJsonString());
        Assert.Equal(3, problems.Count);   // no name, no columns, a column without an id
    }

    [Fact]
    public void SetsAndFoldersAreWrittenAndReadBack()
    {
        ColumnSetsFile.SaveSets(dir, JsonNode.Parse("""[ { "name": "Mine", "columns": [ { "id": "name", "width": 20 }, { "id": "ext" } ] } ]""")!);
        ColumnSetsFile.SaveFolders(dir, JsonNode.Parse("""[ { "path": "C:\\src", "set": "Git", "subfolders": true } ]""")!);
        var r = ColumnSetsFile.Load(dir, Shipped);
        Assert.Empty(r["problems"]!.AsArray());
        Assert.Contains("Mine", Names(r));
        Assert.Equal("""[{"path":"C:\\src","set":"Git","subfolders":true}]""", r["folders"]!.ToJsonString());
    }

    // ---------- web/columns.js ----------

    static readonly string Source = File.ReadAllText(Path.Combine(AppHost.FindProjectFolder(AppContext.BaseDirectory, "web")!, "columns.js"));

    static JsonElement Run(string expr)
    {
        var engine = new Jint.Engine();
        engine.Execute(Source);
        return JsonDocument.Parse(engine.Evaluate($"JSON.stringify({expr})").ToString()).RootElement;
    }

    [Fact]
    public void AFolderUsesItsOwnSetOrTheNearestAboveItWithSubfolders()
    {
        var r = Run("""
            (() => {
              const folders = [{ path: 'C:\\src', set: 'Git', subfolders: true }, { path: 'C:\\src\\app', set: 'Dates', subfolders: false },
                { path: 'C:\\pics', set: 'Pictures', subfolders: false }];
              return ['C:\\src', 'C:\\src\\app', 'C:\\src\\app\\deep', 'C:\\SRC\\lib', 'C:\\pics\\2024', 'C:\\srcx']
                .map(p => setFor(folders, p)?.set ?? null);
            })()
            """);
        Assert.Equal("""["Git","Dates","Git","Git",null,null]""", r.GetRawText());
    }

    [Fact]
    public void SortingByKind()
    {
        var r = Run("""
            (() => {
              const items = [
                { name: 'file10', size: 5, modified: 300, folder: false }, { name: 'file2', size: 50, modified: 100, folder: false },
                { name: 'b', folder: true, modified: 200 }, { name: 'file1', folder: false, modified: 200 },
                { name: 'v', folder: false, props: { 'System.Media.Duration': ['0:03', 1800000000] } },
                { name: 'w', folder: false, props: { 'System.Media.Duration': ['0:01', 600000000] } } ];
              const by = (id, desc) => [...items].sort(columnComparer(id, '', desc)).map(x => x.name).join(' ');
              return [by('name', false), by('size', false), by('size', true), by('modified', true), by('System.Media.Duration', false)];
            })()
            """);
        Assert.Equal(["b file1 file2 file10 v w", "b file10 file2 file1 v w", "b file2 file10 file1 v w",
            "b file10 file1 file2 v w", "b w v file1 file2 file10"], r.EnumerateArray().Select(x => x.GetString()));
    }

    // Fitting all (Ctrl+Shift+R; docs/plans/executed/28-PLAN-column-sets-window.md 3.6): needs of 30, 8 and 12 em; room enough:
    // as needed; 10 too little: the name 20; far too little: the name at NameMinEm (8), the rest scrolls.
    [Fact]
    public void FittingLetsTheNameGiveWayFirst()
    {
        var r = Run("""
            (() => {
              const cols = [{ id: 'name', width: 22 }, { id: 'size', width: 7 }, { id: 'type', width: 12 }];
              return [60, 40, 25].map(room => fittedWidths(cols, [30, 8, 12], 'all', room));
            })()
            """);
        Assert.Equal("[[30,8,12],[20,8,12],[8,8,12]]", r.GetRawText());
    }

    // Fit per column: Ctrl+R fits manual and auto columns (the name alone when all are never), within min and max;
    // auto-enlarge only widens, auto-shrink only narrows; the name can be anywhere.
    [Fact]
    public void EachColumnFitsAsItsFitSays()
    {
        var r = Run("""
            (() => {
              const cols = [{ id: 'git', width: 8, fit: 'enlarge' }, { id: 'name', width: 22, fit: 'never' },
                { id: 'size', width: 7, fit: 'shrink' }, { id: 'type', width: 12, fit: 'manual', min: 10, max: 11 }];
              const never = cols.map(c => ({ ...c, fit: 'never' }));
              return [fittedWidths(cols, [6, 30, 5, 20], 'fit', 100), fittedWidths(cols, [6, 30, 5, 20], 'auto', 100),
                fittedWidths(cols, [10, 30, 9, 4], 'auto', 100), fittedWidths(never, [6, 30, 5, 20], 'fit', 100)];
            })()
            """);
        Assert.Equal("[[6,22,5,11],[8,22,5,12],[10,22,7,12],[8,30,7,12]]", r.GetRawText());
    }

    // Sorting on several columns (3.4): by the first, then the second where the first is equal; folders first, empty
    // values last, by name at the end.
    [Fact]
    public void SortingOnSeveralColumns()
    {
        var r = Run("""
            (() => {
              const items = [
                { name: 'c', type: 'Text', size: 5, folder: false }, { name: 'a', type: 'Text', size: 9, folder: false },
                { name: 'b', type: 'Image', size: 9, folder: false }, { name: 'd', folder: false, size: 1 },
                { name: 'z', folder: true, type: 'Folder' } ];
              const by = sort => [...items].sort(sortComparer(sort)).map(x => x.name).join(' ');
              return [by([{ id: 'type', desc: false }, { id: 'size', desc: true }]), by([{ id: 'size', desc: true }, { id: 'type', desc: false }]),
                by([{ id: 'size', desc: false }, { id: 'name', desc: true }])];
            })()
            """);
        Assert.Equal(["z b a c d", "z b a c d", "z d c b a"], r.EnumerateArray().Select(x => x.GetString()));
    }

    // Folders mixed with the files (settings foldersFirstByName and foldersFirst, or a pane's own): a folder with a size (plan 37) sorts among
    // the files by it; folders first: before them whatever its size.
    [Fact]
    public void FoldersMixedWithTheFiles()
    {
        var r = Run("""
            (() => {
              folderSizes.set('c:\\z', { size: 7, files: 1, folders: 0 });
              const items = [
                { name: 'c', size: 5, folder: false }, { name: 'a', size: 9, folder: false },
                { id: 'C:\\z', name: 'z', folder: true }, { id: 'C:\\y', name: 'y', folder: true } ];
              const by = (first, desc) => [...items].sort(sortComparer([{ id: 'size', desc }], first)).map(x => x.name).join(' ');
              return [by(true, true), by(false, true), by(false, false)];
            })()
            """);
        Assert.Equal(["z y a c", "a z c y", "c z a y"], r.EnumerateArray().Select(x => x.GetString()));
    }

    // Grouping folders: one choice sorted on name (no sort, or name first: foldersFirstByName), one sorted on another
    // column (foldersFirst); a pane's own choice over the setting.
    [Fact]
    public void GroupingFoldersSortedOnNameAndOnOtherColumns()
    {
        var r = Run("""
            (() => {
              globalThis.settings = { foldersFirstByName: 'first', foldersFirst: 'mixed' };
              const panes = { p: {}, q: { foldersFirstByName: 'mixed', foldersFirst: 'first' } };
              globalThis.layout = { pane: id => panes[id] };
              const size = [{ id: 'size', desc: true }], name = [{ id: 'name', desc: false }, { id: 'size', desc: false }];
              return [foldersFirstIn('p', []), foldersFirstIn('p', name), foldersFirstIn('p', size),
                foldersFirstIn('q', []), foldersFirstIn('q', name), foldersFirstIn('q', size)];
            })()
            """);
        Assert.Equal([true, true, false, false, false, true], r.EnumerateArray().Select(x => x.GetBoolean()));
    }

    // A click on a title (3.4): one column (or none) sorts by it, again the other way; several: only that one turned,
    // or null (the Sort window) for a column not in the sort.
    [Fact]
    public void AClickOnATitle()
    {
        var r = Run("""
            (() => {
              const two = [{ id: 'type', desc: false }, { id: 'size', desc: false }];
              return [sortAfterClick([], 'size'), sortAfterClick([{ id: 'size', desc: false }], 'size'),
                sortAfterClick([{ id: 'size', desc: false }], 'name'), sortAfterClick(two, 'size'), sortAfterClick(two, 'name')];
            })()
            """);
        Assert.Equal("""[[{"id":"size","desc":false}],[{"id":"size","desc":true}],[{"id":"name","desc":false}],[{"id":"type","desc":false},{"id":"size","desc":true}],null]""",
            r.GetRawText());
    }

    // Written before (3.9): one sort as a list of one, "fit": true as every column fitting both ways.
    [Fact]
    public void OldColumnsAreReadAsMeant()
    {
        var r = Run("""normalColumns({ columns: [{ id: 'name', width: 20 }, { id: 'size' }], sort: { id: 'size', desc: true }, fit: true })""");
        Assert.Equal("""{"columns":[{"id":"name","width":20,"fit":"both"},{"id":"size","fit":"both"}],"sort":[{"id":"size","desc":true}]}""", r.GetRawText());
    }

    // The host (3.9): an old set read into the new form; the new fields and your order written and read back.
    [Fact]
    public void TheHostKeepsTheNewFieldsAndTheOrder()
    {
        var problems = new JsonArray();
        var old = ColumnSetsFile.Sets(JsonNode.Parse("""
            { "sets": [ { "name": "Old", "columns": [ { "id": "name" }, { "id": "size" } ], "sort": { "id": "size", "desc": true }, "fit": true } ] }
            """), problems, "yours");
        Assert.Equal("""{"name":"Old","columns":[{"id":"name","fit":"both"},{"id":"size","fit":"both"}],"sort":[{"id":"size","desc":true}]}""",
            old[0].ToJsonString());
        ColumnSetsFile.SaveSets(dir, JsonNode.Parse("""
            [ { "name": "Mine", "columns": [ { "id": "git", "fit": "enlarge", "min": 4, "max": 9 }, { "id": "name" }, { "id": "ext", "hidden": true } ],
                "sort": [ { "id": "git" }, { "id": "name", "desc": true } ] } ]
            """)!, JsonNode.Parse("""[ "Git", "Mine" ]"""));
        var r = ColumnSetsFile.Load(dir, Shipped);
        Assert.Empty(r["problems"]!.AsArray());
        Assert.Equal(["Git", "Mine", "Generic", "Dates", "Pictures", "Music", "Films", "Documents"], Names(r));
        Assert.Equal("""[{"id":"git","min":4,"max":9,"fit":"enlarge"},{"id":"name"},{"id":"ext","hidden":true}]""", r["sets"]![1]!["columns"]!.ToJsonString());
        Assert.Equal("""[{"id":"git","desc":false},{"id":"name","desc":true}]""", r["sets"]![1]!["sort"]!.ToJsonString());
        // Your sets written again without an order keep it.
        ColumnSetsFile.SaveSets(dir, JsonNode.Parse("""[ { "name": "Mine", "columns": [ { "id": "name" } ] } ]""")!);
        Assert.Equal("Git", Names(ColumnSetsFile.Load(dir, Shipped))[0]);
    }

    // ---------- The host ----------

    static void Git(string folder, params string[] args)
    {
        var start = new ProcessStartInfo("git") { WorkingDirectory = folder, CreateNoWindow = true, UseShellExecute = false,
            RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var a in args) start.ArgumentList.Add(a);
        using var git = Process.Start(start)!;
        git.StandardOutput.ReadToEnd();
        git.StandardError.ReadToEnd();
        git.WaitForExit();
        Assert.Equal(0, git.ExitCode);
    }

    [Fact]
    public void TheGitStatusOfAFoldersItems()
    {
        Git(dir, "init", "-q");
        Git(dir, "config", "user.email", "test@example.com");
        Git(dir, "config", "user.name", "Test");
        File.WriteAllText(Path.Combine(dir, "kept.txt"), "a");
        File.WriteAllText(Path.Combine(dir, "changed.txt"), "a");
        Directory.CreateDirectory(Path.Combine(dir, "sub"));
        File.WriteAllText(Path.Combine(dir, "sub", "inner.txt"), "a");
        File.WriteAllText(Path.Combine(dir, ".gitignore"), "skip.log\n");
        Git(dir, "add", ".");
        Git(dir, "commit", "-q", "-m", "first");
        File.WriteAllText(Path.Combine(dir, "changed.txt"), "b");
        File.WriteAllText(Path.Combine(dir, "sub", "inner.txt"), "b");
        File.WriteAllText(Path.Combine(dir, "new.txt"), "a");
        File.WriteAllText(Path.Combine(dir, "skip.log"), "a");
        var status = GitStatus.Of(dir)!;
        Assert.Equal("M", status["changed.txt"]!.GetValue<string>());
        Assert.Equal("M", status["sub"]!.GetValue<string>());   // a folder: something under it changed
        Assert.Equal("U", status["new.txt"]!.GetValue<string>());
        Assert.Equal("I", status["skip.log"]!.GetValue<string>());
        Assert.Null(status["kept.txt"]);
        Assert.Null(GitStatus.Of(Path.GetTempPath() is var t && Directory.Exists(Path.Combine(t, ".git")) ? dir : t));
    }

    [Fact]
    public async Task APropertyReadForAFile()
    {
        var picture = Path.Combine(dir, "dot.png");
        using (var bitmap = new Bitmap(37, 21)) bitmap.Save(picture, System.Drawing.Imaging.ImageFormat.Png);
        var values = await StaWorker.Once("t", () => ShellProps.Values([picture], ["System.Image.HorizontalSize", "System.Image.VerticalSize", "System.Nope"]));
        var mine = values[picture]!;
        Assert.Equal(37, mine["System.Image.HorizontalSize"]![1]!.GetValue<double>());
        Assert.Equal(21, mine["System.Image.VerticalSize"]![1]!.GetValue<double>());
        Assert.Null(mine["System.Nope"]);
        var list = await StaWorker.Once("t", ShellProps.List);
        Assert.Contains(list, p => p!["name"]!.GetValue<string>() == "System.Media.Duration");
    }

    // Select columns' Up and Down: the chosen shown columns move together past the next shown one (a hidden one passed
    // over); at an end, nothing moves.
    [Fact]
    public void ShownColumnsMovedUpAndDownTogether()
    {
        var r = Run("""
            (() => {
              const make = () => ({ columns: [{ id: 'name' }, { id: 'size' }, { id: 'type', hidden: true }, { id: 'modified' }, { id: 'ext' }] });
              const ids = c => c.columns.map(x => x.id + (x.hidden ? '-' : '')).join(' ');
              const a = make(); moveShownColumns(a, ['modified', 'ext'], -1);
              const b = make(); moveShownColumns(b, ['name'], 1);
              const c = make(); moveShownColumns(c, ['name', 'size'], -1);
              const d = make(); moveShownColumns(d, ['size'], 1);
              return [ids(a), ids(b), ids(c), ids(d)];
            })()
            """);
        Assert.Equal("""["name modified type- ext size","size name type- modified ext","name size type- modified ext","name modified type- size ext"]""", r.GetRawText());
    }
}