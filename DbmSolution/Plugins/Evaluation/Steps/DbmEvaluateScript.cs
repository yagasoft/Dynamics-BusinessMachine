#region Imports

using System;
using System.Activities;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Jint;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Metadata.Query;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk.Workflow;
using Yagasoft.Libraries.Common;

#endregion

namespace Yagasoft.Dbm.Plugins.Evaluation.Steps
{
	/// <summary>
	///     Takes in a script parses and evaluates it, and then returns the result.<br />
	///     Author: Ahmed Elsawalhy<br />
	///     Version: 1.1.1
	/// </summary>
	public class DbmEvaluateScript : CodeActivity
	{
		[Input("Script file")]
		[ReferenceTarget(WebResource.EntityLogicalName)]
		public InArgument<EntityReference> ScriptFileRef { get; set; }

		[Input("Script file ID")]
		public InArgument<string> ScriptFileId { get; set; }

		[Input("Inline script")]
		public InArgument<string> InlineScript { get; set; }

		[Input("Inline script type (js, json, flow)")]
		public InArgument<string> InlineScriptType { get; set; }

		[Input("JSON script action (create, update)")]
		public InArgument<string> JsonScriptAction { get; set; }

		[Output("Output")]
		public OutArgument<string> Output { get; set; }

		protected override void Execute(CodeActivityContext executionContext)
		{
			new DbmEvaluateScriptLogic().Execute(this, executionContext);
		}
	}

	internal class DbmEvaluateScriptLogic : StepLogic<DbmEvaluateScript>
	{
		protected override void ExecuteLogic()
		{
			var scriptFileGuid = codeActivity.ScriptFileRef.Get(ExecutionContext)?.Id;
			var scriptFileId = codeActivity.ScriptFileId.Get(ExecutionContext);
			var script = codeActivity.InlineScript.Get(ExecutionContext);
			var inlineScriptType = codeActivity.InlineScriptType.Get(ExecutionContext);
			var jsonScriptAction = codeActivity.JsonScriptAction.Get(ExecutionContext);

			var file = new ScriptFile { Type = inlineScriptType, Code = script };

			if (scriptFileGuid is not null)
			{
				file = RetrieveScript(scriptFileGuid.GetValueOrDefault(), true);
			}

			if (!file.Code.IsFilled())
			{
				Log.LogWarning("No script to run!");
				return;
			}

			Console.WriteLine("Creating engine ...");
			var engine =
				new Engine()
					.SetValue("log", new Action<int, string>(
						(l, o) =>
						{
							var map =
								new Dictionary<int, LogLevel>
								{
									{ 0, LogLevel.None },
									{ 1, LogLevel.Error },
									{ 2, LogLevel.Warning },
									{ 3, LogLevel.Info },
									{ 4, LogLevel.Debug },
									{ 5, LogLevel.Debug },
								};
							Log.Log(o, map.FirstNotNullOrDefault(l));
						}));

			Console.WriteLine("Evaluating core lib ...");
			engine
				.SetValue("setTimeout", new Action<Action, int>(
					(a, d) =>
					{
						Thread.Sleep(d);
						a();
					}))
				.SetValue("___create", new Func<JsEntity, Guid>(e => Service.Create(e.ToCrmEntity(Service, Guid.NewGuid()))))
				.SetValue("___retrieve", new Func<string, string, string[], JsEntity>((n, i, a) =>
					Service.Retrieve(n, Guid.Parse(i), (a.FirstOrDefault() == "*") ? new ColumnSet(true) : new ColumnSet(a)).ToJsEntity()))
				.SetValue("___retrieveMultiple", new Func<string, int?, int?, JsEntity[]>((q, c, p) =>
					CrmHelpers.RetrieveRecords(Service, q, c ?? -1, p ?? -1).Select(e => e.ToJsEntity()).ToArray()))
				.Execute(RetrieveCoreLib());

			var logMap =
				new Dictionary<LogLevel?, int?>
				{
					{ LogLevel.None, 0 },
					{ LogLevel.Error, 1 },
					{ LogLevel.Warning, 2 },
					{ LogLevel.Info, 3 },
					{ LogLevel.Debug, 5 }
				};

			var isQuickJs = !Regex.IsMatch(file.Code.Trim().Replace("\n", string.Empty), @"^[{\[].*[}\]]$");

			Log.Log("Evaluating script ...");
			var output = engine
				.Evaluate($"""
return Ys.evaluate({(isQuickJs ? "\"" : string.Empty)}{file.Code}{(isQuickJs ? "\"" : string.Empty)},
	{(Context.PrimaryEntityName.IsFilled() && Context.PrimaryEntityId != Guid.Empty
		? "new Ys.Entity('{Context.PrimaryEntityName}', Guid.parse('{Context.PrimaryEntityId.ToString()}'))"
		: "null")},
	{logMap.FirstNotNullOrDefault((Log as LoggerBase)?.MaxLogLevel) ?? 2});
""").ToObject();

			Log.Log($"Raw output: {output}");

			var nulls =
				new object[]
				{
					null,
					"undefined",
					"null",
					string.Empty
				};

			output =
				nulls.Contains(output)
					? engine.GetValue("$output")?.ToString()
					: output;

			if (nulls.Contains(output))
			{
				output = null;
			}

			if (file.Type == "json" && !nulls.Contains(output) && output?.GetType() != typeof(string))
			{
				var actionMap =
					new Dictionary<string, JsonAction?>
					{
						{ "create", JsonAction.Create },
						{ "update", JsonAction.Update }
					};

				Log.LogInfo("Processing JSON result ...");
				
				ProcessJsonResult(new EntityReference(Context.PrimaryEntityName, Context.PrimaryEntityId),
					actionMap.FirstNotNullOrDefault(jsonScriptAction)
						?? (Context.PrimaryEntityName.IsFilled() && Context.PrimaryEntityId != Guid.Empty ? JsonAction.Update : JsonAction.Create),
					output);
			}

			Log.Log($"Output: {output}");

			codeActivity.Output.Set(ExecutionContext, output);
		}

