#region Imports

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using XrmToolBox.Extensibility;
using XrmToolBox.Extensibility.Args;
using XrmToolBox.Extensibility.Interfaces;
using Yagasoft.DynamicsPromoteSolutionPatchPlugin.Helpers;
using Yagasoft.DynamicsPromoteSolutionPatchPlugin.Model;
using Yagasoft.DynamicsPromoteSolutionPatchPlugin.Model.Settings;
using Yagasoft.Libraries.Common;
using Label = System.Windows.Forms.Label;
using MessageBox = System.Windows.Forms.MessageBox;

#endregion

namespace Yagasoft.DynamicsDbmXtbPlugin.Control
{
	public partial class PluginControl : PluginControlBase, IStatusBarMessenger, IGitHubPlugin, IPayPalPlugin, IHelpPlugin
	{
	    public string UserName => "yagasoft";

	    public string RepositoryName => "Dynamics-BusinessMachine";

	    public string EmailAccount => "mail@yagasoft.com";

	    public string DonationDescription => "Thank you!";

	    public string HelpUrl => "https://www.yagasoft.com";

		private ToolStrip toolBar;
		private ToolStripButton buttonCloseTool;
		private ToolStripButton buttonLoad;
		private ToolStripSeparator toolStripSeparator2;

		private Button buttonCancel;
		private TableLayoutPanel tableLayoutTopBar;

		private ToolStripSeparator toolStripSeparator4;
		private Panel panelToast;
		private Label labelToast;
		private ToolStripLabel labelYagasoft;

		private PluginSettings pluginSettings;
		private ToolParameters toolParameters;

		private readonly WorkerHelper workerHelper;
		private readonly UiHelper uiHelper;
		private ToolStripSeparator toolStripSeparator1;
		private ToolStripLabel labelQuickGuide;
		private TableLayoutPanel tableLayoutPanelMain;
		private ToolStripButton buttonPromote;
		private TreeView treePatches;
		private BackgroundWorker currentWorker;

		private readonly List<Solution> solutions = [];
		
		#region Base tool implementation

		public PluginControl()
		{
			InitializeComponent();
			LoadPluginSettings();
			ShowReleaseNotes();

			workerHelper = new WorkerHelper(
				(s, work, callback) => InvokeSafe(() => RunAsync(s, work, callback)),
				(s, work, callback) => InvokeSafe(() => RunAsync(s, work, callback)));
			uiHelper = new UiHelper(panelToast, labelToast, InvokeSafe);
		}

		private void InvokeSafe(Action action)
		{
			if (IsHandleCreated)
			{
				Invoke(action);
			}
			else
			{
				action();
			}
		}

		private void LoadPluginSettings()
		{
			try
			{
				SettingsManager.Instance.TryLoad(typeof(PromoteSolutionPatchPlugin), out pluginSettings);
			}
			catch
			{
				// ignored
			}

			pluginSettings ??= new PluginSettings();
			toolParameters ??= new ToolParameters();
		}

		private void ShowReleaseNotes()
		{
			if (pluginSettings.ReleaseNotesShownVersion != Constants.AppVersion)
			{
				MessageBox.Show(Constants.ReleaseNotes, "Release Notes",
					MessageBoxButtons.OK, MessageBoxIcon.Information);

				pluginSettings.ReleaseNotesShownVersion = Constants.AppVersion;
				SettingsManager.Instance.Save(typeof(PromoteSolutionPatchPlugin), pluginSettings);
			}
		}

		public override void ClosingPlugin(PluginCloseInfo info)
		{
			//if (!PromptSave("Text"))
			//{
			//	info.Cancel = true;
			//}

			base.ClosingPlugin(info);
		}

		private void BtnCloseClick(object sender, EventArgs e)
		{
			CloseTool(); // PluginBaseControl method that notifies the XrmToolBox that the user wants to close the plugin
		}

		private static bool PromptSave(string name)
		{
			var result = MessageBox.Show($"{name} not saved. Are you sure you want to exit before saving?", $"{name} Not Saved",
				MessageBoxButtons.YesNo, MessageBoxIcon.Warning);

			return result == DialogResult.Yes;
		}

		#endregion Base tool implementation

		#region UI Generated

