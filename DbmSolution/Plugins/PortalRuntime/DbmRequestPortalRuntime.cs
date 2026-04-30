using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Yagasoft.Dbm.Plugins.PortalRuntime
{
	public sealed class DbmRequestPortalRuntime : IPlugin
	{
		public void Execute(IServiceProvider serviceProvider)
		{
			var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
			if (context == null
				|| !string.Equals(context.PrimaryEntityName, DbmRequestPortalRuntimeRules.RequestEntityLogicalName, StringComparison.OrdinalIgnoreCase)
				|| !context.InputParameters.Contains("Target")
				|| !(context.InputParameters["Target"] is Entity target)
				|| !string.Equals(target.LogicalName, DbmRequestPortalRuntimeRules.RequestEntityLogicalName, StringComparison.OrdinalIgnoreCase))
			{
				return;
			}

			if (string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
			{
				DbmRequestPortalRuntimeRules.InitialiseDraftRuntimeState(target);
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
			if (!target.Attributes.ContainsKey(DbmRequestPortalRuntimeRules.PortalCommandLogicalName))
			{
				return;
			}

			var command = target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalCommandLogicalName)?.Trim();
			if (!string.Equals(command, DbmRequestPortalRuntimeRules.PortalSubmitCommand, StringComparison.OrdinalIgnoreCase))
			{
				target[DbmRequestPortalRuntimeRules.PortalCommandLogicalName] = null;
				return;
			}

			var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
			var service = factory.CreateOrganizationService(context.UserId);
			var current = service.Retrieve(
				DbmRequestPortalRuntimeRules.RequestEntityLogicalName,
				context.PrimaryEntityId,
				new ColumnSet(
					DbmRequestPortalRuntimeRules.TitleLogicalName,
					DbmRequestPortalRuntimeRules.AmountLogicalName,
					DbmRequestPortalRuntimeRules.AssignedApproverLogicalName,
					DbmRequestPortalRuntimeRules.SupportingNotesLogicalName,
					DbmRequestPortalRuntimeRules.CurrentStageLogicalName,
					DbmRequestPortalRuntimeRules.PortalProfileKeyLogicalName));

			if (!DbmRequestPortalRuntimeRules.IsDraftRuntimeState(current))
			{
				target[DbmRequestPortalRuntimeRules.PortalCommandLogicalName] = null;
				return;
			}

			ValidateSubmitCommand(target, current);
			DbmRequestPortalRuntimeRules.ApplySubmittedRuntimeState(target);
		}

		private static void ValidateSubmitCommand(Entity target, Entity current)
		{
			var errors = DbmRequestPortalRuntimeRules.ValidateSubmitFields(
				GetMergedStringValue(target, current, DbmRequestPortalRuntimeRules.TitleLogicalName),
				GetMergedMoneyValue(target, current, DbmRequestPortalRuntimeRules.AmountLogicalName),
				GetMergedStringValue(target, current, DbmRequestPortalRuntimeRules.AssignedApproverLogicalName),
				GetMergedStringValue(target, current, DbmRequestPortalRuntimeRules.SupportingNotesLogicalName));

			if (errors.Count > 0)
			{
				throw new InvalidPluginExecutionException(string.Join(" ", errors));
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
