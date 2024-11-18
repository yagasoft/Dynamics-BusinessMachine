interface String
{
	trimChars(c: string[] | string): string;
	trimStartChars(c: string[] | string): string;
	trimEndChars(c: string[] | string): string;
}

String.prototype.trimChars = function (c: string[] | string): string
{
	return this.trimStartChars(c).trimEndChars(c);
}

String.prototype.trimStartChars = function (c: string[] | string): string
{
	const strings = (c as string[])?.join('|') ?? (c as string);
	var re = new RegExp("^(" + strings + ")+", "g");
	return this.replace(re, "");
}

String.prototype.trimEndChars = function (c: string[] | string): string
{
	const strings = (c as string[])?.join('|') ?? (c as string);
	var re = new RegExp("(" + strings + ")+$", "g");
	return this.replace(re, "");
}
