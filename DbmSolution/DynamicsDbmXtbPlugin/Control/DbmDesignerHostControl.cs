#nullable enable

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using XrmToolBox.Extensibility;
using XrmToolBox.Extensibility.Args;
using XrmToolBox.Extensibility.Interfaces;
using Label = System.Windows.Forms.Label;

namespace Yagasoft.DynamicsDbmXtbPlugin.Control
{
	public sealed class DbmDesignerHostControl : PluginControlBase, IStatusBarMessenger, IHelpPlugin
	{
		private const string ModelRoot = "ys_/dbm/data/models/";
		private const string BridgeChannel = "dbm-host-bridge";
		private static readonly JsonSerializerOptions JsonOptions = new()
		{
			PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
			DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
			PropertyNameCaseInsensitive = true
		};
		private readonly ToolStrip toolBar;
		private readonly ToolStripButton buttonRefresh;
		private readonly ToolStripLabel labelStatus;
		private readonly WebView2 webView;
		private readonly Panel loadingPanel;
		private readonly Label loadingLabel;

		private string bundleRoot = string.Empty;
		private bool bridgeInitialized;

		public string HelpUrl => "https://www.yagasoft.com";
		public event EventHandler<StatusBarMessageEventArgs>? SendMessageToStatusBar;

		public DbmDesignerHostControl()
		{
			toolBar = new ToolStrip
			{
				ImageScalingSize = new Size(20, 20),
				GripStyle = ToolStripGripStyle.Hidden,
				Dock = DockStyle.Top
			};

			buttonRefresh = new ToolStripButton("Reload Designer");
			buttonRefresh.Click += async (_, _) => await ReloadDesignerAsync();

			labelStatus = new ToolStripLabel("Initializing DBM designer host...");
			toolBar.Items.Add(buttonRefresh);
			toolBar.Items.Add(new ToolStripSeparator());
			toolBar.Items.Add(labelStatus);

			webView = new WebView2
			{
				Dock = DockStyle.Fill,
				Visible = false
			};

			loadingLabel = new Label
			{
				Dock = DockStyle.Fill,
				TextAlign = ContentAlignment.MiddleCenter,
				Text = "Preparing DBM designer..."
			};

			loadingPanel = new Panel
			{
				Dock = DockStyle.Fill
			};
			loadingPanel.Controls.Add(loadingLabel);

			Controls.Add(webView);
			Controls.Add(loadingPanel);
			Controls.Add(toolBar);

			Load += async (_, _) => await InitializeAsync();
		}

		private void UpdateStatus(string message)
		{
			labelStatus.Text = message;
			SendMessageToStatusBar?.Invoke(this, new StatusBarMessageEventArgs(message));
		}

		private async Task InitializeAsync()
		{
			if (DesignMode || bridgeInitialized)
			{
				return;
			}

			try
			{
				bundleRoot = ResolveBundleRoot();
				var bundleIndexPath = Path.Combine(bundleRoot, "index.html");
				if (!File.Exists(bundleIndexPath))
				{
					throw new FileNotFoundException("Could not find the DBM editor bundle.", bundleIndexPath);
				}

				UpdateStatus($"Loading DBM designer from {bundleRoot}");
				await webView.EnsureCoreWebView2Async();
				webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
				webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
				webView.CoreWebView2.WebMessageReceived += HandleWebMessageReceived;
				await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(BuildBridgeScript(GetClientUrl()));
				webView.Source = new Uri(bundleIndexPath, UriKind.Absolute);
				webView.Visible = true;
				loadingPanel.Visible = false;
				bridgeInitialized = true;
			}
			catch (Exception ex)
			{
				UpdateStatus("Failed to initialize DBM designer host");
				loadingLabel.Text = $"Failed to initialize DBM designer host.{Environment.NewLine}{ex.Message}";
				LogError(ex.ToString());
			}
		}

