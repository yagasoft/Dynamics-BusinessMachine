const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
	entry: {
		"bundle.js": [
			// path.resolve(__dirname, "dist/dbm-app/browser/media/hue.png"),
			// path.resolve(__dirname, "dist/dbm-app/browser/media/color.png"),
			// path.resolve(__dirname, "dist/dbm-app/browser/media/primeicons.woff2"),
			// path.resolve(__dirname, "dist/dbm-app/browser/media/primeicons.woff"),
			// path.resolve(__dirname, "dist/dbm-app/browser/media/primeicons.ttf"),
			// path.resolve(__dirname, "dist/dbm-app/browser/media/primeicons.eot"),
			// path.resolve(__dirname, "dist/dbm-app/browser/media/primeicons.svg"),
			path.resolve(__dirname, "dist/dbm-app/browser/polyfills.js"),
			path.resolve(__dirname, "dist/dbm-app/browser/styles.css"),
			path.resolve(__dirname, "dist/dbm-app/browser/main.js"),
		]
	},
	output: { filename: "[name]", path: path.resolve(__dirname, "bundle") },
	mode: 'production',
	module: {
		rules: [
			{
				test: /\.css$/i,
				use: ["style-loader", "css-loader"],
			},
			{
				test: /\.(woff(2)?|eot|ttf|otf|svg|png|jpg)$/i,
				type: 'asset/resource',
				generator: {
					filename: './[name][ext]',
				},
			}
			// ,
			// {
			// 	test: /\.(woff|woff2|eot|ttf|otf|svg|png|jpg)$/i,
			// 	use: ["binary-base64-loader"],
			// }
		]
	},
	resolve: {
		alias: {
			"./beautify": path.resolve(__dirname, "dist/dbm-app/browser/assets/html-beautify.js"),
			"./beautify-css": path.resolve(__dirname, "dist/dbm-app/browser/assets/html-beautify.js")
		}
	},
	plugins: [new HtmlWebpackPlugin(),
		{
			apply: (compiler) =>
			{
				compiler.hooks.afterEmit.tap('append-file', () =>
				{
					const fs = require('fs');
			
					const files = [
						'./src/assets/global.js',
						'./src/assets/ys-common.js',
						'./src/assets/dbm-common.js',
					]

					let text = '';

					for (const file of files) {
						text += fs.readFileSync(path.resolve(__dirname, file), 'utf8')
					}

					fs.appendFile(path.resolve(__dirname, 'bundle/bundle.js'),
						text,
						(err) =>
						{
							if (err) throw err;
							console.log('The "data to append" was appended to file!');
						});
				});
			},
		}
	]
};
