"use strict";
var Ys;
(function (Ys) {
    var DbmScript;
    (function (DbmScript) {
        var form;
        var channel;
        function OnLoad(executionContext) {
            form = executionContext.getFormContext();
            channel = Ys.Dbm.Common.registerAppEvents(form.data.entity.getId(), form);
        }
        DbmScript.OnLoad = OnLoad;
        function OnSave(executionContext) {
            channel.postMessage({
                message: 'save',
                id: form.getAttribute('ys_uniqueid').getValue()
            });
        }
        DbmScript.OnSave = OnSave;
    })(DbmScript = Ys.DbmScript || (Ys.DbmScript = {}));
})(Ys || (Ys = {}));