		private async Task ReloadDesignerAsync()
		{
			if (!bridgeInitialized)
			{
				await InitializeAsync();
				return;
			}

			webView.Reload();
		}

		private string ResolveBundleRoot()
		{
			var candidates = new List<string>();
			var environmentRoot = Environment.GetEnvironmentVariable("DBM_XTB_EDITOR_BUNDLE_ROOT");
			if (!string.IsNullOrWhiteSpace(environmentRoot))
			{
				candidates.Add(environmentRoot);
			}

			candidates.Add(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dbm-app-bundle"));
			candidates.Add(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "dbm-app-bundle"));
			candidates.Add(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "Yagasoft.DynamicsDbmXtbPlugin", "dbm-app-bundle"));

			var directory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
			while (directory != null)
			{
				candidates.Add(Path.Combine(directory.FullName, "dbm-app", "bundle"));
				directory = directory.Parent;
			}

			foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
			{
				if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
				{
					return candidate;
				}
			}

			throw new DirectoryNotFoundException(
				"Could not locate the DBM editor bundle. Build `dbm-app` first or set DBM_XTB_EDITOR_BUNDLE_ROOT.");
		}

		private string GetClientUrl()
		{
			var candidates = new List<string>();
			if (ConnectionDetail != null)
			{
				var connectionDetail = ConnectionDetail;
				var type = connectionDetail.GetType();
				foreach (var propertyName in new[]
				         {
					         "WebApplicationUrl",
					         "OrganizationServiceUrl",
					         "ServiceUri",
					         "ServiceUrl",
					         "ConnectedOrgUriActual",
					         "Url"
				         })
				{
					var property = type.GetProperty(propertyName);
					if (property == null)
					{
						continue;
					}

					var value = property.GetValue(connectionDetail);
					if (value == null)
					{
						continue;
					}

					var text = value as string ?? value.ToString();
					if (!string.IsNullOrWhiteSpace(text))
					{
						candidates.Add(text.TrimEnd('/'));
					}
				}
			}

			var discovered = candidates.FirstOrDefault(candidate => candidate.StartsWith("http", StringComparison.OrdinalIgnoreCase));
			return discovered ?? "https://example.crm.dynamics.com";
		}

		private static string BuildBridgeScript(string clientUrl)
		{
			var clientUrlLiteral = JsonSerializer.Serialize(clientUrl ?? "https://example.crm.dynamics.com");
			return @"
(() => {
	if (window.dbmHostBridge) {
		return;
	}

	const pending = new Map();
	let requestCounter = 0;
	const clientUrl = " + clientUrlLiteral + @";

	function installXrmShim() {
		if (window.Xrm && window.Xrm.Utility && window.Xrm.Utility.getGlobalContext) {
			return;
		}

		window.Xrm = window.Xrm || {};
		window.Xrm.Utility = window.Xrm.Utility || {};
		window.Xrm.Utility.getGlobalContext = () => ({
			getClientUrl: () => clientUrl
		});
	}

	function invoke(method, payload) {
		return new Promise((resolve, reject) => {
			const requestId = `dbm-host-${++requestCounter}`;
			const timeoutId = window.setTimeout(() => {
				if (!pending.has(requestId)) {
					return;
				}

				pending.delete(requestId);
				reject(new Error(`Timed out waiting for host response: ${method}`));
			}, 30000);

			pending.set(requestId, { resolve, reject, timeoutId });
			window.chrome.webview.postMessage({
				channel: 'dbm-host-bridge',
				requestId,
				method,
				payload
			});
		});
	}

	installXrmShim();

		globalThis.dbmHostBridge = window.dbmHostBridge = {
		hostKind: 'xrmtoolbox',
		listModelPackages: () => invoke('listModelPackages'),
		loadModelPackage: (packageName) => invoke('loadModelPackage', { packageName }),
		saveModelPackage: (record) => invoke('saveModelPackage', record),
		deleteModelPackage: (record) => invoke('deleteModelPackage', record)
	};

	window.chrome.webview.addEventListener('message', event => {
		const message = event.data;
		if (!message || message.channel !== 'dbm-host-bridge-response' || !message.requestId) {
			return;
		}

		const pendingRequest = pending.get(message.requestId);
		if (!pendingRequest) {
			return;
		}

		window.clearTimeout(pendingRequest.timeoutId);
		pending.delete(message.requestId);

		if (message.ok) {
			pendingRequest.resolve(message.payload ?? null);
			return;
		}

		pendingRequest.reject(new Error(message.error || 'Unknown host bridge error.'));
	});

})();";
		}

