declare namespace Ys.Dbm.Common {
    function retrieveScriptById(id: string): Promise<string>;
    function registerAppEvents(channelName: string, form: Xrm.BasicPage): BroadcastChannel;
}
