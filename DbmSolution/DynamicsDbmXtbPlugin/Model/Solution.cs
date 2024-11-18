using System;

namespace Yagasoft.DynamicsPromoteSolutionPatchPlugin.Model
{
	internal class Solution
	{
		public Guid Id { get; set; }
		public string UniqueName { get; set; }
		public string DisplayName { get; set; }
		public Version Version { get; set; }

		public Patch[] Patches { get; set; }
	}
}