		private async void HandleWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
		{
			BridgeRequest? request = null;
			try
			{
				request = JsonSerializer.Deserialize<BridgeRequest>(e.WebMessageAsJson, JsonOptions);
				if (request == null || !string.Equals(request.Channel, BridgeChannel, StringComparison.Ordinal))
				{
					return;
				}

				object? payload = request.Method switch
				{
					"listModelPackages" => ListModelPackages(),
					"loadModelPackage" => LoadModelPackage(request.Payload),
					"saveModelPackage" => SaveModelPackage(request.Payload),
					"deleteModelPackage" => DeleteModelPackage(request.Payload),
					_ => throw new InvalidOperationException(string.Format("Unsupported host bridge method '{0}'.", request.Method))
				};

			await PostBridgeResponseAsync(request.RequestId, true, payload, null);
			}
			catch (Exception ex)
			{
				LogError(ex.ToString());
				await PostBridgeResponseAsync(request?.RequestId, false, null, ex.Message);
			}
		}

		private IReadOnlyList<WebResourceBridgePackageSummary> ListModelPackages()
		{
			EnsureServiceAvailable();

			var query = new QueryExpression("webresource")
			{
				ColumnSet = new ColumnSet("webresourceid", "name", "displayname", "modifiedon")
			};
			query.Criteria.AddCondition("name", ConditionOperator.BeginsWith, ModelRoot);
			query.Orders.Add(new OrderExpression("name", OrderType.Ascending));

			var packageGroups = new Dictionary<string, PackageGroup>(StringComparer.OrdinalIgnoreCase);
			foreach (var entity in Service.RetrieveMultiple(query).Entities)
			{
				var resource = MapWebResourceSummary(entity);
				if (!TryParsePackageName(resource.Name, out var packageName, out var isWorkspace))
				{
					continue;
				}

				if (!packageGroups.TryGetValue(packageName, out var group))
				{
					group = new PackageGroup(packageName);
					packageGroups.Add(packageName, group);
				}

				if (isWorkspace)
				{
					group.Workspace = resource;
				}
				else
				{
					group.Model = resource;
				}
			}

			return packageGroups.Values
				.Where(group => group.Model != null)
				.Select(MapPackageSummary)
				.OrderBy(summary => summary.DisplayName ?? summary.PackageName, StringComparer.OrdinalIgnoreCase)
				.ToArray();
		}

