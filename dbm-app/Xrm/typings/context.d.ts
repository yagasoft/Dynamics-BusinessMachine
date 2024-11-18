declare const enum ys_dbmobject_statecode {
  Active = 0,
  Inactive = 1,
}
declare const enum ys_dbmobject_statuscode {
  Active = 1,
  Inactive = 2,
}
declare const enum ys_dbmscript_statecode {
  Active = 0,
  Inactive = 1,
}
declare const enum ys_dbmscript_statuscode {
  Active = 1,
  Inactive = 2,
}
declare namespace Form.ys_dbmobject.Quick {
  namespace Information {
    namespace Tabs {
    }
    interface Attributes extends Xrm.AttributeCollectionBase {
      get(name: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
      get(name: "ys_name"): Xrm.Attribute<string>;
      get(name: string): undefined;
      get(): Xrm.Attribute<any>[];
      get(index: number): Xrm.Attribute<any>;
      get(chooser: (item: Xrm.Attribute<any>, index: number) => boolean): Xrm.Attribute<any>[];
    }
    interface Controls extends Xrm.ControlCollectionBase {
      get(name: "ownerid"): Xrm.LookupControl<"systemuser" | "team">;
      get(name: "ys_name"): Xrm.StringControl;
      get(name: string): undefined;
      get(): Xrm.BaseControl[];
      get(index: number): Xrm.BaseControl;
      get(chooser: (item: Xrm.BaseControl, index: number) => boolean): Xrm.BaseControl[];
    }
    interface Tabs extends Xrm.TabCollectionBase {
      get(name: string): undefined;
      get(): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
      get(index: number): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>;
      get(chooser: (item: Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>, index: number) => boolean): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
    }
  }
  interface Information extends Xrm.PageBase<Information.Attributes,Information.Tabs,Information.Controls> {
    getAttribute(attributeName: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
    getAttribute(attributeName: "ys_name"): Xrm.Attribute<string>;
    getAttribute(attributeName: string): undefined;
    getAttribute(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Attribute<any>>): Xrm.Attribute<any>[];
    getControl(controlName: "ownerid"): Xrm.LookupControl<"systemuser" | "team">;
    getControl(controlName: "ys_name"): Xrm.StringControl;
    getControl(controlName: string): undefined;
    getControl(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Control<any>>): Xrm.Control<any>[];
  }
}
declare namespace Form.ys_dbmobject.Main {
  namespace MainForm {
    namespace Tabs {
    }
    interface Attributes extends Xrm.AttributeCollectionBase {
      get(name: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
      get(name: "ys_description"): Xrm.Attribute<string>;
      get(name: "ys_name"): Xrm.Attribute<string>;
      get(name: "ys_uniqueid"): Xrm.Attribute<string>;
      get(name: "ys_updated"): Xrm.Attribute<string>;
      get(name: string): undefined;
      get(): Xrm.Attribute<any>[];
      get(index: number): Xrm.Attribute<any>;
      get(chooser: (item: Xrm.Attribute<any>, index: number) => boolean): Xrm.Attribute<any>[];
    }
    interface Controls extends Xrm.ControlCollectionBase {
      get(name: "WebResource_dbmEditorApp"): Xrm.WebResourceControl;
      get(name: "header_ownerid"): Xrm.LookupControl<"systemuser" | "team">;
      get(name: "ys_description"): Xrm.StringControl;
      get(name: "ys_name"): Xrm.StringControl;
      get(name: "ys_uniqueid"): Xrm.StringControl;
      get(name: "ys_updated"): Xrm.StringControl;
      get(name: string): undefined;
      get(): Xrm.BaseControl[];
      get(index: number): Xrm.BaseControl;
      get(chooser: (item: Xrm.BaseControl, index: number) => boolean): Xrm.BaseControl[];
    }
    interface Tabs extends Xrm.TabCollectionBase {
      get(name: string): undefined;
      get(): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
      get(index: number): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>;
      get(chooser: (item: Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>, index: number) => boolean): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
    }
  }
  interface MainForm extends Xrm.PageBase<MainForm.Attributes,MainForm.Tabs,MainForm.Controls> {
    getAttribute(attributeName: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
    getAttribute(attributeName: "ys_description"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_name"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_uniqueid"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_updated"): Xrm.Attribute<string>;
    getAttribute(attributeName: string): undefined;
    getAttribute(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Attribute<any>>): Xrm.Attribute<any>[];
    getControl(controlName: "WebResource_dbmEditorApp"): Xrm.WebResourceControl;
    getControl(controlName: "header_ownerid"): Xrm.LookupControl<"systemuser" | "team">;
    getControl(controlName: "ys_description"): Xrm.StringControl;
    getControl(controlName: "ys_name"): Xrm.StringControl;
    getControl(controlName: "ys_uniqueid"): Xrm.StringControl;
    getControl(controlName: "ys_updated"): Xrm.StringControl;
    getControl(controlName: string): undefined;
    getControl(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Control<any>>): Xrm.Control<any>[];
  }
}
declare namespace Form.ys_dbmscript.Main {
  namespace MainForm {
    namespace Tabs {
    }
    interface Attributes extends Xrm.AttributeCollectionBase {
      get(name: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
      get(name: "ys_description"): Xrm.Attribute<string>;
      get(name: "ys_name"): Xrm.Attribute<string>;
      get(name: "ys_triggerchange"): Xrm.Attribute<string>;
      get(name: "ys_uniqueid"): Xrm.Attribute<string>;
      get(name: "ys_updated"): Xrm.Attribute<string>;
      get(name: string): undefined;
      get(): Xrm.Attribute<any>[];
      get(index: number): Xrm.Attribute<any>;
      get(chooser: (item: Xrm.Attribute<any>, index: number) => boolean): Xrm.Attribute<any>[];
    }
    interface Controls extends Xrm.ControlCollectionBase {
      get(name: "WebResource_dbmEditorApp"): Xrm.WebResourceControl;
      get(name: "header_ownerid"): Xrm.LookupControl<"systemuser" | "team">;
      get(name: "ys_description"): Xrm.StringControl;
      get(name: "ys_name"): Xrm.StringControl;
      get(name: "ys_triggerchange"): Xrm.StringControl;
      get(name: "ys_uniqueid"): Xrm.StringControl;
      get(name: "ys_updated"): Xrm.StringControl;
      get(name: string): undefined;
      get(): Xrm.BaseControl[];
      get(index: number): Xrm.BaseControl;
      get(chooser: (item: Xrm.BaseControl, index: number) => boolean): Xrm.BaseControl[];
    }
    interface Tabs extends Xrm.TabCollectionBase {
      get(name: string): undefined;
      get(): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
      get(index: number): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>;
      get(chooser: (item: Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>, index: number) => boolean): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
    }
  }
  interface MainForm extends Xrm.PageBase<MainForm.Attributes,MainForm.Tabs,MainForm.Controls> {
    getAttribute(attributeName: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
    getAttribute(attributeName: "ys_description"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_name"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_triggerchange"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_uniqueid"): Xrm.Attribute<string>;
    getAttribute(attributeName: "ys_updated"): Xrm.Attribute<string>;
    getAttribute(attributeName: string): undefined;
    getAttribute(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Attribute<any>>): Xrm.Attribute<any>[];
    getControl(controlName: "WebResource_dbmEditorApp"): Xrm.WebResourceControl;
    getControl(controlName: "header_ownerid"): Xrm.LookupControl<"systemuser" | "team">;
    getControl(controlName: "ys_description"): Xrm.StringControl;
    getControl(controlName: "ys_name"): Xrm.StringControl;
    getControl(controlName: "ys_triggerchange"): Xrm.StringControl;
    getControl(controlName: "ys_uniqueid"): Xrm.StringControl;
    getControl(controlName: "ys_updated"): Xrm.StringControl;
    getControl(controlName: string): undefined;
    getControl(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Control<any>>): Xrm.Control<any>[];
  }
}
declare namespace Form.ys_dbmscript.Quick {
  namespace Information {
    namespace Tabs {
    }
    interface Attributes extends Xrm.AttributeCollectionBase {
      get(name: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
      get(name: "ys_name"): Xrm.Attribute<string>;
      get(name: string): undefined;
      get(): Xrm.Attribute<any>[];
      get(index: number): Xrm.Attribute<any>;
      get(chooser: (item: Xrm.Attribute<any>, index: number) => boolean): Xrm.Attribute<any>[];
    }
    interface Controls extends Xrm.ControlCollectionBase {
      get(name: "ownerid"): Xrm.LookupControl<"systemuser" | "team">;
      get(name: "ys_name"): Xrm.StringControl;
      get(name: string): undefined;
      get(): Xrm.BaseControl[];
      get(index: number): Xrm.BaseControl;
      get(chooser: (item: Xrm.BaseControl, index: number) => boolean): Xrm.BaseControl[];
    }
    interface Tabs extends Xrm.TabCollectionBase {
      get(name: string): undefined;
      get(): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
      get(index: number): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>;
      get(chooser: (item: Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>, index: number) => boolean): Xrm.PageTab<Xrm.Collection<Xrm.PageSection>>[];
    }
  }
  interface Information extends Xrm.PageBase<Information.Attributes,Information.Tabs,Information.Controls> {
    getAttribute(attributeName: "ownerid"): Xrm.LookupAttribute<"systemuser" | "team">;
    getAttribute(attributeName: "ys_name"): Xrm.Attribute<string>;
    getAttribute(attributeName: string): undefined;
    getAttribute(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Attribute<any>>): Xrm.Attribute<any>[];
    getControl(controlName: "ownerid"): Xrm.LookupControl<"systemuser" | "team">;
    getControl(controlName: "ys_name"): Xrm.StringControl;
    getControl(controlName: string): undefined;
    getControl(delegateFunction: Xrm.Collection.MatchingDelegate<Xrm.Control<any>>): Xrm.Control<any>[];
  }
}
type WebResourceImage = "new_roleconfig16.png"
  | "new_roleconfig32.png"
  | "msdyn_/Images/Solution_History_Icon32x32.png"
  | "ys_/Common/imgs/Dictionary32Png"
  | "ys_/Common/imgs/Dictionary16Png"
  | "ys_/Common/imgs/Dictionary64Png"
  | "ys_/RichEditor/plugins/icons.png"
  | "ys_/RichEditor/plugins/icons_hidpi.png"
  | "ys_/RichEditor/plugins/about/dialogs/logo_ckeditor.png"
  | "ys_/RichEditor/plugins/about/dialogs/hidpi/logo_ckeditor.png"
  | "ys_/RichEditor/plugins/emoji/assets/iconsall.png"
  | "ys_/RichEditor/plugins/forms/images/hiddenfield.gif"
  | "ys_/RichEditor/plugins/iframe/images/placeholder.png"
  | "ys_/RichEditor/plugins/link/images/anchor.png"
  | "ys_/RichEditor/plugins/link/images/hidpi/anchor.png"
  | "ys_/RichEditor/plugins/magicline/images/icon.png"
  | "ys_/RichEditor/plugins/magicline/images/icon_rtl.png"
  | "ys_/RichEditor/plugins/magicline/images/hidpi/icon.png"
  | "ys_/RichEditor/plugins/magicline/images/hidpi/icon_rtl.png"
  | "ys_/RichEditor/plugins/pagebreak/images/pagebreak.gif"
  | "ys_/RichEditor/plugins/preview/images/pagebreak.gif"
  | "ys_/RichEditor/plugins/showblocks/images/block_address.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_blockquote.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_div.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_h1.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_h2.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_h3.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_h4.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_h5.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_h6.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_p.png"
  | "ys_/RichEditor/plugins/showblocks/images/block_pre.png"
  | "ys_/RichEditor/plugins/smiley/images/angel_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/angel_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/angry_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/angry_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/broken_heart.gif"
  | "ys_/RichEditor/plugins/smiley/images/broken_heart.png"
  | "ys_/RichEditor/plugins/smiley/images/confused_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/confused_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/cry_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/cry_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/devil_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/devil_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/embaressed_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/embarrassed_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/embarrassed_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/envelope.gif"
  | "ys_/RichEditor/plugins/smiley/images/envelope.png"
  | "ys_/RichEditor/plugins/smiley/images/heart.gif"
  | "ys_/RichEditor/plugins/smiley/images/heart.png"
  | "ys_/RichEditor/plugins/smiley/images/kiss.gif"
  | "ys_/RichEditor/plugins/smiley/images/kiss.png"
  | "ys_/RichEditor/plugins/smiley/images/lightbulb.gif"
  | "ys_/RichEditor/plugins/smiley/images/lightbulb.png"
  | "ys_/RichEditor/plugins/smiley/images/omg_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/omg_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/regular_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/regular_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/sad_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/sad_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/shades_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/shades_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/teeth_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/teeth_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/thumbs_down.gif"
  | "ys_/RichEditor/plugins/smiley/images/thumbs_down.png"
  | "ys_/RichEditor/plugins/smiley/images/thumbs_up.gif"
  | "ys_/RichEditor/plugins/smiley/images/thumbs_up.png"
  | "ys_/RichEditor/plugins/smiley/images/tongue_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/tongue_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/tounge_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/whatchutalkingabout_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/whatchutalkingabout_smile.png"
  | "ys_/RichEditor/plugins/smiley/images/wink_smile.gif"
  | "ys_/RichEditor/plugins/smiley/images/wink_smile.png"
  | "ys_/RichEditor/plugins/templates/templates/images/template1.gif"
  | "ys_/RichEditor/plugins/templates/templates/images/template2.gif"
  | "ys_/RichEditor/plugins/templates/templates/images/template3.gif"
  | "ys_/RichEditor/plugins/widget/images/handle.png"
  | "ys_/RichEditor/skins/moono_lisa/icons.png"
  | "ys_/RichEditor/skins/moono_lisa/icons_hidpi.png"
  | "ys_/RichEditor/skins/moono_lisa/images/arrow.png"
  | "ys_/RichEditor/skins/moono_lisa/images/close.png"
  | "ys_/RichEditor/skins/moono_lisa/images/lock.png"
  | "ys_/RichEditor/skins/moono_lisa/images/lock_open.png"
  | "ys_/RichEditor/skins/moono_lisa/images/refresh.png"
  | "ys_/RichEditor/skins/moono_lisa/images/spinner.gif"
  | "ys_/RichEditor/skins/moono_lisa/images/hidpi/close.png"
  | "ys_/RichEditor/skins/moono_lisa/images/hidpi/lock.png"
  | "ys_/RichEditor/skins/moono_lisa/images/hidpi/lock_open.png"
  | "ys_/RichEditor/skins/moono_lisa/images/hidpi/refresh.png"
  | "ys_/RichEditor/plugins/base64image/icons/hidpi/base64image.png"
  | "ys_/RichEditor/plugins/base64image/icons/base64image.png"
  | "ys_/custom-message/images/message_32.jpg"
  | "ys_/custom-message/images/message_16.jpg"
  | "ys_/Common/images/Yagasoft64Png"
  | "adx_identity/changecredentials_16.png"
  | "adx_identity/changecredentials_32.png"
  | "adx_identity/unlock_16.png"
  | "adx_identity/unlock_32.png"
  | "msa_adx_Sitesetting_medium"
  | "adx_icon_invitation_small"
  | "adx_icon_invitation_medium"
  | "mag_/img/notify.png"
  | "mag_/img/notify_load.gif"
  | "msdyn_/AppManagementControl/images/apps.png"
  | "msdyn_/AppManagementControl/images/HorzPreloader_12x145-Blue.gif"
  | "msdyn_/AppManagementControl/images/HorzPreloader_12x145-Reverse-Blue.gif"
  | "msdyn_/AppManagementControl/images/HorzPreloader_12x145-Reverse-White.gif"
  | "msdyn_/AppManagementControl/images/HorzPreloader_12x145-White.gif"
  | "Activities/Images/SaveAsDraft16.png"
  | "Activities/Images/SendAndClose16.png"
  | "Activities/Images/SaveAsDraft32.png"
  | "Activities/Images/SendAndClose32.png"
  | "ys_ReadIconPng15"
  | "ys_ReadHighlightPng15"
  | "ys_SmoothLoadingGif20"
  | "ys_PlusGreyIconPng25"
  | "ys_BellPng32"
  | "ys_BellPng16"
  | "ys_/Generic/png/jsTree32px.png"
  | "ys_/Generic/png/jsTree40px.png"
  | "ys_/Generic/gif/throbber.gif"
  | "ys_DraftPng32"
  | "ys_DraftPng16"
  | "ys_QueuePng32"
  | "ys_QueuePng16"
  | "ys_JobPng32"
  | "ys_JobPng16"
  | "ys_RecurrencePng32"
  | "ys_RecurrencePng16"
  | "ys_RetryPng32"
  | "ys_RetryPng16"
  | "ys_JobEnginePng16"
  | "ys_JobEnginePng32"
  | "ys_StopPng16"
  | "ys_StopPng32"
  | "adx_Form_16.png"
  | "adx_Form_32.png"
  | "msdyn_/Images/AppModule_Default_Icon.png"
  | "msdyn_/Images/Legacy_Crm_Icon.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/shades_smile.png"
  | "ys_/dbm/apps/editor/color.png"
  | "ys_/dbm/apps/editor/hue.png"
  | "ys_/dbm/apps/editor/primeicons.eot"
  | "ys_/dbm/apps/editor/primeicons.ttf"
  | "ys_/dbm/apps/editor/primeicons.woff"
  | "ys_/dbm/apps/editor/primeicons.woff2"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/heart.png"
  | "msdyncrm_/libs/ckeditor/plugins/selectall/icons/hidpi/selectall.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/copilotrefinementclose.png"
  | "msdyncrm_/libs/ckeditor/plugins/icons_hidpi.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/justifycenter.png"
  | "msdyncrm_/libs/ckeditor/plugins/link/images/anchor.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/italic.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/superimage/icons/hidpi/superimage.png"
  | "cc_MscrmControls.Grid.ReadOnlyGrid/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/superimage/icons/superimage.png"
  | "msdyncrm_/libs/ckeditor/plugins/colorbutton/icons/hidpi/textcolor.png"
  | "ys_crmlogger32png"
  | "ys_crmlogger16png"
  | "ys_crmlogconfig16png"
  | "ys_crmlogconfig32png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/lock-open.png"
  | "msdyncrm_/libs/ckeditor/plugins/copyformatting/icons/hidpi/copyformatting.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/teeth_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/magicline/images/icon-rtl.png"
  | "cc_MscrmControls.TemplateFilterControl.TemplateFilterControl/imgs/Preview.jpg"
  | "AppCommon/_imgs/ico/16_approveemailofqueue.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_h1.png"
  | "msdyncrm_/libs/ckeditor/plugins/image/images/noimage.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/sparkles.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/regular_smile.png"
  | "AppCommon/_imgs/Ribbon/EmailToCaseOfQueue_16.png"
  | "Activities/Images/SendAsAppointment_16.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/hidpi/justifyright.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/underline.png"
  | "CRM/_imgs/ico_32_1048_overridden.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/find/icons/find-rtl.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/icons_hidpi.png"
  | "Theme_NavBarLogo_HighContrast.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/confused_smile.gif"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/tongue_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/superimage/icons/hidpi/superimage.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/heart.png"
  | "cc_MscrmControls.PowerBIPCFControl/images/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/superimage/icons/superimage.png"
  | "msdyncrm_/libs/ckeditor/plugins/magicline/images/icon.png"
  | "msdyncrm_/libs/ckeditor/plugins/find/icons/find.png"
  | "cc_MscrmControls.FlipSwitch.FlipSwitchControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/collapsible/icons/collapsible.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_h4.png"
  | "cc_MscrmControls.ActivityControls.ActivityEditorControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/hidpi/justifycenter.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/hidpi/close.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/embedmedia/icons/hidpi/embedmedia.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/colorbutton/icons/hidpi/textcolor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/icons.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/cut-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/omg_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/unsubscribe/icons/hidpi/unsubscribe.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/thumbs_down.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/icons.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/superimage/icons/reset.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/about/dialogs/hidpi/logo_ckeditor.png"
  | "AppCommon/_imgs/Ribbon/EmailToCaseOfQueue_32.png"
  | "msdyncrm_/libs/ckeditor/plugins/superimage/icons/lock.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/confused_smile.png"
  | "msdyncrm_/KnowledgeManagementFeatureWebResource/_imgs/ribbon/newrecord32.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/embaressed_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/hidpi/justifycenter.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/embedmedia/icons/hidpi/embedmedia.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/lock.png"
  | "mspp_select2/select2.png"
  | "cc_MscrmControls.LinearGauge.LinearGaugeControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/sad_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_h1.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/broken_heart.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/selectall/icons/hidpi/selectall.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/link/images/hidpi/anchor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/superimage/icons/cannedchat.png"
  | "msdyncrm_/libs/ckeditor/plugins/bidi/icons/bidirtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/hidpi/justifyleft.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/omg_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/pastefromword/icons/hidpi/pastefromword-rtl.png"
  | "msdyncrm_/libs/ckeditor/plugins/templates/templates/images/template3.gif"
  | "msdyncrm_/libs/ckeditor/plugins/find/icons/hidpi/find-rtl.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_pre.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/lightbulb.gif"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/hidpi/paste.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/lock-open.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/envelope.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/superimage/icons/cannedchat.png"
  | "msdyncrm_/libs/ckeditor/plugins/link/images/hidpi/anchor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/icons_hidpi.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/close.png"
  | "msdyn_/Images/Area_Default_Icon.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/widget/images/handle.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/hidpi/refresh.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_h3.png"
  | "msdyncrm_/libs/ckeditor/plugins/superimage/icons/reset.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/icons.png"
  | "CRM/_imgs/ribbon/DuplicateDetection_32.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/unsubscribe/icons/unsubscribe.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_p.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/angel_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/bidi/icons/bidirtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/strike.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/link/images/hidpi/anchor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/confused_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/hidpi/cut.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/about/dialogs/logo_ckeditor.png"
  | "CRM/_imgs/ribbon/MergeRecords_16.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/flash/images/placeholder.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/lock-open.png"
  | "msdyncrm_/libs/ckeditor/plugins/colorbutton/icons/bgcolor.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/hidpi/italic.png"
  | "msdyncrm_/libs/ckeditor/plugins/iframe/images/placeholder.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/devil_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/cry_smile.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/superimage/icons/hidpi/superimage.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/italic.png"
  | "msdyncrm_/libs/ckeditor/plugins/superimage/icons/lockopen.png"
  | "msdyncrm_/libs/ckeditor/plugins/pastefromword/icons/hidpi/pastefromword.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/hidpi/justifyright.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_h2.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/collapsible/icons/collapsible.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/magicline/images/icon.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/icons_hidpi.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/hidpi/underline.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/thumbs_up.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_h6.png"
  | "cc_MscrmControls.Timeline.TimelineControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/bidi/icons/bidiltr.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/justifyright.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/unsubscribe/icons/unsubscribe.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/lock-open.png"
  | "msdyncrm_/libs/ckeditor/plugins/bidi/icons/hidpi/bidiltr.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_blockquote.png"
  | "AppCommon/_imgs/Ribbon/LaunchMailbox_16.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/arrow.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/emoji/assets/iconsall.png"
  | "AppCommon/_imgs/Ribbon/RejectPrimaryEmail_16.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/angel_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/omg_smile.gif"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/refresh.png"
  | "cc_MscrmControls.ActivityCalendarControl.ActivityCalendarControl/res/CalendarPreview.png"
  | "cc_MscrmControls.Knob.RadialKnobControl/img/preview.png"
  | "cc_MscrmControls.OptionSet.OptionSetControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/shades_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/selectall/icons/selectall.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/wink_smile.gif"
  | "cc_MscrmControls.ActivityCalendarControl.ActivityCalendarControl/res/CalendarPreview.png"
  | "cc_MscrmControls.InputMask.InputMaskControl/img/preview.png"
  | "cc_MscrmControls.Signature.SignatureControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/shades_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/hidpi/bold.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/tongue_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/subscript.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/broken_heart.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/superimage/icons/lockopen.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/magicline/images/icon-rtl.png"
  | "mspp_select2/select2x2.png"
  | "msdyncrm_/libs/ckeditor/plugins/find/icons/hidpi/replace.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/spinner.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/hidpi/strike.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/icons_hidpi.png"
  | "msdyncrm_/KBSearchStandalone/RightPane_EmptyState.png"
  | "cc_MscrmControls.Grid.GridControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/error.png"
  | "msdyncrm_/libs/ckeditor/plugins/find/icons/replace.png"
  | "cc_MscrmControls.Calendar.CalendarControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/collapsible/icons/hidpi/collapsible.png"
  | "cc_MscrmControls.RichTextEditor.RichTextEditorControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_h5.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/tongue_smile.gif"
  | "msdyncrm_/KBSearchStandalone/LeftPane_EmptyState.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/sad_smile.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/icons.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/embarrassed_smile.gif"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/angel_smile.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/superimage/icons/superimage.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/copyformatting/icons/hidpi/copyformatting.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/hidpi/justifyleft.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/hidpi/copy-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/arrow.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/hidpi/superscript.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_address.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/lock-open.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/pastefromword/icons/pastefromword-rtl.png"
  | "cc_MscrmControls.BulletGraph.BulletGraphControl/img/preview.png"
  | "msdyn_/Images/Subarea_Default_Icon.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/image/images/noimage.png"
  | "AppCommon/_imgs/Ribbon/LaunchMailbox_32.png"
  | "cc_MscrmControls.Slider.LinearSliderControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/whatchutalkingabout_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/paste-rtl.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/refresh.png"
  | "msdyncrm_/libs/ckeditor/plugins/templates/templates/images/template1.gif"
  | "msdyncrm_/libs/ckeditor/plugins/magicline/images/hidpi/icon.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/close.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/close.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/refresh.png"
  | "CRM/_imgs/ico_16_1048_overridden.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/broken_heart.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/embedmedia/icons/embedmedia.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/lightbulb.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/hidpi/lock.png"
  | "mspp_select2/select2_spinner.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/hidpi/italic.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/teeth_smile.gif"
  | "msdyncrm_/libs/ckeditor/plugins/pastefromword/icons/pastefromword.png"
  | "CRM/_imgs/ribbon/DetectAll_32.png"
  | "AppCommon/_imgs/ico/16_rejectemailofqueue.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/lock-open.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/icons.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/link/images/anchor.png"
  | "msdyncrm_/libs/ckeditor/plugins/pagebreak/images/pagebreak.gif"
  | "Activities/Images/EmptyState.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/selectall/icons/selectall.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/underline.png"
  | "msdyncrm_/libs/ckeditor/plugins/templates/templates/images/template2.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/envelope.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/superimage/icons/lockopen.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/bold.png"
  | "msdyncrm_/libs/ckeditor/plugins/blockquote/icons/hidpi/blockquote.png"
  | "msdyncrm_/libs/ckeditor/plugins/bidi/icons/hidpi/bidirtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/superimage/icons/lock.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/emoji/assets/iconsall.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/preview/images/pagebreak.gif"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/hidpi/refresh.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/lock.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/link/images/anchor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/thumbs_up.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/hidpi/subscript.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_div.png"
  | "AppCommon/_imgs/Ribbon/ApprovePrimaryEmail_16.png"
  | "msdyncrm_/libs/ckeditor/plugins/embedmedia/icons/embedmedia.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_address.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/cut.png"
  | "cc_MscrmControls.Rating.StarRatingControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/find/icons/find.png"
  | "msdyncrm_/libs/ckeditor/plugins/superimage/icons/cannedchat.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_h6.png"
  | "CRM/_imgs/ribbon/DetectAll_16.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/copilotrefinement.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/icons_hidpi.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/bold.png"
  | "msdyncrm_/libs/ckeditor/plugins/icons.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/preview/images/pagebreak.gif"
  | "cc_MscrmControls.FieldControls.CheckboxControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/paste.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/envelope.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/superimage/icons/reset.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/about/dialogs/logo_ckeditor.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/justifyblock.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/find/icons/hidpi/find.png"
  | "Activities/Images/SendAsAppointment_32.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/regular_smile.png"
  | "cc_MscrmControls.WebsitePreview.PreviewControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/refresh.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/spinner.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/superscript.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_h3.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/thumbs_down.png"
  | "cc_MscrmControls.FieldControls.AdvancedLookupControl/img/NoResults.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_h4.png"
  | "cc_Intelligence.BusinessCardReaderControl.BusinessCardReader/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/refresh.png"
  | "msdyncrm_/libs/ckeditor/plugins/unsubscribe/icons/unsubscribe.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/hidpi/justifyblock.png"
  | "cc_MscrmControls.AutoComplete.AutoCompleteControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/copyformatting/icons/copyformatting.png"
  | "msdyncrm_/libs/ckeditor/plugins/showblocks/images/block_h2.png"
  | "CRM/_imgs/ribbon/Overwrite_32.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/icons.png"
  | "AppCommon/_imgs/Workplace/ConvertActivity_32.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/refresh.png"
  | "CRM/_imgs/ribbon/DetectDuplicates_16.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/lock.png"
  | "AppCommon/_imgs/Workplace/ConvertActivity_16.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/whatchutalkingabout_smile.gif"
  | "cc_MscrmControls.TemplateGalleryHostControl.TemplateGalleryHostControl/imgs/Preview.jpg"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_p.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/tounge_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/lock.png"
  | "msdyncrm_/libs/ckeditor/plugins/magicline/images/hidpi/icon-rtl.png"
  | "cc_MscrmControls.Map.MapControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/arrow.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/justifyblock.png"
  | "msdyncrm_/libs/ckeditor/plugins/about/dialogs/logo_ckeditor.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/hidpi/bold.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/image/images/noimage.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/hidpi/paste-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_pre.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/hidpi/copy.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/lightbulb.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/iframe/images/placeholder.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/copilotrefinementclose.png"
  | "cc_MscrmControls.FieldControls.FileControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/blockquote/icons/hidpi/blockquote.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/justifycenter.png"
  | "cc_MscrmControls.Knob.ArcKnobControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/about/dialogs/hidpi/logo_ckeditor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/kiss.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/find/icons/hidpi/replace.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/strike.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/colorbutton/icons/hidpi/bgcolor.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/hidpi/lock-open.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/justifyleft.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/magicline/images/hidpi/icon-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/justifyleft.png"
  | "msdyncrm_/libs/ckeditor/plugins/about/dialogs/hidpi/logo_ckeditor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/checkmark.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/regular_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/hidpi/subscript.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/bidi/icons/hidpi/bidiltr.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/pastefromword/icons/hidpi/pastefromword-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/superimage/icons/lock.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/heart.gif"
  | "msa_adx_sitesetting_small"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/close.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/kiss.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/bidi/icons/bidiltr.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/hidpi/error.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/copilotrefinement.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/unsubscribe/icons/hidpi/unsubscribe.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/sad_smile.png"
  | "cc_MscrmControls.SampleEditorCustomControl.SampleEditorCustomControl/imgs/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_blockquote.png"
  | "msdyncrm_/libs/ckeditor/plugins/blockquote/icons/blockquote.png"
  | "Theme_NavBarLogo.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/wink_smile.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/spinner.gif"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/hidpi/lock.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/thumbs_down.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/skins/superowa/images/notificationclose.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/close.png"
  | "msdyncrm_/libs/ckeditor/plugins/justify/icons/hidpi/justifyblock.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_div.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/magicline/images/icon.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/devil_smile.png"
  | "CRM/_imgs/ribbon/Overwrite_16.png"
  | "cc_MscrmControls.NumberInput.NumberInputControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/embarrassed_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/flash/images/placeholder.png"
  | "cc_MscrmControls.FieldControls.ImageControl/img/preview.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/showblocks/images/block_h5.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/angry_smile.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/notificationclose.png"
  | "msdyncrm_/libs/ckeditor/plugins/find/icons/hidpi/find.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/embedmedia/icons/embedmedia.png"
  | "msdyncrm_/KnowledgeManagementFeatureWebResource/_imgs/ribbon/NewRecord_16.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/superscript.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/close.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/magicline/images/hidpi/icon-rtl.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/arrow.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/devil_smile.gif"
  | "msdyncrm_/libs/ckeditor/plugins/forms/images/hiddenfield.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/pastefromword/icons/hidpi/pastefromword.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/checkmark.png"
  | "msdyncrm_/libs/ckeditor/skins/superowa/images/lock.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/thumbs_up.png"
  | "msdyn_/Images/Subarea_Webresource_Default_Icon.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/cry_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/copyformatting/icons/copyformatting.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/hidpi/underline.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/teeth_smile.png"
  | "cc_MscrmControls.KbEditorControl.KbEditorControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/colorbutton/icons/hidpi/bgcolor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/magicline/images/icon-rtl.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/angry_smile.gif"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/find/icons/replace.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/pastefromword/icons/pastefromword.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/embarrassed_smile.png"
  | "CRM/_imgs/ribbon/MergeRecords_32.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/sparkles.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/angry_smile.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/collapsible/icons/hidpi/collapsible.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/basicstyles/icons/subscript.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/copy-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/icons_hidpi.png"
  | "msdyncrm_/libs/ckeditor/plugins/colorbutton/icons/textcolor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/blockquote/icons/blockquote.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/colorbutton/icons/bgcolor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/whatchutalkingabout_smile.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/magicline/images/hidpi/icon.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/cry_smile.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/widget/images/handle.png"
  | "cc_MscrmControls.Multimedia.MultimediaPlayerControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/smiley/images/kiss.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/skins/superowa/images/hidpi/lock.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/hidpi/lock-open.png"
  | "msdyncrm_/libs/ckeditor/skins/moono-lisa/images/hidpi/close.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/bidi/icons/hidpi/bidirtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/colorbutton/icons/textcolor.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/find/icons/hidpi/find-rtl.png"
  | "cc_MscrmControls.FieldControls.AdvancedLookupControl/img/Error.png"
  | "cc_PowerApps.CoreControls.Checkbox/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/pastefromword/icons/pastefromword-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/smiley/images/wink_smile.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/hidpi/cut-rtl.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/hidpi/strike.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/justify/icons/justifyright.png"
  | "msdyncrm_/libs/ckeditor/plugins/basicstyles/icons/hidpi/superscript.png"
  | "cc_MscrmControls.FieldControls.ToggleControl/img/preview.png"
  | "msdyncrm_/libs/ckeditor/plugins/clipboard/icons/copy.png"
  | "msdyncrm_/libs/ckeditor/plugins/find/icons/find-rtl.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor/plugins/magicline/images/hidpi/icon.png"
  | "msdyn_/RichTextEditorControl/libs/ckeditor_latest/plugins/unsubscribe/icons/hidpi/unsubscribe.png"
declare const enum LCID {
  English = 1033,
}
interface WebMappingRetrieve<ISelect, IExpand, IFilter, IFixed, Result, FormattedResult> {
}
interface WebMappingCUDA<ICreate, IUpdate, ISelect> {
}
interface WebMappingRelated<ISingle, IMultiple> {
}
interface WebEntity {
}
interface WebEntity_Fixed {
  "@odata.etag": string;
}
interface ys_dbmobject_Base extends WebEntity {
}
interface ys_dbmobject_Fixed extends WebEntity_Fixed {
  ys_dbmobjectid: string;
}
interface ys_dbmobject extends ys_dbmobject_Base, ys_dbmobject_Relationships {
}
interface ys_dbmobject_Relationships {
}
interface ys_dbmobject_Result extends ys_dbmobject_Base, ys_dbmobject_Relationships {
}
interface ys_dbmobject_FormattedResult {
}
interface ys_dbmobject_Select {
}
interface ys_dbmobject_Expand {
}
interface ys_dbmobject_Filter {
}
interface ys_dbmobject_Create extends ys_dbmobject {
}
interface ys_dbmobject_Update extends ys_dbmobject {
}
interface ys_dbmscript_Base extends WebEntity {
}
interface ys_dbmscript_Fixed extends WebEntity_Fixed {
  ys_dbmscriptid: string;
}
interface ys_dbmscript extends ys_dbmscript_Base, ys_dbmscript_Relationships {
}
interface ys_dbmscript_Relationships {
}
interface ys_dbmscript_Result extends ys_dbmscript_Base, ys_dbmscript_Relationships {
}
interface ys_dbmscript_FormattedResult {
}
interface ys_dbmscript_Select {
}
interface ys_dbmscript_Expand {
}
interface ys_dbmscript_Filter {
}
interface ys_dbmscript_Create extends ys_dbmscript {
}
interface ys_dbmscript_Update extends ys_dbmscript {
}
interface ys_dbmobject_Base extends WebEntity {
  createdon?: Date | null;
  importsequencenumber?: number | null;
  modifiedon?: Date | null;
  overriddencreatedon?: Date | null;
  statecode?: ys_dbmobject_statecode | null;
  statuscode?: ys_dbmobject_statuscode | null;
  timezoneruleversionnumber?: number | null;
  utcconversiontimezonecode?: number | null;
  versionnumber?: number | null;
  ys_dbmobjectid?: string | null;
  ys_description?: string | null;
  ys_name?: string | null;
  ys_uniqueid?: string | null;
  ys_updated?: string | null;
}
interface ys_dbmobject_Relationships {
}
interface ys_dbmobject extends ys_dbmobject_Base, ys_dbmobject_Relationships {
  ownerid_bind$systemusers?: string | null;
  ownerid_bind$teams?: string | null;
}
interface ys_dbmobject_Create extends ys_dbmobject {
}
interface ys_dbmobject_Update extends ys_dbmobject {
}
interface ys_dbmobject_Select {
  createdby_guid: WebAttribute<ys_dbmobject_Select, { createdby_guid: string | null }, { createdby_formatted?: string }>;
  createdon: WebAttribute<ys_dbmobject_Select, { createdon: Date | null }, { createdon_formatted?: string }>;
  createdonbehalfby_guid: WebAttribute<ys_dbmobject_Select, { createdonbehalfby_guid: string | null }, { createdonbehalfby_formatted?: string }>;
  importsequencenumber: WebAttribute<ys_dbmobject_Select, { importsequencenumber: number | null }, {  }>;
  modifiedby_guid: WebAttribute<ys_dbmobject_Select, { modifiedby_guid: string | null }, { modifiedby_formatted?: string }>;
  modifiedon: WebAttribute<ys_dbmobject_Select, { modifiedon: Date | null }, { modifiedon_formatted?: string }>;
  modifiedonbehalfby_guid: WebAttribute<ys_dbmobject_Select, { modifiedonbehalfby_guid: string | null }, { modifiedonbehalfby_formatted?: string }>;
  overriddencreatedon: WebAttribute<ys_dbmobject_Select, { overriddencreatedon: Date | null }, { overriddencreatedon_formatted?: string }>;
  ownerid_guid: WebAttribute<ys_dbmobject_Select, { ownerid_guid: string | null }, { ownerid_formatted?: string }>;
  owningbusinessunit_guid: WebAttribute<ys_dbmobject_Select, { owningbusinessunit_guid: string | null }, { owningbusinessunit_formatted?: string }>;
  owningteam_guid: WebAttribute<ys_dbmobject_Select, { owningteam_guid: string | null }, { owningteam_formatted?: string }>;
  owninguser_guid: WebAttribute<ys_dbmobject_Select, { owninguser_guid: string | null }, { owninguser_formatted?: string }>;
  statecode: WebAttribute<ys_dbmobject_Select, { statecode: ys_dbmobject_statecode | null }, { statecode_formatted?: string }>;
  statuscode: WebAttribute<ys_dbmobject_Select, { statuscode: ys_dbmobject_statuscode | null }, { statuscode_formatted?: string }>;
  timezoneruleversionnumber: WebAttribute<ys_dbmobject_Select, { timezoneruleversionnumber: number | null }, {  }>;
  utcconversiontimezonecode: WebAttribute<ys_dbmobject_Select, { utcconversiontimezonecode: number | null }, {  }>;
  versionnumber: WebAttribute<ys_dbmobject_Select, { versionnumber: number | null }, {  }>;
  ys_dbmobjectid: WebAttribute<ys_dbmobject_Select, { ys_dbmobjectid: string | null }, {  }>;
  ys_description: WebAttribute<ys_dbmobject_Select, { ys_description: string | null }, {  }>;
  ys_name: WebAttribute<ys_dbmobject_Select, { ys_name: string | null }, {  }>;
  ys_uniqueid: WebAttribute<ys_dbmobject_Select, { ys_uniqueid: string | null }, {  }>;
  ys_updated: WebAttribute<ys_dbmobject_Select, { ys_updated: string | null }, {  }>;
}
interface ys_dbmobject_Filter {
  createdby_guid: XQW.Guid;
  createdon: Date;
  createdonbehalfby_guid: XQW.Guid;
  importsequencenumber: number;
  modifiedby_guid: XQW.Guid;
  modifiedon: Date;
  modifiedonbehalfby_guid: XQW.Guid;
  overriddencreatedon: Date;
  ownerid_guid: XQW.Guid;
  owningbusinessunit_guid: XQW.Guid;
  owningteam_guid: XQW.Guid;
  owninguser_guid: XQW.Guid;
  statecode: ys_dbmobject_statecode;
  statuscode: ys_dbmobject_statuscode;
  timezoneruleversionnumber: number;
  utcconversiontimezonecode: number;
  versionnumber: number;
  ys_dbmobjectid: XQW.Guid;
  ys_description: string;
  ys_name: string;
  ys_uniqueid: string;
  ys_updated: string;
}
interface ys_dbmobject_Expand {
}
interface ys_dbmobject_FormattedResult {
  createdby_formatted?: string;
  createdon_formatted?: string;
  createdonbehalfby_formatted?: string;
  modifiedby_formatted?: string;
  modifiedon_formatted?: string;
  modifiedonbehalfby_formatted?: string;
  overriddencreatedon_formatted?: string;
  ownerid_formatted?: string;
  owningbusinessunit_formatted?: string;
  owningteam_formatted?: string;
  owninguser_formatted?: string;
  statecode_formatted?: string;
  statuscode_formatted?: string;
}
interface ys_dbmobject_Result extends ys_dbmobject_Base, ys_dbmobject_Relationships {
  "@odata.etag": string;
  createdby_guid: string | null;
  createdonbehalfby_guid: string | null;
  modifiedby_guid: string | null;
  modifiedonbehalfby_guid: string | null;
  ownerid_guid: string | null;
  owningbusinessunit_guid: string | null;
  owningteam_guid: string | null;
  owninguser_guid: string | null;
}
interface ys_dbmobject_RelatedOne {
}
interface ys_dbmobject_RelatedMany {
}
interface WebEntitiesRetrieve {
  ys_dbmobjects: WebMappingRetrieve<ys_dbmobject_Select,ys_dbmobject_Expand,ys_dbmobject_Filter,ys_dbmobject_Fixed,ys_dbmobject_Result,ys_dbmobject_FormattedResult>;
}
interface WebEntitiesRelated {
  ys_dbmobjects: WebMappingRelated<ys_dbmobject_RelatedOne,ys_dbmobject_RelatedMany>;
}
interface WebEntitiesCUDA {
  ys_dbmobjects: WebMappingCUDA<ys_dbmobject_Create,ys_dbmobject_Update,ys_dbmobject_Select>;
}
interface ys_dbmscript_Base extends WebEntity {
  createdon?: Date | null;
  importsequencenumber?: number | null;
  modifiedon?: Date | null;
  overriddencreatedon?: Date | null;
  statecode?: ys_dbmscript_statecode | null;
  statuscode?: ys_dbmscript_statuscode | null;
  timezoneruleversionnumber?: number | null;
  utcconversiontimezonecode?: number | null;
  versionnumber?: number | null;
  ys_dbmscriptid?: string | null;
  ys_description?: string | null;
  ys_name?: string | null;
  ys_triggerchange?: string | null;
  ys_uniqueid?: string | null;
  ys_updated?: string | null;
}
interface ys_dbmscript_Relationships {
}
interface ys_dbmscript extends ys_dbmscript_Base, ys_dbmscript_Relationships {
  ownerid_bind$systemusers?: string | null;
  ownerid_bind$teams?: string | null;
}
interface ys_dbmscript_Create extends ys_dbmscript {
}
interface ys_dbmscript_Update extends ys_dbmscript {
}
interface ys_dbmscript_Select {
  createdby_guid: WebAttribute<ys_dbmscript_Select, { createdby_guid: string | null }, { createdby_formatted?: string }>;
  createdon: WebAttribute<ys_dbmscript_Select, { createdon: Date | null }, { createdon_formatted?: string }>;
  createdonbehalfby_guid: WebAttribute<ys_dbmscript_Select, { createdonbehalfby_guid: string | null }, { createdonbehalfby_formatted?: string }>;
  importsequencenumber: WebAttribute<ys_dbmscript_Select, { importsequencenumber: number | null }, {  }>;
  modifiedby_guid: WebAttribute<ys_dbmscript_Select, { modifiedby_guid: string | null }, { modifiedby_formatted?: string }>;
  modifiedon: WebAttribute<ys_dbmscript_Select, { modifiedon: Date | null }, { modifiedon_formatted?: string }>;
  modifiedonbehalfby_guid: WebAttribute<ys_dbmscript_Select, { modifiedonbehalfby_guid: string | null }, { modifiedonbehalfby_formatted?: string }>;
  overriddencreatedon: WebAttribute<ys_dbmscript_Select, { overriddencreatedon: Date | null }, { overriddencreatedon_formatted?: string }>;
  ownerid_guid: WebAttribute<ys_dbmscript_Select, { ownerid_guid: string | null }, { ownerid_formatted?: string }>;
  owningbusinessunit_guid: WebAttribute<ys_dbmscript_Select, { owningbusinessunit_guid: string | null }, { owningbusinessunit_formatted?: string }>;
  owningteam_guid: WebAttribute<ys_dbmscript_Select, { owningteam_guid: string | null }, { owningteam_formatted?: string }>;
  owninguser_guid: WebAttribute<ys_dbmscript_Select, { owninguser_guid: string | null }, { owninguser_formatted?: string }>;
  statecode: WebAttribute<ys_dbmscript_Select, { statecode: ys_dbmscript_statecode | null }, { statecode_formatted?: string }>;
  statuscode: WebAttribute<ys_dbmscript_Select, { statuscode: ys_dbmscript_statuscode | null }, { statuscode_formatted?: string }>;
  timezoneruleversionnumber: WebAttribute<ys_dbmscript_Select, { timezoneruleversionnumber: number | null }, {  }>;
  utcconversiontimezonecode: WebAttribute<ys_dbmscript_Select, { utcconversiontimezonecode: number | null }, {  }>;
  versionnumber: WebAttribute<ys_dbmscript_Select, { versionnumber: number | null }, {  }>;
  ys_dbmscriptid: WebAttribute<ys_dbmscript_Select, { ys_dbmscriptid: string | null }, {  }>;
  ys_description: WebAttribute<ys_dbmscript_Select, { ys_description: string | null }, {  }>;
  ys_name: WebAttribute<ys_dbmscript_Select, { ys_name: string | null }, {  }>;
  ys_triggerchange: WebAttribute<ys_dbmscript_Select, { ys_triggerchange: string | null }, {  }>;
  ys_uniqueid: WebAttribute<ys_dbmscript_Select, { ys_uniqueid: string | null }, {  }>;
  ys_updated: WebAttribute<ys_dbmscript_Select, { ys_updated: string | null }, {  }>;
}
interface ys_dbmscript_Filter {
  createdby_guid: XQW.Guid;
  createdon: Date;
  createdonbehalfby_guid: XQW.Guid;
  importsequencenumber: number;
  modifiedby_guid: XQW.Guid;
  modifiedon: Date;
  modifiedonbehalfby_guid: XQW.Guid;
  overriddencreatedon: Date;
  ownerid_guid: XQW.Guid;
  owningbusinessunit_guid: XQW.Guid;
  owningteam_guid: XQW.Guid;
  owninguser_guid: XQW.Guid;
  statecode: ys_dbmscript_statecode;
  statuscode: ys_dbmscript_statuscode;
  timezoneruleversionnumber: number;
  utcconversiontimezonecode: number;
  versionnumber: number;
  ys_dbmscriptid: XQW.Guid;
  ys_description: string;
  ys_name: string;
  ys_triggerchange: string;
  ys_uniqueid: string;
  ys_updated: string;
}
interface ys_dbmscript_Expand {
}
interface ys_dbmscript_FormattedResult {
  createdby_formatted?: string;
  createdon_formatted?: string;
  createdonbehalfby_formatted?: string;
  modifiedby_formatted?: string;
  modifiedon_formatted?: string;
  modifiedonbehalfby_formatted?: string;
  overriddencreatedon_formatted?: string;
  ownerid_formatted?: string;
  owningbusinessunit_formatted?: string;
  owningteam_formatted?: string;
  owninguser_formatted?: string;
  statecode_formatted?: string;
  statuscode_formatted?: string;
}
interface ys_dbmscript_Result extends ys_dbmscript_Base, ys_dbmscript_Relationships {
  "@odata.etag": string;
  createdby_guid: string | null;
  createdonbehalfby_guid: string | null;
  modifiedby_guid: string | null;
  modifiedonbehalfby_guid: string | null;
  ownerid_guid: string | null;
  owningbusinessunit_guid: string | null;
  owningteam_guid: string | null;
  owninguser_guid: string | null;
}
interface ys_dbmscript_RelatedOne {
}
interface ys_dbmscript_RelatedMany {
}
interface WebEntitiesRetrieve {
  ys_dbmscripts: WebMappingRetrieve<ys_dbmscript_Select,ys_dbmscript_Expand,ys_dbmscript_Filter,ys_dbmscript_Fixed,ys_dbmscript_Result,ys_dbmscript_FormattedResult>;
}
interface WebEntitiesRelated {
  ys_dbmscripts: WebMappingRelated<ys_dbmscript_RelatedOne,ys_dbmscript_RelatedMany>;
}
interface WebEntitiesCUDA {
  ys_dbmscripts: WebMappingCUDA<ys_dbmscript_Create,ys_dbmscript_Update,ys_dbmscript_Select>;
}
