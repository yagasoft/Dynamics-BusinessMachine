"use strict";
var Ys;
(function (Ys) {
    var Dbm;
    (function (Dbm) {
        var Common;
        (function (Common) {
            async function retrieveScriptById(id) {
                const code = (await Ys.Common.retrieveRecords(`ys_dbmscripts?$select=ys_code&$filter=ys_id eq 'ys_/dbm/data/scripts/${id}'`))[0]?.ys_code;
                Ys.Common.validateCode(code, id);
                return code;
            }
            Common.retrieveScriptById = retrieveScriptById;
            function registerAppEvents(channelName, form) {
                const channel = new BroadcastChannel(`dbm-app-${channelName.toLowerCase().replaceAll(/[{}]/ig, '')}`);
                channel.addEventListener("message", (event) => {
                    const data = event.data;
                    if (data == null) {
                        console.warn('Window message has no data.');
                    }
                    switch (data.message) {
                        case 'get-id':
                            event.source.postMessage({
                                message: 'id',
                                data: form.getAttribute('ys_uniqueid').getValue()
                            });
                            break;
                        case 'set-context':
                            let webResouceControl = form.getControl('WebResource_dbmEditorApp');
                            if (webResouceControl) {
                                webResouceControl.getContentWindow()
                                    .then((contentWindow) => {
                                    const parent = window.parent;
                                    function setContext() {
                                        if (contentWindow.setClientApiContext) {
                                            contentWindow.setClientApiContext(Xrm, form, parent.$);
                                        }
                                        else {
                                            setTimeout(() => {
                                                setContext();
                                            }, 100);
                                        }
                                    }
                                    setContext();
                                });
                            }
                            break;
                        case 'load':
                            channel.postMessage({
                                message: 'load',
                                id: form.getAttribute('ys_uniqueid').getValue()
                            });
                            break;
                        case 'is-updated':
                            form.getAttribute('ys_updated').setValue(new Date().toString());
                            break;
                        case 'save':
                            form.data.save();
                            break;
                        default:
                            break;
                    }
                }, false);
                return channel;
            }
            Common.registerAppEvents = registerAppEvents;
        })(Common = Dbm.Common || (Dbm.Common = {}));
    })(Dbm = Ys.Dbm || (Ys.Dbm = {}));
})(Ys || (Ys = {}));
