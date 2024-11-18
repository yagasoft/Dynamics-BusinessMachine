"use strict";
var Ys;
(function (Ys) {
    var DbmObject;
    (function (DbmObject) {
        var form;
        var channel;
        function OnLoad(executionContext) {
            form = executionContext.getFormContext();
            channel = Ys.Dbm.Common.registerAppEvents(form.data.entity.getId(), form);
        }
        DbmObject.OnLoad = OnLoad;
        function OnSave(executionContext) {
            channel.postMessage({
                message: 'save',
                id: form.getAttribute('ys_uniqueid').getValue()
            });
        }
        DbmObject.OnSave = OnSave;
    })(DbmObject = Ys.DbmObject || (Ys.DbmObject = {}));
})(Ys || (Ys = {}));