		private void InitializeComponent()
		{
			System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(PluginControl));
			this.toolBar = new System.Windows.Forms.ToolStrip();
			this.buttonCloseTool = new System.Windows.Forms.ToolStripButton();
			this.toolStripSeparator4 = new System.Windows.Forms.ToolStripSeparator();
			this.buttonLoad = new System.Windows.Forms.ToolStripButton();
			this.buttonPromote = new System.Windows.Forms.ToolStripButton();
			this.toolStripSeparator2 = new System.Windows.Forms.ToolStripSeparator();
			this.labelQuickGuide = new System.Windows.Forms.ToolStripLabel();
			this.toolStripSeparator1 = new System.Windows.Forms.ToolStripSeparator();
			this.labelYagasoft = new System.Windows.Forms.ToolStripLabel();
			this.buttonCancel = new System.Windows.Forms.Button();
			this.tableLayoutTopBar = new System.Windows.Forms.TableLayoutPanel();
			this.panelToast = new System.Windows.Forms.Panel();
			this.labelToast = new System.Windows.Forms.Label();
			this.tableLayoutPanelMain = new System.Windows.Forms.TableLayoutPanel();
			this.treePatches = new System.Windows.Forms.TreeView();
			this.toolBar.SuspendLayout();
			this.panelToast.SuspendLayout();
			this.tableLayoutPanelMain.SuspendLayout();
			this.SuspendLayout();
			// 
			// toolBar
			// 
			this.toolBar.ImageScalingSize = new System.Drawing.Size(36, 36);
			this.toolBar.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.buttonCloseTool,
            this.toolStripSeparator4,
            this.buttonLoad,
            this.buttonPromote,
            this.toolStripSeparator2,
            this.labelQuickGuide,
            this.toolStripSeparator1,
            this.labelYagasoft});
			this.toolBar.Location = new System.Drawing.Point(0, 0);
			this.toolBar.Name = "toolBar";
			this.toolBar.Size = new System.Drawing.Size(1000, 25);
			this.toolBar.TabIndex = 0;
			this.toolBar.Text = "toolBar";
			// 
			// buttonCloseTool
			// 
			this.buttonCloseTool.Image = ((System.Drawing.Image)(resources.GetObject("buttonCloseTool.Image")));
			this.buttonCloseTool.ImageScaling = System.Windows.Forms.ToolStripItemImageScaling.None;
			this.buttonCloseTool.ImageTransparentColor = System.Drawing.Color.Magenta;
			this.buttonCloseTool.Name = "buttonCloseTool";
			this.buttonCloseTool.Size = new System.Drawing.Size(56, 22);
			this.buttonCloseTool.Text = "Close";
			this.buttonCloseTool.Click += new System.EventHandler(this.BtnCloseClick);
			// 
			// toolStripSeparator4
			// 
			this.toolStripSeparator4.Name = "toolStripSeparator4";
			this.toolStripSeparator4.Size = new System.Drawing.Size(6, 25);
			// 
			// buttonLoad
			// 
			this.buttonLoad.Image = ((System.Drawing.Image)(resources.GetObject("buttonLoad.Image")));
			this.buttonLoad.ImageScaling = System.Windows.Forms.ToolStripItemImageScaling.None;
			this.buttonLoad.ImageTransparentColor = System.Drawing.Color.Magenta;
			this.buttonLoad.Name = "buttonLoad";
			this.buttonLoad.Size = new System.Drawing.Size(97, 22);
			this.buttonLoad.Text = "Load Patches";
			this.buttonLoad.Click += new System.EventHandler(this.buttonLoad_Click);
			// 
			// buttonPromote
			// 
			this.buttonPromote.Image = ((System.Drawing.Image)(resources.GetObject("buttonPromote.Image")));
			this.buttonPromote.ImageScaling = System.Windows.Forms.ToolStripItemImageScaling.None;
			this.buttonPromote.ImageTransparentColor = System.Drawing.Color.Magenta;
			this.buttonPromote.Name = "buttonPromote";
			this.buttonPromote.Size = new System.Drawing.Size(73, 22);
			this.buttonPromote.Text = "Promote";
			this.buttonPromote.Click += new System.EventHandler(this.buttonPromote_Click);
			// 
			// toolStripSeparator2
			// 
			this.toolStripSeparator2.Name = "toolStripSeparator2";
			this.toolStripSeparator2.Size = new System.Drawing.Size(6, 25);
			this.toolStripSeparator2.Visible = false;
			// 
			// labelQuickGuide
			// 
			this.labelQuickGuide.Font = new System.Drawing.Font("Verdana", 8F, System.Drawing.FontStyle.Bold);
			this.labelQuickGuide.ForeColor = System.Drawing.Color.DarkViolet;
			this.labelQuickGuide.IsLink = true;
			this.labelQuickGuide.LinkBehavior = System.Windows.Forms.LinkBehavior.HoverUnderline;
			this.labelQuickGuide.LinkColor = System.Drawing.Color.DarkViolet;
			this.labelQuickGuide.Name = "labelQuickGuide";
			this.labelQuickGuide.Size = new System.Drawing.Size(84, 22);
			this.labelQuickGuide.Text = "Quick Guide";
			this.labelQuickGuide.Visible = false;
			this.labelQuickGuide.VisitedLinkColor = System.Drawing.Color.DarkBlue;
			this.labelQuickGuide.Click += new System.EventHandler(this.labelQuickGuide_Click);
			// 
			// toolStripSeparator1
			// 
			this.toolStripSeparator1.Name = "toolStripSeparator1";
			this.toolStripSeparator1.Size = new System.Drawing.Size(6, 25);
			// 
			// labelYagasoft
			// 
			this.labelYagasoft.Font = new System.Drawing.Font("Verdana", 8F, System.Drawing.FontStyle.Bold);
			this.labelYagasoft.ForeColor = System.Drawing.Color.DarkViolet;
			this.labelYagasoft.IsLink = true;
			this.labelYagasoft.LinkBehavior = System.Windows.Forms.LinkBehavior.HoverUnderline;
			this.labelYagasoft.LinkColor = System.Drawing.Color.DarkViolet;
			this.labelYagasoft.Name = "labelYagasoft";
			this.labelYagasoft.Size = new System.Drawing.Size(95, 22);
			this.labelYagasoft.Text = "Yagasoft.com";
			this.labelYagasoft.VisitedLinkColor = System.Drawing.Color.DarkBlue;
			this.labelYagasoft.Click += new System.EventHandler(this.labelYagasoft_Click);
			// 
			// buttonCancel
			// 
			this.buttonCancel.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right)));
			this.buttonCancel.Location = new System.Drawing.Point(948, 3);
			this.buttonCancel.Name = "buttonCancel";
			this.buttonCancel.Size = new System.Drawing.Size(49, 20);
			this.buttonCancel.TabIndex = 21;
			this.buttonCancel.Text = "Cancel";
			this.buttonCancel.UseVisualStyleBackColor = true;
			this.buttonCancel.Click += new System.EventHandler(this.buttonCancel_Click);
			// 
			// tableLayoutTopBar
			// 
			this.tableLayoutTopBar.ColumnCount = 3;
			this.tableLayoutTopBar.ColumnStyles.Add(new System.Windows.Forms.ColumnStyle(System.Windows.Forms.SizeType.Absolute, 250F));
			this.tableLayoutTopBar.ColumnStyles.Add(new System.Windows.Forms.ColumnStyle(System.Windows.Forms.SizeType.Percent, 100F));
			this.tableLayoutTopBar.ColumnStyles.Add(new System.Windows.Forms.ColumnStyle(System.Windows.Forms.SizeType.Absolute, 220F));
			this.tableLayoutTopBar.Dock = System.Windows.Forms.DockStyle.Fill;
			this.tableLayoutTopBar.Location = new System.Drawing.Point(3, 3);
			this.tableLayoutTopBar.Name = "tableLayoutTopBar";
			this.tableLayoutTopBar.RowCount = 1;
			this.tableLayoutTopBar.RowStyles.Add(new System.Windows.Forms.RowStyle(System.Windows.Forms.SizeType.Percent, 100F));
			this.tableLayoutTopBar.Size = new System.Drawing.Size(994, 26);
			this.tableLayoutTopBar.TabIndex = 0;
			// 
			// panelToast
			// 
			this.panelToast.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
			this.panelToast.BackColor = System.Drawing.Color.Black;
			this.panelToast.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
			this.panelToast.Controls.Add(this.labelToast);
			this.panelToast.ForeColor = System.Drawing.Color.Black;
			this.panelToast.Location = new System.Drawing.Point(741, 341);
			this.panelToast.Name = "panelToast";
			this.panelToast.Size = new System.Drawing.Size(250, 65);
			this.panelToast.TabIndex = 0;
			this.panelToast.Visible = false;
			// 
			// labelToast
			// 
			this.labelToast.AutoEllipsis = true;
			this.labelToast.BackColor = System.Drawing.Color.DarkViolet;
			this.labelToast.Dock = System.Windows.Forms.DockStyle.Fill;
			this.labelToast.Font = new System.Drawing.Font("Microsoft Sans Serif", 12F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
			this.labelToast.ForeColor = System.Drawing.Color.White;
			this.labelToast.Location = new System.Drawing.Point(0, 0);
			this.labelToast.Name = "labelToast";
			this.labelToast.Size = new System.Drawing.Size(248, 63);
			this.labelToast.TabIndex = 0;
			this.labelToast.Text = "<toast>";
			this.labelToast.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
			// 
			// tableLayoutPanelMain
			// 
			this.tableLayoutPanelMain.ColumnCount = 1;
			this.tableLayoutPanelMain.ColumnStyles.Add(new System.Windows.Forms.ColumnStyle(System.Windows.Forms.SizeType.Absolute, 150F));
			this.tableLayoutPanelMain.ColumnStyles.Add(new System.Windows.Forms.ColumnStyle(System.Windows.Forms.SizeType.Percent, 100F));
			this.tableLayoutPanelMain.Controls.Add(this.treePatches, 0, 0);
			this.tableLayoutPanelMain.Dock = System.Windows.Forms.DockStyle.Fill;
			this.tableLayoutPanelMain.Location = new System.Drawing.Point(0, 25);
			this.tableLayoutPanelMain.Name = "tableLayoutPanelMain";
			this.tableLayoutPanelMain.RowCount = 1;
			this.tableLayoutPanelMain.RowStyles.Add(new System.Windows.Forms.RowStyle(System.Windows.Forms.SizeType.Percent, 100F));
			this.tableLayoutPanelMain.Size = new System.Drawing.Size(1000, 416);
			this.tableLayoutPanelMain.TabIndex = 0;
			// 
			// treePatches
			// 
			this.treePatches.Dock = System.Windows.Forms.DockStyle.Fill;
			this.treePatches.Location = new System.Drawing.Point(3, 3);
			this.treePatches.Name = "treePatches";
			this.treePatches.Size = new System.Drawing.Size(994, 410);
			this.treePatches.TabIndex = 0;
			// 
			// PluginControl
			// 
			this.Controls.Add(this.tableLayoutPanelMain);
			this.Controls.Add(this.panelToast);
			this.Controls.Add(this.buttonCancel);
			this.Controls.Add(this.toolBar);
			this.Name = "PluginControl";
			this.Size = new System.Drawing.Size(1000, 441);
			this.Load += new System.EventHandler(this.PluginControl_Load);
			this.toolBar.ResumeLayout(false);
			this.toolBar.PerformLayout();
			this.panelToast.ResumeLayout(false);
			this.tableLayoutPanelMain.ResumeLayout(false);
			this.ResumeLayout(false);
			this.PerformLayout();

		}

		#endregion

		public event EventHandler<StatusBarMessageEventArgs> SendMessageToStatusBar;

		#region Event handlers

		private void PluginControl_Load(object sender, EventArgs e)
		{
			buttonCancel.Hide();
		}

		private void buttonLoad_Click(object sender, EventArgs eArgs)
		{
			ExecuteMethod(LoadPatches);
		}

		private void buttonPromote_Click(object sender, EventArgs e)
		{
			ExecuteMethod(PromotePatch);
		}

		private void labelQuickGuide_Click(object sender, EventArgs e)
		{
			Process.Start(new ProcessStartInfo(HelpUrl));
		}

		private void labelYagasoft_Click(object sender, EventArgs e)
		{
			Process.Start(new ProcessStartInfo("https://yagasoft.com"));
		}
		
		private void buttonCancel_Click(object sender, EventArgs e)
		{
			currentWorker.ReportProgress(99, $"Cancelling ...");
			uiHelper.ShowToast("Promotion cancelled.");
			currentWorker.CancelAsync();
		}

		#endregion

		private void RunAsync(string message, Action<Action<int, string>> work, Action callback = null)
		{
			RunAsync<object>(message,
				progressReporter =>
				{
					work(progressReporter);
					return null;
				},
				result => callback?.Invoke());
		}

		private void RunAsync<TOut>(string message, Func<Action<int, string>, TOut> work, Action<TOut> callback = null)
		{
			DisableTool();

			WorkAsync(
				new WorkAsyncInfo
				{
					Message = message,
					Work =
						(w, e) =>
						{
							try
							{
								work(w.ReportProgress);
							}
							finally
							{
								EnableTool();
							}
						},
					ProgressChanged =
						e =>
						{
							// If progress has to be notified to user, use the following method:
							SetWorkingMessage(e.UserState.ToString());

							// If progress has to be notified to user, through the
							// status bar, use the following method
							SendMessageToStatusBar?.Invoke(this,
								new StatusBarMessageEventArgs(e.ProgressPercentage, e.UserState.ToString()));
						},
					PostWorkCallBack =
						e =>
						{
							SendMessageToStatusBar?.Invoke(this, new StatusBarMessageEventArgs(""));
							callback?.Invoke((TOut)e.Result);
						},
					AsyncArgument = null,
					IsCancelable = false,
					MessageWidth = 340,
					MessageHeight = 150
				});
		}

		private async void LoadPatches()
		{
			uiHelper.ShowToast("Loading solution patches ...");

			DisableTool();

			buttonCancel.Show();

			WorkAsync(
				new WorkAsyncInfo
				{
					Message = "Loading solution patches ...",
					Work =
						(w, e) =>
						{
							currentWorker = w;
							w.WorkerSupportsCancellation = true;

							try
							{
								w.ReportProgress(0, $"Loading solution patches ...");

								try
								{
										w.ReportProgress(0, $"Retrieving solution patches from CRM ...");

										var solutionRows =
											Service.RetrieveMultiple(
												new FetchExpression($"""
<fetch>
  <entity name='solution'>
    <attribute name='solutionid' />
    <attribute name='version' />
    <attribute name='uniquename' />
    <attribute name='friendlyname' />
    <filter>
      <condition attribute='ismanaged' operator='eq' value='0' />
    </filter>
    <link-entity name='solution' from='solutionid' to='parentsolutionid' link-type='inner' alias='p'>
      <attribute name='solutionid' />
      <attribute name='uniquename' />
      <attribute name='friendlyname' />
    </link-entity>
  </entity>
</fetch>
""")).Entities;

										w.ReportProgress(80, $"Building tree of {solutionRows.Count} patches ...");

									solutions.Clear();
									
										solutions.AddRange(
											solutionRows.Select(
													s =>
														new
														{
															Solution =
																new Solution
																{
																	Id = (s.GetAttributeValue<AliasedValue>("p.solutionid")?.Value as Guid?).GetValueOrDefault(),
																	UniqueName = s.GetAttributeValue<AliasedValue>("p.uniquename")?.Value as string,
																	DisplayName = s.GetAttributeValue<AliasedValue>("p.friendlyname")?.Value as string
																},
															Patch =
																new Patch
																{
																	Id = s.Id,
																	UniqueName = s.GetAttributeValue<string>("uniquename"),
																	DisplayName = s.GetAttributeValue<string>("friendlyname"),
																	Version = new Version(s.GetAttributeValue<string>("version"))
																}
														})
												.OrderBy(s => s.Solution.DisplayName)
												.GroupBy(s => s.Solution.UniqueName)
												.Select(
													g =>
														{
															var solution = g.First().Solution;
															solution.Patches = g
																.Select(
																	p =>
																	{
																		var patch = p.Patch;
																		patch.Parent = solution;
																		return p.Patch;
																	}).OrderBy(s => s.DisplayName).ToArray();

															return solution;
														}));
										
									InvokeSafe(
										() =>
											   {
												   treePatches.Nodes.Clear();
												   
												   treePatches.Nodes
													   .AddRange(
														   solutions.Select(
															   s =>
															   {
																   var node =
																	   new TreeNode
																	   {
																		   Name = s.UniqueName,
																		   Text = s.DisplayName,
																		   Tag = s
																	   };

																   node.Nodes.AddRange(
																	   s.Patches.Select(
																		   p =>
																			   new TreeNode
																			   {
																				   Name = p.UniqueName,
																				   Text = $"{p.DisplayName} ({p.Version} - {p.UniqueName})",
																				   Tag = p
																			   }).ToArray());

																   return node;
															   }).ToArray());
												   
												   treePatches.ExpandAll();
											   });
									}
									catch (Exception ex)
									{
											MessageBox.Show(ex.ToString(), "Load Error", MessageBoxButtons.OK,
												MessageBoxIcon.Error);
										return;
									}

								uiHelper.ShowToast("Loaded patches.");
							}
							finally
							{
								InvokeSafe(() => buttonCancel.Hide());
								EnableTool();
							}
						},
					ProgressChanged =
						e =>
						{
							// If progress has to be notified to user, use the following method:
							SetWorkingMessage(e.UserState.ToString());

							if (e.ProgressPercentage < 0)
							{
								return;
							}

							// If progress has to be notified to user, through the
							// status bar, use the following method
							SendMessageToStatusBar?.Invoke(this,
								new StatusBarMessageEventArgs(e.ProgressPercentage, e.UserState.ToString()));
						},
					PostWorkCallBack =
						async e =>
						{
							SendMessageToStatusBar?.Invoke(this, new StatusBarMessageEventArgs(""));

							if (e.Result != null)
							{
							}
						},
					AsyncArgument = null,
					IsCancelable = false,
					MessageWidth = 340,
					MessageHeight = 150
				});
		}

		private async void PromotePatch()
		{
			if (treePatches.SelectedNode?.Tag is not Patch patch)
			{
				MessageBox.Show("Please select a patch before promoting.", "Nothing Selected", MessageBoxButtons.OK,
					MessageBoxIcon.Error);
				return;
			}

			uiHelper.ShowToast("Promoting patch ...");

			DisableTool();

			buttonCancel.Show();

			WorkAsync(
				new WorkAsyncInfo
				{
					Message = "Promoting patch ...",
					Work =
						(w, e) =>
						{
							currentWorker = w;
							w.WorkerSupportsCancellation = true;

							try
							{
								w.ReportProgress(0, $"Promoting patch ...");

								var isError = false;

								try
								{
									var thread = new Thread(
										() =>
										{
											try
											{
												w.ReportProgress(0, $"Retrieving patch ({patch.DisplayName}) components ...");
												
												var solutionComponents = Service
													.RetrieveMultiple(
														new FetchExpression(
															$"""
<fetch>
  <entity name='solutioncomponent'>
    <attribute name='solutionid' />
    <attribute name='componenttype' />
    <attribute name='ismetadata' />
    <attribute name='objectid' />
    <attribute name='rootcomponentbehavior' />
    <attribute name='rootsolutioncomponentid' />
    <attribute name='solutioncomponentid' />
    <link-entity name='solution' from='solutionid' to='solutionid'>
      <attribute name='solutionid' />
      <filter>
        <condition attribute='uniquename' operator='eq' value='{patch.UniqueName}' />
      </filter>
    </link-entity>
  </entity>
</fetch>
""")).Entities.ToArray();
												
												var highestVersion = patch.Parent.Patches.Select(p => p.Version).OrderByDescending(v => v).First();
												var newVersion =
													new Version(highestVersion.Major, highestVersion.Minor, highestVersion.Build + 1, highestVersion.Revision)
														.ToString();
												
												w.ReportProgress(15, $"Cloning a patch (v{newVersion}) for {patch.Parent.DisplayName} ...");

												var promotedSolutionId =
													((CloneAsPatchResponse)Service.Execute(
														new CloneAsPatchRequest
														{
															DisplayName = patch.DisplayName,
															VersionNumber = newVersion,
															ParentSolutionUniqueName = patch.Parent.UniqueName
														})).SolutionId;
												
												w.ReportProgress(30, $"Retrieving unique name for patch: {promotedSolutionId} ...");
												
												var promotedSolutionName =
													Service.Retrieve("solution",promotedSolutionId,
														new ColumnSet("uniquename")).GetAttributeValue<string>("uniquename");
			
												w.ReportProgress(40, $"Building AddComponent request list for patch {promotedSolutionName} ...");
												
												var requests = new List<OrganizationRequest>();

												requests.AddRange(
														solutionComponents.Select(
																c =>
																new AddSolutionComponentRequest
																{
																	AddRequiredComponents = false,
																	ComponentId = c.GetAttributeValue<Guid>("objectid"),
																	ComponentType = c.GetAttributeValue<OptionSetValue>("componenttype").Value,
																	SolutionUniqueName = promotedSolutionName,
																	DoNotIncludeSubcomponents = c.GetAttributeValue<OptionSetValue>("rootcomponentbehavior")?.Value == 1 ||
																		c.GetAttributeValue<OptionSetValue>("rootcomponentbehavior")?.Value == 2
																}));
			
												requests.Add(
													new DeleteRequest
													{
														Target = new EntityReference("solution", patch.Id)
													});

												w.ReportProgress(50, $"Executing AddComponent requests for patch {patch.DisplayName} ({newVersion} - {promotedSolutionName}) ...");
												
												CrmHelpers.ExecuteBulk(Service, [.. requests],
													true,
													50,
													false,
													(i, i1, responses) =>
													{
														w.ReportProgress(50 + 50 * (i / i1), $"Finished batch {i} / {i1}.");

														foreach (var response in responses.Where(r => r.Value.Fault != null || r.Value.FaultMessage.IsFilled()))
														{
															MessageBox.Show(response.Value.Fault?.BuildShortFaultMessage() ?? response.Value.FaultMessage,
																"Promotion Failed", MessageBoxButtons.OK,
																MessageBoxIcon.Error);
														}
													});
											}
											catch (ThreadAbortException)
											{ }
											catch (Exception ex)
											{
												isError = true;

												if (ex.InnerException is ThreadAbortException)
												{
													return;
												}

												MessageBox.Show(ex.ToString(), "Promotion Error", MessageBoxButtons.OK,
													MessageBoxIcon.Error);
											}
										});
									thread.Start();

									while (thread.IsAlive)
									{
										if (w.CancellationPending)
										{
											thread.Abort();
										}
									}
								}
								catch (ThreadAbortException)
								{
									return;
								}
								catch (Exception ex)
								{
									if (ex.InnerException is not ThreadAbortException)
									{
										MessageBox.Show(ex.ToString(), "Promotion Error", MessageBoxButtons.OK,
											MessageBoxIcon.Error);
									}

									return;
								}

								if (isError)
								{
									return;
								}

								uiHelper.ShowToast("Patch promoted.");
							}
							catch (Exception exception)
							{
								Console.WriteLine(exception);
								throw;
							}
							finally
							{
								InvokeSafe(() => buttonCancel.Hide());
								EnableTool();
							}
						},
					ProgressChanged =
						e =>
						{
							// If progress has to be notified to user, use the following method:
							SetWorkingMessage(e.UserState.ToString());

							if (e.ProgressPercentage < 0)
							{
								return;
							}

							// If progress has to be notified to user, through the
							// status bar, use the following method
							SendMessageToStatusBar?.Invoke(this,
								new StatusBarMessageEventArgs(e.ProgressPercentage, e.UserState.ToString()));
						},
					PostWorkCallBack =
						async e =>
						{
							SendMessageToStatusBar?.Invoke(this, new StatusBarMessageEventArgs(""));

							LoadPatches();
								
							if (e.Result != null)
							{
							}
						},
					AsyncArgument = null,
					IsCancelable = false,
					MessageWidth = 340,
					MessageHeight = 150
				});
		}

		private void EnableTool()
		{
			InvokeSafe(
				() =>
				{
					tableLayoutPanelMain.Enabled = true;
					toolBar.Enabled = true;
				});
		}

		private void DisableTool()
		{
			InvokeSafe(
				() =>
				{
					toolBar.Enabled = false;
					tableLayoutPanelMain.Enabled = false;
				});
		}
	}
}
