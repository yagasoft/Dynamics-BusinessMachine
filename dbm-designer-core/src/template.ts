import type { DbmModelV1 } from 'dbm-contract';
import approvalRequestTemplate from '../../docs/architecture/examples/approval-request-v1.model.json';

export function createApprovalRequestTemplate(): DbmModelV1 {
  return structuredClone(approvalRequestTemplate as DbmModelV1);
}
