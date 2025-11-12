/**
 * TODO: Rewrite this config to ESM
 * But currently electron-builder doesn't support ESM configs
 * @see https://github.com/develar/read-config-file/issues/10
 */

/**
 * @type {() => import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = async function () {

  const {getVersion} = await import('./version/getVersion.mjs');

  return {
    directories: {
      output: 'dist',
      buildResources: 'buildResources',
    },
    files: ['packages/**/dist/**', 'packages/**/assets/**'],
    extraMetadata: {
      version: getVersion(),
    },

    npmRebuild: false,

    appId: 'org.bigbluebutton.room-media.appliance',
    productName: "BigBlueButton-RMC",
    copyright: "Copyright © 2025 ${author}",

    mac: {
      category: "public.app-category.developer-tools",
      target: ["dmg"]
    }
  };
};