		private enum JsonAction
		{
			Create,
			Update
		}
		
		private ScriptFile RetrieveScript(Guid id, bool isEncoded = false)
		{
			return CacheHelpers
				.GetFromMemCacheAdd($"Dbm-RetrieveScript-{id}-{isEncoded}",
					() =>
					{
						Log.LogInfo($"Retrieving script: {id} ...");
						var context = new XrmServiceContext(Service);
						var file =
							(from s in context.WebResourceSet
								where s.WebResourceIdentifierId == id
								select new ScriptFile { Type = s.Name, Code = s.Content }).FirstOrDefault();
						Log.LogInfo($"Found: {file?.Type}.");

						return PreProcessScriptFile(id.ToString(), isEncoded, file);
					}, orgId: OrgId);
		}

		private ScriptFile RetrieveScript(string id, bool isEncoded = false)
		{
			return CacheHelpers
				.GetFromMemCacheAdd($"Dbm-RetrieveScript-{id}-{isEncoded}",
					() =>
					{
						var name = $"ys_/dbm/data/scripts/{Regex.Replace(id, "[^\\w_]", "_")}";

						Log.LogInfo($"Retrieving script: {name} ...");
						var context = new XrmServiceContext(Service);
						var file =
							(from r in context.WebResourceSet
								where r.Name == name
								select new ScriptFile { Type = r.Name, Code = r.Content }).FirstOrDefault();
						Log.LogInfo($"Found: {file?.Type}.");

						return PreProcessScriptFile(id, isEncoded, file);
					}, orgId: OrgId);
		}

