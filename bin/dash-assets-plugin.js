"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const components_1 = require("typedoc/dist/lib/output/components");
const events_1 = require("typedoc/dist/lib/output/events");
const utils_1 = require("typedoc/dist/lib/utils");
class DashAssetsPlugin extends components_1.RendererComponent {
    constructor(owner) {
        super(owner);
        owner.on(events_1.RendererEvent.BEGIN, this.onRendererBegin, this);
        owner.on(events_1.RendererEvent.END, this.onRendererEnd, this);
    }
    onRendererBegin(event) {
        const from = path.join(this.owner.theme.basePath, 'assets');
        const to = path.join(event.outputDirectory, 'Contents', 'Resources', 'Documents', 'assets');
        utils_1.ensureDirectoriesExist(to);
        if (fs.existsSync(from))
            fs.copySync(from, to);
        this._copyIcons(event.outputDirectory);
    }
    onRendererEnd(event) {
        const assetsDirectory = path.join(event.outputDirectory, 'assets');
        fs.removeSync(assetsDirectory);
    }
    _copyIcons(dstIconsPath) {
        const srcIconsPath = process.env.TYPEDOC_DASH_ICONS_PATH;
        if (!srcIconsPath) {
            console.log('\nNOTE: Docset icons are not specified!');
            console.log('      You can specify the directory where icon.png and icon@2x.png reside with');
            console.log('      TYPEDOC_DASH_ICONS_PATH environment variable. They will be copied into the docset.\n');
            return;
        }
        this._copyIcon(srcIconsPath, dstIconsPath, 'icon.png');
        this._copyIcon(srcIconsPath, dstIconsPath, 'icon@2x.png');
    }
    _copyIcon(srcIconsPath, dstIconsPath, name) {
        const srcIconPath = path.join(srcIconsPath, name);
        const dstIconPath = path.join(dstIconsPath, name);
        if (fs.existsSync(srcIconPath))
            fs.copyFileSync(srcIconPath, dstIconPath);
    }
}
exports.DashAssetsPlugin = DashAssetsPlugin;