		private WebResourceBridgePackageRecord? LoadModelPackage(JsonElement? payload)
		{
			EnsureServiceAvailable();

			var packageName = GetRequiredString(payload, "packageName");
			var modelName = BuildModelResourceName(packageName);
			var workspaceName = BuildWorkspaceResourceName(packageName);
			var query = new QueryExpression("webresource")
			{
				ColumnSet = new ColumnSet("webresourceid", "name", "displayname", "modifiedon", "content")
			};
			var filter = new FilterExpression(LogicalOperator.Or);
			filter.AddCondition("name", ConditionOperator.Equal, modelName);
			filter.AddCondition("name", ConditionOperator.Equal, workspaceName);
			query.Criteria.AddFilter(filter);

			var entities = Service.RetrieveMultiple(query)
				.Entities
				.Select(MapWebResourceRecord)
				.ToArray();
			var model = entities.FirstOrDefault(resource => string.Equals(resource.Name, modelName, StringComparison.OrdinalIgnoreCase));
			if (model == null)
			{
				return null;
			}

			var workspace = entities.FirstOrDefault(resource => string.Equals(resource.Name, workspaceName, StringComparison.OrdinalIgnoreCase));
			return new WebResourceBridgePackageRecord
			{
				ModelId = model.Id,
				WorkspaceId = workspace?.Id,
				PackageName = packageName,
				DisplayName = model.DisplayName ?? ToFallbackLabel(packageName),
				ModelName = model.Name,
				WorkspaceName = workspaceName,
				ModifiedOn = LatestTimestamp(model.ModifiedOn, workspace?.ModifiedOn),
				HasWorkspace = workspace != null,
				ModelContent = DecodeUtf8Content(model.Content) ?? string.Empty,
				WorkspaceContent = workspace == null ? null : DecodeUtf8Content(workspace.Content)
			};
		}

		private WebResourceBridgePackageRecord SaveModelPackage(JsonElement? payload)
		{
			EnsureServiceAvailable();

			var packageName = GetRequiredString(payload, "packageName");
			var displayName = GetRequiredString(payload, "displayName");
			var modelName = GetOptionalString(payload, "modelName") ?? BuildModelResourceName(packageName);
			var workspaceName = GetOptionalString(payload, "workspaceName") ?? BuildWorkspaceResourceName(packageName);
			var modelContent = GetRequiredString(payload, "modelContent");
			var workspaceContent = GetOptionalString(payload, "workspaceContent");
			var modelId = GetOptionalGuid(payload, "modelId");
			var workspaceId = GetOptionalGuid(payload, "workspaceId");

			var savedModelId = SaveWebResource(modelId, modelName, displayName, modelContent);
			var savedWorkspaceId = SaveWebResource(workspaceId, workspaceName, $"{displayName} Workspace", workspaceContent ?? "{}");

			PublishWebResource(savedModelId);
			PublishWebResource(savedWorkspaceId);

			return LoadModelPackage(JsonSerializer.SerializeToElement(new
			{
				packageName
			}, JsonOptions))!;
		}

		private object? DeleteModelPackage(JsonElement? payload)
		{
			EnsureServiceAvailable();

			var packageName = GetRequiredString(payload, "packageName");
			var modelId = GetOptionalGuid(payload, "modelId") ?? FindWebResourceIdByName(BuildModelResourceName(packageName));
			var workspaceId = GetOptionalGuid(payload, "workspaceId") ?? FindWebResourceIdByName(BuildWorkspaceResourceName(packageName));

			if (modelId.HasValue)
			{
				Service.Delete("webresource", modelId.Value);
			}

			if (workspaceId.HasValue)
			{
				Service.Delete("webresource", workspaceId.Value);
			}

			return null;
		}

		private WebResourceBridgeRecord? RetrieveWebResource(Guid id)
		{
			var entity = Service.Retrieve("webresource", id, new ColumnSet("webresourceid", "name", "displayname", "modifiedon", "content"));
			return MapWebResourceRecord(entity);
		}

		private Guid? FindWebResourceIdByName(string name)
		{
			var query = new QueryExpression("webresource")
			{
				TopCount = 1,
				ColumnSet = new ColumnSet("webresourceid")
			};
			query.Criteria.AddCondition("name", ConditionOperator.Equal, name);
			return Service.RetrieveMultiple(query).Entities.FirstOrDefault()?.Id;
		}

		private Guid SaveWebResource(Guid? id, string name, string displayName, string content)
		{
			var entity = new Entity("webresource");
			if (id.HasValue)
			{
				entity.Id = id.Value;
			}

			entity["name"] = name;
			entity["displayname"] = displayName;
			entity["content"] = EncodeUtf8Content(content);
			entity["webresourcetype"] = new OptionSetValue(3);

			var resourceId = id ?? FindWebResourceIdByName(name);
			if (resourceId.HasValue)
			{
				entity.Id = resourceId.Value;
				Service.Update(entity);
				return resourceId.Value;
			}

			return Service.Create(entity);
		}

