using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;

namespace Yagasoft.Dbm.Plugins.PortalRuntime
{
	public static class DbmRequestPortalRuntimeRules
	{
		public const string RequestEntityLogicalName = "dbm_request";
		public const string TitleLogicalName = "dbm_title";
		public const string AmountLogicalName = "dbm_amount";
		public const string AssignedApproverLogicalName = "dbm_assignedapprover";
		public const string SupportingNotesLogicalName = "dbm_supportingnotes";
		public const string CurrentStageLogicalName = "dbm_currentstageid";
		public const string CurrentStepLogicalName = "dbm_currentstepid";
		public const string CurrentFormStateLogicalName = "dbm_currentformstateid";
		public const string InternalStatusLogicalName = "dbm_internalstatusid";
		public const string PortalStatusLogicalName = "dbm_portalstatusid";
		public const string PortalCommandLogicalName = "dbm_portalcommand";
		public const string PortalProfileKeyLogicalName = "dbm_portalprofilekey";

		public const string DraftStageId = "draft-request";
		public const string DraftStepId = "capture-request";
		public const string DraftFormStateId = "request-edit-state";
		public const string DraftInternalStatusId = "draft";
		public const string DraftPortalStatusId = "draft";
		public const string InternalScreeningStageId = "internal-screening-stage";
		public const string InternalScreeningStepId = "screen-request";
		public const string InternalScreeningFormStateId = "request-screening-state";
		public const string InternalScreeningStatusId = "internal-screening";
		public const string UnderReviewPortalStatusId = "under-review";
		public const string PortalSubmitCommand = "submit";
		public const string GenericProfileKey = "dev-anonymous-requester";

		public static void InitialiseDraftRuntimeState(Entity target)
		{
			target[CurrentStageLogicalName] = DraftStageId;
			target[CurrentStepLogicalName] = DraftStepId;
			target[CurrentFormStateLogicalName] = DraftFormStateId;
			target[InternalStatusLogicalName] = DraftInternalStatusId;
			target[PortalStatusLogicalName] = DraftPortalStatusId;
			target[PortalCommandLogicalName] = null;

			EnsureGenericProfileKey(target);
		}

		public static bool IsDraftRuntimeState(Entity current)
		{
			var currentStageId = current.GetAttributeValue<string>(CurrentStageLogicalName);
			return IsDraftRuntimeStage(currentStageId);
		}

		public static bool IsDraftRuntimeStage(string currentStageId)
		{
			return string.IsNullOrWhiteSpace(currentStageId)
				|| string.Equals(currentStageId, DraftStageId, StringComparison.OrdinalIgnoreCase);
		}

		public static IReadOnlyList<string> ValidateSubmitFields(string title, Money amount, string assignedApprover, string supportingNotes)
		{
			var errors = new List<string>();

			if (string.IsNullOrWhiteSpace(title))
			{
				errors.Add("Request Title is required before portal submit.");
			}

			if (amount == null)
			{
				errors.Add("Request Amount is required before portal submit.");
			}

			if (string.IsNullOrWhiteSpace(assignedApprover))
			{
				errors.Add("Assigned Approver is required before portal submit.");
			}

			if (amount != null && amount.Value >= 5000m && string.IsNullOrWhiteSpace(supportingNotes))
			{
				errors.Add("Supporting Notes are required when the request amount is 5000 or greater.");
			}

			return errors;
		}

		public static void ApplySubmittedRuntimeState(Entity target)
		{
			target[CurrentStageLogicalName] = InternalScreeningStageId;
			target[CurrentStepLogicalName] = InternalScreeningStepId;
			target[CurrentFormStateLogicalName] = InternalScreeningFormStateId;
			target[InternalStatusLogicalName] = InternalScreeningStatusId;
			target[PortalStatusLogicalName] = UnderReviewPortalStatusId;
			target[PortalCommandLogicalName] = null;

			EnsureGenericProfileKey(target);
		}

		private static void EnsureGenericProfileKey(Entity target)
		{
			var portalProfileKey = target.GetAttributeValue<string>(PortalProfileKeyLogicalName);
			if (string.IsNullOrWhiteSpace(portalProfileKey))
			{
				target[PortalProfileKeyLogicalName] = GenericProfileKey;
			}
		}
	}
}
