(function (global) {
  const config = {
  "formId": "request-form",
  "displayName": "Request Form",
  "defaultStateId": "request-edit-state",
  "sections": [
    {
      "id": "request-details-region",
      "tabName": "request_main_tab",
      "sectionName": "request_details_section",
      "controls": [
        {
          "controlName": "dbm_title",
          "readOnly": false
        },
        {
          "controlName": "dbm_amount",
          "readOnly": false
        },
        {
          "controlName": "dbm_assignedapprover",
          "readOnly": false
        }
      ]
    },
    {
      "id": "request-supporting-region",
      "tabName": "request_main_tab",
      "sectionName": "request_supporting_section",
      "controls": [
        {
          "controlName": "dbm_supportingnotes",
          "readOnly": false
        }
      ]
    },
    {
      "id": "request-screening-region",
      "tabName": "request_main_tab",
      "sectionName": "request_screening_section",
      "controls": [
        {
          "controlName": "dbm_screeningresult",
          "readOnly": false
        }
      ]
    }
  ],
  "states": [
    {
      "id": "request-edit-state",
      "displayName": "Request Edit",
      "visibleControlNames": [
        "dbm_title",
        "dbm_amount",
        "dbm_assignedapprover"
      ],
      "requiredControlNames": [
        "dbm_title",
        "dbm_amount",
        "dbm_assignedapprover"
      ],
      "lockedControlNames": []
    },
    {
      "id": "request-supporting-state",
      "displayName": "Supporting Details",
      "visibleControlNames": [
        "dbm_supportingnotes",
        "dbm_title",
        "dbm_amount"
      ],
      "requiredControlNames": [
        "dbm_title",
        "dbm_amount"
      ],
      "lockedControlNames": []
    },
    {
      "id": "request-screening-state",
      "displayName": "Screening",
      "visibleControlNames": [
        "dbm_title",
        "dbm_amount",
        "dbm_screeningresult"
      ],
      "requiredControlNames": [
        "dbm_screeningresult"
      ],
      "lockedControlNames": []
    }
  ]
};
  function dbmOnLoad_request_form(executionContext) {
    if (!global.DBM || !global.DBM.FormBehavior || typeof global.DBM.FormBehavior.apply !== "function") {
      return;
    }
    global.DBM.FormBehavior.apply(executionContext, config, config.defaultStateId);
  }
  global.dbmOnLoad_request_form = dbmOnLoad_request_form;
})(window);
