export class Rand
{
	/**
	 * Generates a random string.
	 * @param length Length of the resulting string.
	 * @param pool The pool of characters to choose from.
	 *  Pass an array of characters, or pass a string that contains one of 'u' (upper letters), 'l' (lower), 'n' (numbers);
	 *  e.g. 'ul' will set the pool to be upper and lower letters only.
	 * @param isLetterStart The string must start with a letter?
	 * @param numLetterRatio The max ratio of numbers in the resulting string. Full form percentage; e.g. 50% or 12% ... etc.
	 * @returns 
	 */
	generate(length, pool, isLetterStart, numLetterRatio)
	{
		let result = '';

		const upperPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const lowerPool = 'abcdefghijklmnopqrstuvwxyz';
		const numPool = '0123456789';
		let characters = pool ? '' : upperPool + lowerPool + numPool;

		if (typeof pool === 'string')
		{
			if (pool.includes('u'))
			{
				characters += upperPool;
			}

			if (pool.includes('l'))
			{
				characters += lowerPool;
			}

			if (pool.includes('n'))
			{
				characters += numPool;
			}
		}

		const charactersLength = characters.length;
		let counter = 0;
		let numbersCount = 0;
		let currentNumLetterRatio = 0;

		while (counter < length)
		{
			const next = characters.charAt(Math.floor(Math.random() * charactersLength));
			const isNum = !isNaN(parseInt(next));

			if (isNum)
			{
				numbersCount++;
			}

			if (isNum
				&& ((counter === 0 && isLetterStart)
					|| ((currentNumLetterRatio + 1) > numLetterRatio)))
			{
				continue;
			}

			result += next;
			counter += 1;
			currentNumLetterRatio = numbersCount / counter * 100;
		}

		return result;
	}
}
