export * as Ys from './global-auto'
export * from "../node_modules/guid-typescript/dist/guid";

import { Context } from "models/context/context";
import { Service } from "vm/service";
import { Memory } from "vm/memory";
import { Logger } from "log/logger";

declare global
{
	/**
	 * Stores the latest function call in the evaluation.
	 * Useful to access during chaining, instead of storing the latest value and then accessing it right after a small operation.
	 */
	var $value: any;

	var $context: Context;
	var $this: any;
	var $service: Service;
	var $mem: Memory;
	var $log: Logger;

	var $output: any;
}
