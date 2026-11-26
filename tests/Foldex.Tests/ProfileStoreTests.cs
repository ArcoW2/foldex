namespace Foldex.Tests;

// docs/plans/executed/41-PLAN-profiles.md 3.1, 3.3, 3.4, 3.6.
public class ProfileStoreTests : IDisposable
{
    readonly string dir = Path.Combine(Path.GetTempPath(), "foldex-profiles-" + Guid.NewGuid().ToString("N"));
    string FilePath => Path.Combine(dir, "State", ProfileStore.FileName);

    public void Dispose()
    {
        if (Directory.Exists(dir)) Directory.Delete(dir, true);
    }

    [Fact]
    public void WithoutAFileThereIsOnlyDefaultAndItIsOpen()
    {
        var s = ProfileStore.Load(FilePath);
        var d = Assert.Single(s.Profiles);
        Assert.Equal((0, "Default", true, false), (d.Number, d.Name, d.WasOpen, d.Locked));
        Assert.True(s.DefaultAtStart());
    }

    [Fact]
    public void ACopyGetsANewNumberNeverUsedBeforeAndAFreeName()
    {
        ProfileStore.Change(FilePath, s => s.Add("Work"));
        var second = ProfileStore.Change(FilePath, s => s.Add("Work"));
        Assert.Equal((2, "Work 2"), (second.Number, second.Name));
        // Removed for good: its number is not given again.
        ProfileStore.Change(FilePath, s => { s.MarkDeleted(s.Get(2)!); s.Remove(2); });
        var third = ProfileStore.Change(FilePath, s => s.Add("Home"));
        Assert.Equal(3, third.Number);
        Assert.Equal(["Default", "Home", "Work"], ProfileStore.Load(FilePath).Listed.Select(p => p.Name));
    }

    [Fact]
    public void DefaultCannotBeRenamedDeletedOrGetAPassword()
    {
        var s = ProfileStore.Load(FilePath);
        var d = s.Get(0)!;
        Assert.False(s.Rename(d, "Mine"));
        Assert.False(s.MarkDeleted(d));
        Assert.False(s.SetPassword(d, "secret"));
        Assert.Equal(("Default", false, false), (d.Name, d.Deleted, d.Locked));
    }

    [Fact]
    public void APasswordIsKeptAsAHashAndChecked()
    {
        ProfileStore.Change(FilePath, s => { var w = s.Add("Work"); s.SetPassword(w, "open sesame"); });
        Assert.DoesNotContain("open sesame", File.ReadAllText(FilePath));
        var p = ProfileStore.Load(FilePath).Get(1)!;
        Assert.True(p.Locked);
        Assert.True(ProfileStore.Check(p, "open sesame"));
        Assert.False(ProfileStore.Check(p, "Open sesame"));
        Assert.False(ProfileStore.Check(p, ""));
        ProfileStore.Change(FilePath, s => s.SetPassword(s.Get(1)!, null));
        Assert.False(ProfileStore.Load(FilePath).Get(1)!.Locked);
        Assert.True(ProfileStore.Check(ProfileStore.Load(FilePath).Get(1)!, ""));
    }

    [Fact]
    public void ADeletedProfileIsNotListedNorFound()
    {
        ProfileStore.Change(FilePath, s => s.Add("Work"));
        ProfileStore.Change(FilePath, s => s.MarkDeleted(s.Get(1)!));
        var s = ProfileStore.Load(FilePath);
        Assert.Null(s.Get(1));
        Assert.Null(s.Find("Work"));
        Assert.Equal(["Default"], s.Listed.Select(p => p.Name));
        Assert.True(s.Profiles.Single(p => p.Number == 1).Deleted);
    }

    [Fact]
    public void FoundByNumberOrByName()
    {
        ProfileStore.Change(FilePath, s => s.Add("Work"));
        var s = ProfileStore.Load(FilePath);
        Assert.Equal(1, s.Find("1")!.Number);
        Assert.Equal(1, s.Find("work")!.Number);
        Assert.Equal(0, s.Find("Default")!.Number);
        Assert.Null(s.Find("Home"));
    }

    [Fact]
    public void AtStartTheOpenOnesComeBackExceptNeverOpenOnes()
    {
        ProfileStore.Change(FilePath, s =>
        {
            s.Get(0)!.WasOpen = false;
            var a = s.Add("A"); a.WasOpen = true;
            var b = s.Add("B"); b.WasOpen = true; b.NeverOpen = true;
            s.Add("C");
        });
        var store = ProfileStore.Load(FilePath);
        Assert.Equal(["A"], store.StartProfiles().Select(p => p.Name));
        Assert.False(store.DefaultAtStart());
        // None left to come back: Default opens.
        ProfileStore.Change(FilePath, s => s.Get(1)!.NeverOpen = true);
        Assert.Empty(ProfileStore.Load(FilePath).StartProfiles());
        Assert.True(ProfileStore.Load(FilePath).DefaultAtStart());
    }

    [Fact]
    public void ACopyHasEverythingButStateAndTheOtherProfiles()
    {
        var from = Path.Combine(dir, "top");
        Directory.CreateDirectory(Path.Combine(from, "State"));
        Directory.CreateDirectory(Path.Combine(from, "Profiles", "1"));
        Directory.CreateDirectory(Path.Combine(from, "themes"));
        File.WriteAllText(Path.Combine(from, "settings.json"), "{}");
        File.WriteAllText(Path.Combine(from, "themes", "mine.json"), "{}");
        File.WriteAllText(Path.Combine(from, "State", "projects.json"), "{}");
        var to = DataFolder.ProfileDir(from, 2);
        ProfileProcesses.CopyFolder(from, to);
        Assert.True(File.Exists(Path.Combine(to, "settings.json")));
        Assert.True(File.Exists(Path.Combine(to, "themes", "mine.json")));
        Assert.False(Directory.Exists(Path.Combine(to, "State")));
        Assert.False(Directory.Exists(Path.Combine(to, "Profiles", "1")));
    }
}
