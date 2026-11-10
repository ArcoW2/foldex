using System.Collections.Concurrent;

namespace Foldex.Shell;

/// <summary>
/// A thread of its own for shell work (listing folders, icons): STA, as some shell folders need, and off the UI thread,
/// so a slow folder (a network share, a phone) never stalls a window (docs/plans/02-PLAN-ui-technology.md 3.5).
/// </summary>
sealed class StaWorker : IDisposable
{
    readonly BlockingCollection<Action> work = [];
    readonly Thread thread;

    public StaWorker(string name)
    {
        thread = new Thread(() =>
        {
            foreach (var job in work.GetConsumingEnumerable()) job();
        }) { IsBackground = true, Name = name };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }

    public Task<T> Run<T>(Func<T> job)
    {
        var done = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        work.Add(() =>
        {
            try { done.SetResult(job()); }
            catch (Exception ex) { done.SetException(ex); }
        });
        return done.Task;
    }

    /// <summary>One job on an STA thread of its own (a listing: a slow folder must not hold up the next one).</summary>
    public static Task<T> Once<T>(string name, Func<T> job)
    {
        var done = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            try { done.SetResult(job()); }
            catch (Exception ex) { done.SetException(ex); }
        }) { IsBackground = true, Name = name };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        return done.Task;
    }

    public void Dispose() => work.CompleteAdding();
}
