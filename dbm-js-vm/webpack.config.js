const path = require('path');
const glob = require('glob');
const fs = require('fs');

const files = glob.sync("./src/**/*.ts").map(e => `./${e}`);
const globalFile = './src/global.ts';
const globalAutoFile = './src/global-auto.ts';

if (fs.existsSync(globalAutoFile))
{
	fs.unlinkSync(globalAutoFile);
}

const globalTs =
	files
		.filter(file =>
		{
			if (!fs.existsSync(file) || path.basename(file) === 'global.ts') {
				return false;
			}

			const content = fs.readFileSync(file, { encoding: 'utf-8' });
			return content.includes('export ', null, 'utf-8') || content.includes('import ', null, 'utf-8');
		})
		.reduce((str, f) => `${str}
export * from '${f.replaceAll('\\', '/').replaceAll('/src', '').replaceAll('.ts', '')}'`, '');

fs.writeFileSync(globalAutoFile, globalTs, { encoding: 'UTF-8' })

module.exports = {
	mode: 'production',
	entry: globalFile,
	output: {
		filename: 'dbm-js-vm.js',
		path: path.resolve(__dirname, 'bin'),
		library: 'Ys',
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /(Xrm)/,
			},
		],
	}
};
