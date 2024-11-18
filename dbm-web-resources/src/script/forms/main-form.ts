namespace Ys.DbmScript
{
	var form: Form.ys_dbmscript.Main.MainForm;
	var channel: BroadcastChannel;

	export function OnLoad(executionContext: Xrm.ExecutionContext<any, any>): void
	{
		form = executionContext.getFormContext() as Form.ys_dbmscript.Main.MainForm;
		channel = Ys.Dbm.Common.registerAppEvents(form.data.entity.getId(), <any>form);
	}

	export function OnSave(executionContext: Xrm.ExecutionContext<any, any>): void
	{
		channel.postMessage({
			message: 'save',
			id: form.getAttribute('ys_uniqueid').getValue()
		});
	}
}
