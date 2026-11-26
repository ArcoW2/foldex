namespace Foldex.Tests;

public class ProgramTests
{
    [Fact]
    public void NewWindowSwitchesAreTakenOut()
    {
        var (newWindow, paths) = Program.ParseArgs(["-n", @"C:\Temp", "--new-window", @"D:\"]);
        Assert.True(newWindow);
        Assert.Equal([@"C:\Temp", @"D:\"], paths);
    }

    [Fact]
    public void TheProfileIsTakenOut()
    {
        var (profile, rest) = Program.ParseProfile(["-n", "--profile", "Work", @"C:\Temp"]);
        Assert.Equal("Work", profile);
        Assert.Equal(["-n", @"C:\Temp"], rest);
        (profile, rest) = Program.ParseProfile([@"C:\Temp"]);
        Assert.Null(profile);
        Assert.Equal([@"C:\Temp"], rest);
    }
    [Fact]
    public void DefaultKeepsThePipeNameItHadAnotherProfileHasItsOwn()
    {
        var before = Program.PipeName(@"C:\Foldex\Foldex.exe", "S-1-5-21");
        Assert.Equal(before, Program.PipeName(@"C:\Foldex\Foldex.exe", "S-1-5-21", 0));
        Assert.Equal(before + "-p2", Program.PipeName(@"C:\Foldex\Foldex.exe", "S-1-5-21", 2));
    }
    [Fact]
    public void WithoutSwitchesEverythingIsAPath()
    {
        var (newWindow, paths) = Program.ParseArgs([@"C:\Temp"]);
        Assert.False(newWindow);
        Assert.Equal([@"C:\Temp"], paths);
    }

    [Theory]
    [InlineData("shell:RecycleBinFolder")]
    [InlineData("::{20D04FE0-3AEA-1069-A2D8-08002B30309D}")]
    [InlineData(@"C:\Windows")]
    public void ShellNamesAndFullPathsStayAsTheyAre(string arg)
    {
        Assert.Equal(arg, Program.FullName(arg));
    }

    [Fact]
    public void RelativePathsBecomeFull()
    {
        Assert.Equal(Path.Combine(Environment.CurrentDirectory, "sub"), Program.FullName("sub"));
    }

    [Fact]
    public void PipeNameIsPerUserAndExeIgnoringCase()
    {
        var a = Program.PipeName(@"C:\Apps\Foldex.exe", "S-1-5-21-1");
        Assert.Equal(a, Program.PipeName(@"c:\apps\FOLDEX.EXE", "S-1-5-21-1"));
        Assert.NotEqual(a, Program.PipeName(@"C:\Dev\Foldex.exe", "S-1-5-21-1"));
        Assert.NotEqual(a, Program.PipeName(@"C:\Apps\Foldex.exe", "S-1-5-21-2"));
        Assert.StartsWith("Foldex-S-1-5-21-1-", a);
    }
}
