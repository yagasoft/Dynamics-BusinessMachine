using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Yagasoft.Dbm.Plugins.PortalRuntime
{
	public sealed class DbmRequestPortalRuntime : IPlugin
	{
		private const string RequestEntityLogicalName = "dbm_request";
		private const string TitleLogicalName = "dbm_title";
		private const string AmountLogicalName = "dbm_amount";
		private const string AssignedApproverLogicalName = "dbm_assignedapprover";
		private const string SupportingNotesLogicalName = "dbm_supportingnotes";
		private const string CurrentStageLogicalName = "dbm_currentstageid";
		private const string CurrentStepLogicalName = "dbm_currentstepid";
		private const string CurrentFormStateLogicalName = "dbm_currentformstateid";
		private const string InternalStatusLogicalName = "dbm_internalstatusid";
		private const string PortalStatusLogicalName = "dbm_portalstatusid";
		private const string PortalCommandLogicalName = "dbm_portalcommand";
		private const string PortalProfileKeyLogicalName = "dbm_portalprofilekey";

		private const string DraftStageId = "draft-request";
		private const string DraftStepId = "capture-request";
		private const string DraftFormStateId = "request-edit-state";
		private const string DraftInternalStatusId = "draft";
		private const string DraftPortalStatusId = "draft";
		private const string InternalScreeningStageId = "internal-screening-stage";
		private const string InternalScreeningStepId = "screen-request";
		private const string InternalScreeningFormStateId = "request-screening-state";
		private const string InternalScreeningStatusId = "internal-screening";
		private const string UnderReviewPortalStatusId = "under-review";
		private const string PortalSubmitCommand = "submit";
		private const string GenericProfileKey = "dev-anonymous-requester";

		public void Execute(IServiceProvider serviceProvider)
		{
			var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
			if (context == null
				|| !string.Equals(context.PrimaryEntityName, RequestEntityLogicalName, StringComparison.OrdinalIgnoreCase)
				|| !context.InputParameters.Contains("Target")
				|| !(context.InputParameters["Target"] is Entity target)
				|| !string.Equals(target.LogicalName, RequestEntityLogicalName, StringComparison.OrdinalIgnoreCase))
			{
				return;
			}

			if (string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
			{
				InitialiseDraftRuntimeState(target);
				return;
			}

			if (!string.Equals(context.MessageName, "Update", StringComparison.OrdinalIgnoreCase))
			{
				return;
			}

			HandlePortalCommandUpdate(serviceProvider, context, target);
		}

		private static void HandlePortalCommandUpdate(IServiceProvider serviceProvider, IPluginExecutionContext context, Entity target)
		{
			if (!target.Attributes.ContainsKey(PortalCommandLogicalName))
			{
				return;
			}

			var command = target.GetAttributeValue<string>(PortalCommandLogicalName)?.Trim();
			if (!string.Equals(command, PortalSubmitCommand, StringComparison.OrdinalIgnoreCase))
			{
				target[PortalCommandLogicalName] = null;
				return;
			}

			var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
			var service = factory.CreateOrganizationService(context.UserId);
			var current = service.Retrieve(
				RequestEntityLogicalName,
				context.PrimaryEntityId,
				new ColumnSet(
					TitleLogicalName,
					AmountLogicalName,
					AssignedApproverLogicalName,
					SupportingNotesLogicalName,
					CurrentStageLogicalName,
					PortalProfileKeyLogicalName));

			if (!IsDraftRuntimeState(current))
			{
				target[PortalCommandLogicalName] = null;
				return;
			}

			ValidateSubmitCommand(target, current);
			ApplySubmittedRuntimeState(target);
		}

		private static void InitialiseDraftRuntimeState(Entity target)
		{
			target[CurrentStageLogicalName] = DraftStageId;
			target[CurrentStepLogicalName] = DraftStepId;
			target[CurrentFormStateLogicalName] = DraftFormStateId;
			target[InternalStatusLogicalName] = DraftInternalStatusId;
			target[PortalStatusLogicalName] = DraftPortalStatusId;
			target[PortalCommandLogicalName] = null;

			var portalProfileKey = target.GetAttributeValue<string>(PortalProfileKeyLogicalName);
			if (string.IsNullOrWhiteSpace(portalProfileKey))
			{
				target[PortalProfileKeyLogicalName] = GenericProfileKey;
			}
		}

		private static bool IsDraftRuntimeState(Entity current)
		{
			var currentStageId = current.GetAttributeValue<string>(CurrentStageLogicalName);
			return string.IsNullOrWhiteSpace(currentStageId)
				|| string.Equals(currentStageId, DraftStageId, StringComparison.OrdinalIgnoreCase);
		}

		private static void ValidateSubmitCommand(Entity target, Entity current)
		{
			var errors = new List<string>();
			var title = GetMergedStringValue(target, current, TitleLogicalName);
			var amount = GetMergedMoneyValue(target, current, AmountLogicalName);
			var assignedApprover = GetMergedStringValue(target, current, AssignedApproverLogicalName);
			var supportingNotes = GetMergedStringValue(target, current, SupportingNotesLogicalName);

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

			if (errors.Count > 0)
			{
				throw new InvalidPluginExecutionException(string.Join(" ", errors));
			}
		}

		private static void ApplySubmittedRuntimeState(Entity target)
		{
			target[CurrentStageLogicalName] = InternalScreeningStageId;
			target[CurrentStepLogicalName] = InternalScreeningStepId;
			target[CurrentFormStateLogicalName] = InternalScreeningFormStateId;
			target[InternalStatusLogicalName] = InternalScreeningStatusId;
			target[PortalStatusLogicalName] = UnderReviewPortalStatusId;
			target[PortalCommandLogicalName] = null;

			var portalProfileKey = target.GetAttributeValue<string>(PortalProfileKeyLogicalName);
			if (string.IsNullOrWhiteSpace(portalProfileKey))
			{
				target[PortalProfileKeyLogicalName] = GenericProfileKey;
			}
		}

		private static string GetMergedStringValue(Entity target, Entity current, string logicalName)
		{
			if (target.Attributes.TryGetValue(logicalName, out var nextValue))
			{
				return nextValue as string;
			}

			return current.GetAttributeValue<string>(logicalName);
		}

		private static Money GetMergedMoneyValue(Entity target, Entity current, string logicalName)
		{
			if (target.Attributes.TryGetValue(logicalName, out var nextValue))
			{
				return nextValue as Money;
			}

			return current.GetAttributeValue<Money>(logicalName);
		}
	}
}
