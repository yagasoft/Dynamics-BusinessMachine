const path = require('path');
const glob = require('glob');
const fs = require('fs');
const DeclarationBundlerPlugin = require('types-webpack-bundler');

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
	// mode: 'development',
	// devtool: 'inline-source-map'
	mode: 'production',
	entry: ['./src/vm/helpers/date.ts', './src/vm/helpers/string.ts', './src/global.ts'],
	output: {
		filename: 'dbm-lib.js',
		path: path.resolve(__dirname, 'bin'),
		library: { type: 'global' },
		globalObject: `(typeof self === 'undefined' ? globalThis : self)`
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
	},
	plugins: [
		new DeclarationBundlerPlugin({
			moduleName: 'Ys',
			out: 'dbm-lib.d.ts',
		})
	],
	watchOptions: {
		poll: 500,
		ignored: /node_modules/
	},
};
