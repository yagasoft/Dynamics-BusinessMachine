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
          "controlName": "dbm_decisionoutcome",
          "readOnly": false
        },
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
        "dbm_decisionsummary",
        "dbm_decisionoutcome"
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
        "dbm_decisionsummary",
        "dbm_decisionoutcome"
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
        "dbm_decisionsummary",
        "dbm_decisionoutcome"
      ],
      "requiredControlNames": [
        "dbm_decisioncomment"
      ],
      "lockedControlNames": [
        "dbm_decisionsummary"
      ]
    }
  ],
  "runtime": {
    "requestEntityLogicalName": "dbm_request",
    "requestEntityPrimaryIdLogicalName": "dbm_requestid",
    "currentFormEntityLogicalName": "dbm_requestdecision",
    "relatedRequestLookupFieldLogicalName": "dbm_requestid",
    "reviewEntityLogicalName": "dbm_requestdecision",
    "reviewEntityRequestLookupFieldLogicalName": "dbm_requestid",
    "runtimeStateFieldLogicalNames": {
      "stageId": "dbm_currentstageid",
      "stepId": "dbm_currentstepid",
      "formStateId": "dbm_currentformstateid",
      "internalStatusId": "dbm_internalstatusid",
      "portalStatusId": "dbm_portalstatusid"
    },
    "decisionOutcomeFieldLogicalName": "dbm_decisionoutcome",
    "decisionSummaryFieldLogicalName": "dbm_decisionsummary",
    "decisionCommentFieldLogicalName": "dbm_decisioncomment",
    "defaultStageId": "draft-request",
    "defaultStepId": "capture-request",
    "defaultFormStateId": "request-edit-state",
    "statuses": [
      {
        "id": "draft",
        "displayName": "Draft"
      },
      {
        "id": "under-review",
        "displayName": "Under Review"
      },
      {
        "id": "internal-screening",
        "displayName": "Internal Screening"
      },
      {
        "id": "awaiting-manager-decision",
        "displayName": "Awaiting Manager Decision"
      },
      {
        "id": "approved",
        "displayName": "Approved"
      },
      {
        "id": "rejected",
        "displayName": "Rejected"
      }
    ],
    "stages": [
      {
        "id": "draft-request",
        "displayName": "Draft Request",
        "stageType": "start",
        "formId": "request-form",
        "defaultStepId": "capture-request"
      },
      {
        "id": "internal-screening-stage",
        "displayName": "Internal Screening",
        "stageType": "system",
        "formId": "request-form",
        "defaultStepId": "screen-request"
      },
      {
        "id": "manager-review",
        "displayName": "Manager Review",
        "stageType": "approval",
        "formId": "review-form",
        "defaultStepId": "choose-decision"
      },
      {
        "id": "approved",
        "displayName": "Approved",
        "stageType": "end",
        "formId": null,
        "defaultStepId": null
      },
      {
        "id": "rejected",
        "displayName": "Rejected",
        "stageType": "end",
        "formId": null,
        "defaultStepId": null
      }
    ],
    "steps": [
      {
        "id": "capture-request",
        "stageId": "draft-request",
        "displayName": "Capture Request",
        "internalStatusId": "draft",
        "portalStatusId": "draft",
        "formStateId": "request-edit-state",
        "entryRuleIds": [],
        "exitRuleIds": [
          "request-basic-fields-present"
        ]
      },
      {
        "id": "capture-supporting-details",
        "stageId": "draft-request",
        "displayName": "Capture Supporting Details",
        "internalStatusId": "draft",
        "portalStatusId": "draft",
        "formStateId": "request-supporting-state",
        "entryRuleIds": [
          "supporting-details-needed"
        ],
        "exitRuleIds": [
          "supporting-details-complete"
        ]
      },
      {
        "id": "screen-request",
        "stageId": "internal-screening-stage",
        "displayName": "Screen Request",
        "internalStatusId": "internal-screening",
        "portalStatusId": "under-review",
        "formStateId": "request-screening-state",
        "entryRuleIds": [],
        "exitRuleIds": [
          "screening-complete"
        ]
      },
      {
        "id": "choose-decision",
        "stageId": "manager-review",
        "displayName": "Choose Decision",
        "internalStatusId": "awaiting-manager-decision",
        "portalStatusId": "under-review",
        "formStateId": "review-decision-state",
        "entryRuleIds": [],
        "exitRuleIds": []
      },
      {
        "id": "record-approval",
        "stageId": "manager-review",
        "displayName": "Record Approval",
        "internalStatusId": "approved",
        "portalStatusId": "approved",
        "formStateId": "review-approval-state",
        "entryRuleIds": [
          "approval-path-selected"
        ],
        "exitRuleIds": [
          "approval-step-complete"
        ]
      },
      {
        "id": "record-rejection",
        "stageId": "manager-review",
        "displayName": "Record Rejection",
        "internalStatusId": "rejected",
        "portalStatusId": "rejected",
        "formStateId": "review-rejection-state",
        "entryRuleIds": [
          "rejection-path-selected"
        ],
        "exitRuleIds": [
          "rejection-step-complete"
        ]
      }
    ],
    "stepTransitions": [
      {
        "id": "capture-to-supporting",
        "fromStepId": "capture-request",
        "guardRuleId": "supporting-details-needed",
        "target": {
          "stepId": "capture-supporting-details"
        }
      },
      {
        "id": "capture-to-screening",
        "fromStepId": "capture-request",
        "guardRuleId": "request-ready-for-screening",
        "target": {
          "stageId": "internal-screening-stage"
        }
      },
      {
        "id": "supporting-to-screening",
        "fromStepId": "capture-supporting-details",
        "guardRuleId": "supporting-details-complete",
        "target": {
          "stageId": "internal-screening-stage"
        }
      },
      {
        "id": "screening-to-review",
        "fromStepId": "screen-request",
        "guardRuleId": "screening-complete",
        "target": {
          "stageId": "manager-review"
        }
      },
      {
        "id": "choose-to-approval",
        "fromStepId": "choose-decision",
        "guardRuleId": "approval-path-selected",
        "target": {
          "stepId": "record-approval"
        }
      },
      {
        "id": "choose-to-rejection",
        "fromStepId": "choose-decision",
        "guardRuleId": "rejection-path-selected",
        "target": {
          "stepId": "record-rejection"
        }
      },
      {
        "id": "approval-to-approved",
        "fromStepId": "record-approval",
        "guardRuleId": "approval-step-complete",
        "target": {
          "stageId": "approved"
        }
      },
      {
        "id": "rejection-to-rejected",
        "fromStepId": "record-rejection",
        "guardRuleId": "rejection-step-complete",
        "target": {
          "stageId": "rejected"
        }
      }
    ],
    "rules": {
      "request-basic-fields-present": "notEmpty(request-title) and notEmpty(request-amount) and notEmpty(assigned-approver)",
      "supporting-details-needed": "request-amount >= 5000",
      "supporting-details-complete": "request-amount < 5000 or notEmpty(supporting-notes)",
      "request-ready-for-screening": "notEmpty(request-title) and notEmpty(request-amount) and notEmpty(assigned-approver)",
      "screening-complete": "screening-result == 'complete'",
      "approval-path-selected": "requestedOutcomeId == 'approve'",
      "rejection-path-selected": "requestedOutcomeId == 'reject'",
      "approval-step-complete": "requestedOutcomeId == 'approve'",
      "rejection-step-complete": "requestedOutcomeId != 'reject' or notEmpty(decision-comment)"
    },
    "valueBindings": [
      {
        "token": "request-id",
        "entityLogicalName": "dbm_request",
        "fieldLogicalName": "dbm_requestid",
        "fieldType": "string"
      },
      {
        "token": "request-title",
        "entityLogicalName": "dbm_request",
        "fieldLogicalName": "dbm_title",
        "fieldType": "string"
      },
      {
        "token": "request-amount",
        "entityLogicalName": "dbm_request",
        "fieldLogicalName": "dbm_amount",
        "fieldType": "currency"
      },
      {
        "token": "supporting-notes",
        "entityLogicalName": "dbm_request",
        "fieldLogicalName": "dbm_supportingnotes",
        "fieldType": "multiline-string"
      },
      {
        "token": "assigned-approver",
        "entityLogicalName": "dbm_request",
        "fieldLogicalName": "dbm_assignedapprover",
        "fieldType": "string"
      },
      {
        "token": "screening-result",
        "entityLogicalName": "dbm_request",
        "fieldLogicalName": "dbm_screeningresult",
        "fieldType": "choice",
        "choiceMap": {
          "100000000": "pending",
          "100000001": "complete",
          "100000002": "blocked"
        }
      },
      {
        "token": "decision-id",
        "entityLogicalName": "dbm_requestdecision",
        "fieldLogicalName": "dbm_requestdecisionid",
        "fieldType": "string"
      },
      {
        "token": "decision-request",
        "entityLogicalName": "dbm_requestdecision",
        "fieldLogicalName": "dbm_requestid",
        "fieldType": "lookup"
      },
      {
        "token": "decision-outcome",
        "entityLogicalName": "dbm_requestdecision",
        "fieldLogicalName": "dbm_decisionoutcome",
        "fieldType": "choice",
        "choiceMap": {
          "100000000": "approve",
          "100000001": "reject"
        }
      },
      {
        "token": "decision-summary",
        "entityLogicalName": "dbm_requestdecision",
        "fieldLogicalName": "dbm_decisionsummary",
        "fieldType": "multiline-string"
      },
      {
        "token": "decision-comment",
        "entityLogicalName": "dbm_requestdecision",
        "fieldLogicalName": "dbm_decisioncomment",
        "fieldType": "multiline-string"
      },
      {
        "token": "requestedOutcomeId",
        "entityLogicalName": "dbm_requestdecision",
        "fieldLogicalName": "dbm_decisionoutcome",
        "fieldType": "choice",
        "choiceMap": {
          "100000000": "approve",
          "100000001": "reject"
        }
      }
    ]
  }
};
  function dbmOnLoad_review_form(executionContext) {
    if (!global.DBM || !global.DBM.ProcessRuntime || typeof global.DBM.ProcessRuntime.initialize !== "function") {
      return;
    }
    global.DBM.ProcessRuntime.initialize(executionContext, config);
  }
  global.dbmOnLoad_review_form = dbmOnLoad_review_form;
})(window);
