(function (global) {
  const config = {
  "formId": "review-form",
  "displayName": "Review Form",
  "defaultStateId": "review-decision-state",
  "sections": [
    {
      "id": "review-summary-region",
      "tabName": "review_main_tab",
      "sectionName": "review_summary_section",
      "controls": [
        {
          "controlName": "dbm_requestid",
          "readOnly": false
        },
        {
          "controlName": "dbm_decisionsummary",
          "readOnly": true
        }
      ]
    },
    {
      "id": "review-resolution-region",
      "tabName": "review_main_tab",
      "sectionName": "review_resolution_section",
      "controls": [
        {
          "controlName": "dbm_decisioncomment",
          "readOnly": false
        }
      ]
    }
  ],
  "states": [
    {
      "id": "review-decision-state",
      "displayName": "Decision",
      "visibleControlNames": [
        "dbm_requestid",
        "dbm_decisionsummary"
      ],
      "requiredControlNames": [],
      "lockedControlNames": [
        "dbm_decisionsummary"
      ]
    },
    {
      "id": "review-approval-state",
      "displayName": "Approval Capture",
      "visibleControlNames": [
        "dbm_requestid",
        "dbm_decisionsummary"
      ],
      "requiredControlNames": [],
      "lockedControlNames": [
        "dbm_decisionsummary"
      ]
    },
    {
      "id": "review-rejection-state",
      "displayName": "Rejection Capture",
      "visibleControlNames": [
        "dbm_decisioncomment",
        "dbm_requestid",
        "dbm_decisionsummary"
      ],
      "requiredControlNames": [
        "dbm_decisioncomment"
      ],
      "lockedControlNames": [
        "dbm_decisionsummary"
      ]
    }
  ]
};
  function dbmOnLoad_review_form(executionContext) {
    if (!global.DBM || !global.DBM.FormBehavior || typeof global.DBM.FormBehavior.apply !== "function") {
      return;
    }
    global.DBM.FormBehavior.apply(executionContext, config, config.defaultStateId);
  }
  global.dbmOnLoad_review_form = dbmOnLoad_review_form;
})(window);
