export const liveE2ECaseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenarioId', 'title', 'description', 'runModes', 'requiredRole', 'setup', 'actions', 'assertions', 'cleanup', 'evidence'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    runModes: {
      type: 'array',
      items: { enum: ['full', 'promotion'] },
      minItems: 1,
      uniqueItems: true
    },
    requiredRole: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
    setup: {
      type: 'object',
      additionalProperties: false,
      required: ['operations'],
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias', 'fields'],
            properties: {
              kind: { const: 'seed-record' },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 },
              fields: { type: 'object' }
            }
          }
        }
      }
    },
    actions: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind'],
            properties: {
              kind: { const: 'open-model-driven-url' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              relativeUrlTemplate: { type: 'string' }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias'],
            properties: {
              kind: { const: 'open-new-record-form' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              entityAlias: { type: 'string', minLength: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias'],
            properties: {
              kind: { const: 'open-record-form' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'label', 'value'],
            properties: {
              kind: { enum: ['fill-field', 'set-lookup-field'] },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              label: { type: 'string', minLength: 1 },
              value: { type: 'string' }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'label'],
            properties: {
              kind: { const: 'click-button' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              label: { type: 'string', minLength: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'text'],
            properties: {
              kind: { enum: ['wait-for-text', 'assert-text-not-visible'] },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              text: { type: 'string', minLength: 1 },
              timeoutMs: { type: 'integer', minimum: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'recordAlias'],
            properties: {
              kind: { const: 'capture-current-record-id' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias', 'fieldLogicalName', 'equals'],
            properties: {
              kind: { const: 'capture-related-record' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 },
              fieldLogicalName: { type: 'string', minLength: 1 },
              equals: { type: 'string', minLength: 1 },
              timeoutMs: { type: 'integer', minimum: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind'],
            properties: {
              kind: { const: 'wait-for-idle' },
              role: { enum: ['requester', 'finance-reviewer', 'manager-approver', 'support-admin'] },
              delayMs: { type: 'integer', minimum: 1 }
            }
          }
        ]
      }
    },
    assertions: {
      type: 'array',
      minItems: 1,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias'],
            properties: {
              kind: { const: 'record-exists' },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias', 'fieldLogicalName'],
            properties: {
              kind: { const: 'record-field' },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 },
              fieldLogicalName: { type: 'string', minLength: 1 },
              equals: { type: ['string', 'number', 'boolean'] },
              notEquals: { type: ['string', 'number', 'boolean'] }
            },
            oneOf: [
              { required: ['equals'] },
              { required: ['notEquals'] }
            ]
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias', 'expected'],
            properties: {
              kind: { const: 'process-state' },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 },
              expected: {
                type: 'object',
                additionalProperties: false,
                minProperties: 1,
                properties: {
                  stageId: { type: 'string', minLength: 1 },
                  stepId: { type: 'string', minLength: 1 },
                  internalStatus: { type: 'string', minLength: 1 },
                  portalStatus: { type: 'string', minLength: 1 }
                }
              }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'text'],
            properties: {
              kind: { enum: ['text-visible', 'text-not-visible'] },
              text: { type: 'string', minLength: 1 }
            }
          }
        ]
      }
    },
    cleanup: {
      type: 'object',
      additionalProperties: false,
      required: ['targets'],
      properties: {
        targets: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'entityAlias', 'recordAlias'],
            properties: {
              kind: { const: 'delete-record' },
              entityAlias: { type: 'string', minLength: 1 },
              recordAlias: { type: 'string', minLength: 1 },
              ignoreMissing: { type: 'boolean' }
            }
          }
        }
      }
    },
    evidence: {
      type: 'object',
      additionalProperties: false,
      required: ['captureScreenshotOnSuccess', 'captureTimeline'],
      properties: {
        captureScreenshotOnSuccess: { type: 'boolean' },
        captureTimeline: { type: 'boolean' }
      }
    }
  }
} as const;
