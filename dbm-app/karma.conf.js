module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine', '@angular-devkit/build-angular'],
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-jasmine-html-reporter'),
			require('karma-coverage'),
			require('@angular-devkit/build-angular/plugins/karma')
		],
		client: {
			jasmine: {
				random: false
			}
		},
		jasmineHtmlReporter: {
			suppressAll: true
		},
		coverageReporter: {
			dir: require('path').join(__dirname, 'coverage/dbm-app'),
			subdir: '.',
			reporters: [
				{ type: 'html' },
				{ type: 'text-summary' }
			]
		},
		reporters: ['progress', 'kjhtml'],
		browsers: ['ChromeHeadless'],
		customLaunchers: {
			ChromeHeadlessNoSandbox: {
				base: 'ChromeHeadless',
				flags: ['--no-sandbox', '--disable-dev-shm-usage']
			}
		},
		restartOnFileChange: false,
		singleRun: true
	});
};
