interface Date
{
	add(value: string): Date;
	addMilliseconds(value: number): Date;
	addSeconds(value: number): Date;
	addMinutes(value: number): Date;
	addHours(value: number): Date;
	addDays(value: number): Date;
	addMonths(value: number): Date;
	addYears(value: number): Date;
}

Date.prototype.add = function (value)
{

	// TODO: parse timespan format
	return this;
}

Date.prototype.addMilliseconds = function (value)
{
	this.setTime(this.getTime() + value);
	return this;
}

Date.prototype.addSeconds = function (value)
{
	this.setTime(this.getTime() + (value * 1000));
	return this;
}

Date.prototype.addMinutes = function (value)
{
	this.setTime(this.getTime() + (value * 60 * 1000));
	return this;
}

// credit: https://stackoverflow.com/a/1050782/1919456
Date.prototype.addHours = function (value)
{
	this.setTime(this.getTime() + (value * 60 * 60 * 1000));
	return this;
}

Date.prototype.addDays = function (value)
{
	this.setTime(this.getTime() + (value * 24 * 60 * 60 * 1000));
	return this;
}

// credit: https://stackoverflow.com/a/2706169/1919456
Date.prototype.addMonths = function (value)
{
	var d = this.getDate();
	this.setMonth(this.getMonth() + value);

	if (this.getDate() != d)
	{
		this.setDate(0);
	}

	return this;
}

Date.prototype.addYears = function (value)
{
	var d = this.getDate();
	this.setFullYear(this.getFullYear() + value);

	if (this.getDate() != d)
	{
		this.setDate(0);
	}

	return this;
}