		private void PublishWebResource(Guid id)
		{
			Service.Execute(new PublishXmlRequest
			{
				ParameterXml = $"<importexportxml><webresources><webresource>{{{id}}}</webresource></webresources></importexportxml>"
			});
		}

		private Task PostBridgeResponseAsync(string? requestId, bool ok, object? payload, string? error)
		{
			if (string.IsNullOrWhiteSpace(requestId) || webView.CoreWebView2 == null)
			{
				return Task.CompletedTask;
			}

			var envelope = new
			{
				channel = "dbm-host-bridge-response",
				requestId,
				ok,
				payload,
				error
			};

			webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(envelope, JsonOptions));
			return Task.CompletedTask;
		}

		private void EnsureServiceAvailable()
		{
			if (Service == null)
			{
				throw new InvalidOperationException("The XrmToolBox host is not connected to Dataverse.");
			}
		}

		private static string GetRequiredString(JsonElement? payload, string propertyName)
		{
			if (payload is not JsonElement element || !element.TryGetProperty(propertyName, out var value))
			{
				throw new InvalidOperationException($"Bridge payload is missing required property '{propertyName}'.");
			}

			var text = value.GetString();
			if (string.IsNullOrWhiteSpace(text))
			{
				throw new InvalidOperationException($"Bridge payload property '{propertyName}' must not be empty.");
			}

			return text!;
		}

		private static Guid? GetOptionalGuid(JsonElement? payload, string propertyName)
		{
			if (payload is not JsonElement element || !element.TryGetProperty(propertyName, out var value))
			{
				return null;
			}

			var text = value.GetString();
			return Guid.TryParse(text, out var guid) ? guid : null;
		}

		private static string? GetOptionalString(JsonElement? payload, string propertyName)
		{
			if (payload is not JsonElement element || !element.TryGetProperty(propertyName, out var value))
			{
				return null;
			}

			return value.ValueKind == JsonValueKind.Null ? null : value.GetString();
		}

		private static bool TryParsePackageName(string resourceName, out string packageName, out bool isWorkspace)
		{
			packageName = string.Empty;
			isWorkspace = false;
			if (string.IsNullOrWhiteSpace(resourceName) || !resourceName.StartsWith(ModelRoot, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			var relativeName = resourceName.Substring(ModelRoot.Length);
			if (relativeName.EndsWith(".workspace.json", StringComparison.OrdinalIgnoreCase))
			{
				packageName = relativeName.Substring(0, relativeName.Length - ".workspace.json".Length);
				isWorkspace = true;
				return !string.IsNullOrWhiteSpace(packageName);
			}

			if (relativeName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
			{
				packageName = relativeName.Substring(0, relativeName.Length - ".json".Length);
				return !string.IsNullOrWhiteSpace(packageName);
			}

			return false;
		}

		private static string BuildModelResourceName(string packageName)
		{
			return $"{ModelRoot}{packageName}.json";
		}

		private static string BuildWorkspaceResourceName(string packageName)
		{
			return $"{ModelRoot}{packageName}.workspace.json";
		}

		private static string ToFallbackLabel(string packageName)
		{
			return packageName;
		}

		private static string? LatestTimestamp(string? first, string? second)
		{
			if (string.IsNullOrWhiteSpace(first))
			{
				return second;
			}

			if (string.IsNullOrWhiteSpace(second))
			{
				return first;
			}

			if (DateTimeOffset.TryParse(first, out var firstValue) && DateTimeOffset.TryParse(second, out var secondValue))
			{
				return firstValue >= secondValue ? first : second;
			}

			return first;
		}

		private static string EncodeUtf8Content(string content)
		{
			return Convert.ToBase64String(Encoding.UTF8.GetBytes(content ?? string.Empty));
		}

		private static string? DecodeUtf8Content(string? content)
		{
			if (string.IsNullOrWhiteSpace(content))
			{
				return null;
			}

			try
			{
				return Encoding.UTF8.GetString(Convert.FromBase64String(content));
			}
			catch (FormatException)
			{
				return content;
			}
		}

		private static WebResourceBridgeRecord MapWebResourceSummary(Entity entity)
		{
			return new WebResourceBridgeRecord
			{
				Id = entity.Id.ToString(),
				Name = entity.GetAttributeValue<string>("name") ?? string.Empty,
				DisplayName = entity.GetAttributeValue<string>("displayname") ?? string.Empty,
				ModifiedOn = entity.GetAttributeValue<DateTime?>("modifiedon")?.ToUniversalTime().ToString("o")
			};
		}

		private static WebResourceBridgeRecord MapWebResourceRecord(Entity entity)
		{
			var record = MapWebResourceSummary(entity);
			record.Content = entity.GetAttributeValue<string>("content");
			return record;
		}

		private sealed class BridgeRequest
		{
			public string? Channel { get; set; }
			public string? RequestId { get; set; }
			public string? Method { get; set; }
			public JsonElement? Payload { get; set; }
		}

		private sealed class WebResourceBridgeRecord
		{
			[JsonPropertyName("id")]
			public string? Id { get; set; }

			[JsonPropertyName("name")]
			public string Name { get; set; } = string.Empty;

			[JsonPropertyName("displayname")]
			public string? DisplayName { get; set; }

			[JsonPropertyName("modifiedon")]
			public string? ModifiedOn { get; set; }

			[JsonPropertyName("content")]
			public string? Content { get; set; }
		}

		private sealed class PackageGroup
		{
			public PackageGroup(string packageName)
			{
				PackageName = packageName;
			}

			public string PackageName { get; }
			public WebResourceBridgeRecord? Model { get; set; }
			public WebResourceBridgeRecord? Workspace { get; set; }
		}

		private static WebResourceBridgePackageSummary MapPackageSummary(PackageGroup group)
		{
			var model = group.Model ?? throw new InvalidOperationException("Package summary requires a model resource.");
			return new WebResourceBridgePackageSummary
			{
				ModelId = model.Id,
				WorkspaceId = group.Workspace?.Id,
				PackageName = group.PackageName,
				DisplayName = model.DisplayName ?? ToFallbackLabel(group.PackageName),
				ModelName = model.Name,
				WorkspaceName = BuildWorkspaceResourceName(group.PackageName),
				ModifiedOn = LatestTimestamp(model.ModifiedOn, group.Workspace?.ModifiedOn),
				HasWorkspace = group.Workspace != null
			};
		}

		private class WebResourceBridgePackageSummary
		{
			[JsonPropertyName("modelId")]
			public string? ModelId { get; set; }

			[JsonPropertyName("workspaceId")]
			public string? WorkspaceId { get; set; }

			[JsonPropertyName("packageName")]
			public string PackageName { get; set; } = string.Empty;

			[JsonPropertyName("displayName")]
			public string? DisplayName { get; set; }

			[JsonPropertyName("modelName")]
			public string ModelName { get; set; } = string.Empty;

			[JsonPropertyName("workspaceName")]
			public string WorkspaceName { get; set; } = string.Empty;

			[JsonPropertyName("modifiedOn")]
			public string? ModifiedOn { get; set; }

			[JsonPropertyName("hasWorkspace")]
			public bool HasWorkspace { get; set; }
		}

		private sealed class WebResourceBridgePackageRecord : WebResourceBridgePackageSummary
		{
			[JsonPropertyName("modelContent")]
			public string ModelContent { get; set; } = string.Empty;

			[JsonPropertyName("workspaceContent")]
			public string? WorkspaceContent { get; set; }
		}
	}
}
