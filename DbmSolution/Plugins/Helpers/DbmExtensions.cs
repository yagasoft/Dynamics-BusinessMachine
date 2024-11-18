using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Jint.Native;
using Jint;
using Microsoft.Xrm.Sdk;

namespace Yagasoft.Dbm.Plugins.Helpers
{
	public static class DbmExtensions
	{
		public static JsValue ToJsValue(this object obj, Engine engine)
		{
			switch (obj)
			{
				case Guid guid:
					return engine.Construct("Ys.Guid", guid.ToString());

				case Entity entity:
					var jsEntity = engine.Construct("Ys.Entity");
					jsEntity["logicalName"] = entity.LogicalName;
					jsEntity["id"] = entity.Id.ToJsValue(engine);
					jsEntity["attributes"] =
						entity.Attributes
							.ToDictionary(
								p => p.Key,
								p => p.Value.ToJsValue(engine)).ToJsValue(engine);
					return jsEntity;

				default:
					return JsValue.FromObject(engine, obj);
			}
		}
	}
}
