const packager = require('electron-packager');

const options = {
  dir: './',
  name: 'DemoApp',
  platform: 'win32',
  arch: 'x64',
  version: '2.0.1',
  out: './out',
  icon: './icon.ico'
};

packager(options, (err, appPaths) => {
  console.log(err);
  console.log(appPaths);
});