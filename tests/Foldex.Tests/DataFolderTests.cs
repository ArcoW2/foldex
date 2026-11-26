namespace Foldex.Tests;

public class DataFolderTests
{
    [Fact]
    public void VariableWinsOverLocalAppData()
    {
        Assert.Equal(@"D:\scratch", DataFolder.Resolve(@"D:\scratch", @"C:\Users\me\AppData\Local"));
    }

    [Fact]
    public void WithoutVariableItIsFoldexInLocalAppData()
    {
        Assert.Equal(@"C:\Users\me\AppData\Local\Foldex", DataFolder.Resolve(null, @"C:\Users\me\AppData\Local"));
        Assert.Equal(@"C:\Users\me\AppData\Local\Foldex", DataFolder.Resolve("", @"C:\Users\me\AppData\Local"));
    }

    [Fact]
    public void DefaultIsTheTopFolderAnotherProfileIsUnderProfilesByNumber()
    {
        Assert.Equal(@"C:\data", DataFolder.ProfileDir(@"C:\data", 0));
        Assert.Equal(@"C:\data\Profiles\3", DataFolder.ProfileDir(@"C:\data", 3));
        Assert.Equal(@"C:\data\State\profiles.json", DataFolder.ProfilesPath(@"C:\data"));
    }
    [Fact]
    public void StateFilesAreInState()
    {
        Assert.Equal(@"C:\data\State\state.json", DataFolder.StatePath(@"C:\data", "state.json"));
    }
}
