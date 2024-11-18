using System;

namespace Yagasoft.DynamicsPromoteSolutionPatchPlugin.Helpers
{
    public class WorkerHelper
    {
	    public Action<string, Action<Action<int, string>>, Action> WorkerAction;
	    public Action<string, Func<Action<int, string>, object>, Action<object>> WorkerFunction;

		public WorkerHelper(Action<string, Action<Action<int, string>>, Action> workerAction,
			Action<string, Func<Action<int, string>, object>, Action<object>> workerFunction)
		{
			WorkerAction = workerAction;
			WorkerFunction = workerFunction;
		}

    }
}
