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
    public void WithoutSwitchesEverythingIsAPath()
    {
        var (newWindow, paths) = Program.ParseArgs([@"C:\Temp"]);
        Assert.False(newWindow);
        Assert.Equal([@"C:\Temp"], paths);
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
