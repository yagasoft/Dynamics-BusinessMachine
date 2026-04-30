using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Yagasoft.Dbm.Plugins.PortalRuntime;

namespace Yagasoft.Dbm.Plugins.Tests
{
	internal static class Program
	{
		private static int Main()
		{
			try
			{
				DraftInitialisationStampsTheCompletedR31DefaultState();
				SubmitValidationExplainsMissingStartFormFields();
				SubmitValidationRequiresSupportingNotesForHighValueRequests();
				SubmittedStateProjectsUnderReviewAndClearsThePortalCommand();
				Console.WriteLine("DBM plugin runtime tests passed.");
				return 0;
			}
			catch (Exception ex)
			{
				Console.Error.WriteLine(ex);
				return 1;
			}
		}

		private static void DraftInitialisationStampsTheCompletedR31DefaultState()
		{
			var target = new Entity("dbm_request");

			DbmRequestPortalRuntimeRules.InitialiseDraftRuntimeState(target);

			AssertEqual("draft-request", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.CurrentStageLogicalName), "draft stage");
			AssertEqual("capture-request", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.CurrentStepLogicalName), "draft step");
			AssertEqual("request-edit-state", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.CurrentFormStateLogicalName), "draft form state");
			AssertEqual("draft", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.InternalStatusLogicalName), "draft internal status");
			AssertEqual("draft", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalStatusLogicalName), "draft portal status");
			AssertEqual("dev-anonymous-requester", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalProfileKeyLogicalName), "generic profile key");
			AssertEqual(null, target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalCommandLogicalName), "portal command");
		}

		private static void SubmitValidationExplainsMissingStartFormFields()
		{
			var errors = DbmRequestPortalRuntimeRules.ValidateSubmitFields(null, null, " ", null);

			AssertSequence(
				new[]
				{
					"Request Title is required before portal submit.",
					"Request Amount is required before portal submit.",
					"Assigned Approver is required before portal submit."
				},
				errors,
				"missing start form field errors");
		}

		private static void SubmitValidationRequiresSupportingNotesForHighValueRequests()
		{
			var errors = DbmRequestPortalRuntimeRules.ValidateSubmitFields(
				"Portal request",
				new Money(5000m),
				"Finance approver",
				" ");

			AssertSequence(
				new[] { "Supporting Notes are required when the request amount is 5000 or greater." },
				errors,
				"high value supporting notes errors");
		}

		private static void SubmittedStateProjectsUnderReviewAndClearsThePortalCommand()
		{
			var target = new Entity("dbm_request")
			{
				[DbmRequestPortalRuntimeRules.PortalCommandLogicalName] = "submit"
			};

			DbmRequestPortalRuntimeRules.ApplySubmittedRuntimeState(target);

			AssertEqual("internal-screening-stage", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.CurrentStageLogicalName), "submitted stage");
			AssertEqual("screen-request", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.CurrentStepLogicalName), "submitted step");
			AssertEqual("request-screening-state", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.CurrentFormStateLogicalName), "submitted form state");
			AssertEqual("internal-screening", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.InternalStatusLogicalName), "submitted internal status");
			AssertEqual("under-review", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalStatusLogicalName), "submitted portal status");
			AssertEqual("dev-anonymous-requester", target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalProfileKeyLogicalName), "submitted generic profile key");
			AssertEqual(null, target.GetAttributeValue<string>(DbmRequestPortalRuntimeRules.PortalCommandLogicalName), "submitted portal command");
		}

		private static void AssertEqual<T>(T expected, T actual, string label)
		{
			if (!EqualityComparer<T>.Default.Equals(expected, actual))
			{
				throw new InvalidOperationException($"{label}: expected '{expected}', got '{actual}'.");
			}
		}

		private static void AssertSequence(IReadOnlyList<string> expected, IReadOnlyList<string> actual, string label)
		{
			AssertEqual(expected.Count, actual.Count, $"{label} count");
			for (var i = 0; i < expected.Count; i++)
			{
				AssertEqual(expected[i], actual[i], $"{label} item {i}");
			}
		}
	}
}
