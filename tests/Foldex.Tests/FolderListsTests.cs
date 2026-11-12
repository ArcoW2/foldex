namespace Foldex.Tests;

// Quick access and favourite folders (docs/plans/executed/23-PLAN-quick-access-and-favourites.md 3.1): FolderLists.
public class FolderListsTests
{
    [Fact]
    public void AFolderIsKeptOnceInAnyCase()
    {
        Assert.Equal([@"C:\A", @"D:\B"], FolderLists.Unique([@"C:\A", @"c:\a\", @"D:\B", "", @"C:\A"]));
    }

    [Fact]
    public void AKnownFolderIsTheSameByItsShellNameAndItsPath()
    {
        var downloads = FolderLists.Resolve("shell:Downloads");
        Assert.NotEqual("shell:Downloads", downloads);   // Windows knows where it is
        Assert.True(FolderLists.Same("shell:Downloads", downloads));
        Assert.Equal("shell:Downloads", FolderLists.Known(downloads));
        Assert.Single(FolderLists.Unique(["shell:Downloads", downloads]));
    }

    [Fact]
    public void InsertPutsAFolderWhereItWasDroppedAndMovesOneThereAlready()
    {
        List<string> list = [@"C:\A", @"C:\B", @"C:\C"];
        Assert.Equal([@"C:\X", @"C:\A", @"C:\B", @"C:\C"], FolderLists.Insert(list, @"C:\X", 0));
        Assert.Equal([@"C:\A", @"C:\B", @"C:\C", @"C:\X"], FolderLists.Insert(list, @"C:\X", int.MaxValue));
        // A moved down (dropped after B): B, A, C; C moved up (dropped before A): C, A, B.
        Assert.Equal([@"C:\B", @"C:\A", @"C:\C"], FolderLists.Insert(list, @"C:\A", 2));
        Assert.Equal([@"C:\C", @"C:\A", @"C:\B"], FolderLists.Insert(list, @"C:\C", 0));
    }

    [Fact]
    public void ListsAreKeptAndAFileThatCannotBeReadIsEmpty()
    {
        var dir = Path.Combine(Path.GetTempPath(), "foldex-lists-" + Guid.NewGuid().ToString("N"));
        try
        {
            Assert.Null(FolderLists.Load(dir, FolderLists.QuickAccess));   // no file yet: quick access starts from Explorer's
            FolderLists.Save(dir, FolderLists.Favourites, [@"C:\A", @"c:\a", @"D:\B"]);
            Assert.Equal([@"C:\A", @"D:\B"], FolderLists.Load(dir, FolderLists.Favourites));
            File.WriteAllText(Path.Combine(dir, "quickaccess.json"), "{ broken");
            Assert.Equal([], FolderLists.Load(dir, FolderLists.QuickAccess));
        }
        finally { Directory.Delete(dir, true); }
    }
}