		private ScriptFile PreProcessScriptFile(string id, bool isEncoded, ScriptFile file)
		{
			if (file == null)
			{
				throw new InvalidPluginExecutionException($"Script '{id}' not found in web-resources.");
			}

			file.Type = file.Type.Split('.').LastOrDefault();
			Log.LogInfo($"Type: {file.Type}.");

			Log.LogDebug($"Content", file.Code);

			if (isEncoded)
			{
				file.Code = Encoding.UTF8.GetString(Convert.FromBase64String(file.Code));
				Log.LogDebug($"Content decoded", file.Code);
			}

			return file;
		}

		private string RetrieveCoreLib()
		{
			return
				CacheHelpers
					.GetFromMemCacheAdd($"Dbm-Loader-Core-Lib",
						() =>
						{
							log.Log($"Retrieving core lib ...");
							var code =
								(from r in new XrmServiceContext(Service).WebResourceSet
									where r.Name == "ys_/dbm/libs/core.js"
									select r.Content).FirstOrDefault()
									?? throw new InvalidPluginExecutionException($"Core library not found in web-resources.");

							code = Encoding.UTF8.GetString(Convert.FromBase64String(code));
							log.LogDebug("Code lib", code);

							return code;
						}, orgId: OrgId);
		}

		private void ProcessJsonResult(EntityReference recordRef, JsonAction action, dynamic result)
		{
			if (result?.GetType().IsArray)
			{
				var properties =
					(result as object[])?.Cast<dynamic>()
						.Where(e => IsPropertyExists(e, "isRelation") && !e.isRelation && IsPropertyExists(e, "code")).ToArray();

				if (properties?.Any() == true)
				{
					var record =
						new JsEntity
						{
							LogicalName = recordRef.LogicalName,
							Attributes = properties.ToDictionary(e => (string)e.id, object(e) => e.code)
						}.ToCrmEntity(Service, Guid.NewGuid());
					
					switch (action)
					{
						case JsonAction.Create:
							Log.LogInfo($"Updating {recordRef.AsString()} ...");
							Service.Create(record);
							break;
						
						case JsonAction.Update:
							Log.LogInfo($"Updating {recordRef.AsString()} ...");
							record.Id = recordRef.Id;
							Service.Update(record);
							break;
						
						default:
							throw new ArgumentOutOfRangeException(nameof(action), action, null);
					}
				}
			}
		}

		public static bool IsPropertyExists<T>(T obj, string name)
		{
			return
				obj is ExpandoObject
					? ((IDictionary<string, object>)obj).ContainsKey(name)
					: obj.GetType().GetProperty(name) != null;
		}
	}

	internal static class JsCrmExtensions
	{
		public static JsEntity ToJsEntity(this Entity entity)
		{
			return
				new JsEntity
				{
					LogicalName = entity.LogicalName,
					Id = entity.Id.ToString(),
					Attributes = entity.Attributes
						.ToDictionary(
							kv => kv.Key,
							kv =>
							{
								switch (kv.Value)
								{
									case Guid v:
										return v.ToString();

									case EntityReference v:
										return new JsEntityReference
											   {
												   LogicalName = v.LogicalName,
												   Id = v.Id.ToString(),
												   Name = v.Name
											   };

									case Money v:
										return v.Value;

									case OptionSetValue v:
										return new JsOptionSet
											   {
												   Value = v.Value,
												   Name = entity.FormattedValues.TryGetValue(kv.Key, out var formattedOptionSet) ? formattedOptionSet : null
											   };

									case DateTime or bool or int or long or decimal or double or string:
										return kv.Value;

									case null:
										return null;

									default:
										return kv.Value.ToString();
								}
							})
				};
		}

