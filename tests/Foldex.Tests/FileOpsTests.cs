using Foldex.Shell;

namespace Foldex.Tests;

// File operations through Windows (Shell/FileOps.cs): a new folder or file by the name typed in its row (rename.js
// newItem), numbered when the name is taken.
public class FileOpsTests
{
    static FileOps.Operation Wait(FileOps.Operation op)
    {
        for (var i = 0; i < 200 && !op.Finished; i++) Thread.Sleep(50);
        return op;
    }

    [Fact]
    public void CopyIntoItsOwnFolderMakesACopyByANewName()
    {
        var dir = Path.Combine(Path.GetTempPath(), "foldex-copy-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(dir, "sub"));
        File.WriteAllText(Path.Combine(dir, "a.txt"), "abc");
        try
        {
            var op = Wait(new FileOps(_ => { }).Start("copy", [Path.Combine(dir, "a.txt"), Path.Combine(dir, "sub")], dir, IntPtr.Zero, false));
            Assert.True(op.Finished);
            Assert.Null(op.Error);
            Assert.Equal(2, Directory.GetFiles(dir, "a*.txt").Length);
            Assert.Equal(2, Directory.GetDirectories(dir, "sub*").Length);
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void NewFolderAndFileByTheirNames()
    {
        var dir = Path.Combine(Path.GetTempPath(), "foldex-new-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var ops = new FileOps(_ => { });
            var folder = Wait(ops.Start("newFolder", [], dir, IntPtr.Zero, false, "Kappa"));
            Assert.Null(folder.Error);
            Assert.True(Directory.Exists(Path.Combine(dir, "Kappa")));
            Assert.Equal(Path.Combine(dir, "Kappa"), folder.Created, ignoreCase: true);

            var file = Wait(ops.Start("newFile", [], dir, IntPtr.Zero, false, "notes.md"));
            Assert.Null(file.Error);
            Assert.True(File.Exists(Path.Combine(dir, "notes.md")));

            var again = Wait(ops.Start("newFolder", [], dir, IntPtr.Zero, false, "Kappa"));
            Assert.Null(again.Error);
            Assert.NotEqual(Path.Combine(dir, "Kappa"), again.Created, StringComparer.OrdinalIgnoreCase);   // taken meanwhile: numbered
            Assert.True(Directory.Exists(again.Created));

            var standard = Wait(ops.Start("newFolder", [], dir, IntPtr.Zero, false));
            Assert.Null(standard.Error);
            Assert.True(Directory.Exists(standard.Created));
        }
        finally { Directory.Delete(dir, true); }
    }
}