		public static Entity ToCrmEntity(this JsEntity entity, IOrganizationService service, Guid orgId)
		{
			var metadata = GetEntityAttributes(service, entity.LogicalName, orgId);
			var attributes = entity.Attributes
				.ToDictionary<KeyValuePair<string, object>, string, object>(
					kv => kv.Key,
					kv =>
					{
						var value = kv.Value;

						if (value is null)
						{
							return null;
						}

						var attributeType = metadata.Attributes.FirstOrDefault(a => a.LogicalName == kv.Key)?.AttributeType;

						switch (attributeType)
						{
							case AttributeTypeCode.Boolean:
								return bool.Parse(value.ToString());
							case AttributeTypeCode.DateTime:
								return DateTime.Parse(value.ToString());
							case AttributeTypeCode.Decimal:
							case AttributeTypeCode.BigInt:
								return decimal.Parse(value.ToString());
							case AttributeTypeCode.Integer:
								return int.Parse(value.ToString());
							case AttributeTypeCode.Double:
								return double.Parse(value.ToString());
							case AttributeTypeCode.Customer:
							case AttributeTypeCode.Lookup:
							case AttributeTypeCode.Owner:
								var reference = (dynamic)value;
								return new EntityReference(reference.logicalName, Guid.Parse(reference.id));
							case AttributeTypeCode.Money:
								return new Money(decimal.Parse(value.ToString()));
							case AttributeTypeCode.Picklist:
							case AttributeTypeCode.State:
							case AttributeTypeCode.Status:
								return new OptionSetValue(int.Parse(value.ToString()));
							case AttributeTypeCode.Uniqueidentifier:
								return Guid.Parse(value.ToString());
							case AttributeTypeCode.String:
							case AttributeTypeCode.Memo:
							case AttributeTypeCode.PartyList:
							default:
								return value.ToString();
						}
					});

			var attributeCollection = new AttributeCollection();

			foreach (var kv in attributes)
			{
				attributeCollection[kv.Key] = kv.Value;
			}

			return
				new Entity
				{
					LogicalName = entity.LogicalName,
					Id = Guid.TryParse(entity.Id, out var guid) ? guid : Guid.Empty,
					Attributes = attributeCollection
				};
		}

		public static EntityMetadata GetEntityAttributes(IOrganizationService service, string entityName,
			Guid? orgId = null)
		{
			var cacheKey = $"Yagasoft.Common.GetEntityAttributes|{entityName}|Attributes";
			var attributesCached = CacheHelpers.GetFromMemCache<EntityMetadata>(cacheKey, orgId: orgId);

			if (attributesCached != null)
			{
				return attributesCached;
			}

			var entityProperties =
				new MetadataPropertiesExpression
				{
					AllProperties = false
				};
			entityProperties.PropertyNames.AddRange("Attributes");

			var entityFilter = new MetadataFilterExpression(LogicalOperator.And);
			entityFilter.Conditions
				.Add(new MetadataConditionExpression("LogicalName", MetadataConditionOperator.Equals, entityName));

			var entityQueryExpression =
				new EntityQueryExpression
				{
					Criteria = entityFilter,
					Properties = entityProperties
				};

			var retrieveMetadataChangesRequest =
				new RetrieveMetadataChangesRequest
				{
					Query = entityQueryExpression,
					ClientVersionStamp = null
				};

			return CacheHelpers.AddToMemCache(cacheKey,
				((RetrieveMetadataChangesResponse)service.Execute(retrieveMetadataChangesRequest))
					.EntityMetadata?.FirstOrDefault(),
				CrmHelpers.GetMetadataCacheExpiryDate(service, orgId), orgId: orgId);
		}
	}

	internal class ScriptFile
	{
		public string Type { get; set; }
		public string Code { get; set; }
	}

	internal class JsReference
	{
		public string LogicalName { get; set; }
		public string Id { get; set; }
		public string Name { get; set; }
	}

	internal class JsEntity : JsReference
	{
		public IDictionary<string, object> Attributes { get; set; }
	}

	internal class JsEntityReference : JsReference
	{ }

	internal class JsOptionSet
	{
		public int Value { get; set; }
		public string Name { get; set; }
	}
}
