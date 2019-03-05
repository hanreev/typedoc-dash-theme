"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const Handlebars = require("handlebars");
const utils_1 = require("typedoc/dist/lib/utils");
const components_1 = require("typedoc/dist/lib/output/components");
const events_1 = require("typedoc/dist/lib/output/events");
class InfoPlistPlugin extends components_1.ContextAwareRendererComponent {
    constructor(owner) {
        super(owner);
        Handlebars.registerHelper('relativeURL', (url) => url ? this.getRelativeUrl(url) : url);
        owner.on(events_1.RendererEvent.BEGIN, this.onRendererBegin, this);
    }
    onRendererBegin(event) {
        const name = event.settings.name;
        const dir = path.join(event.outputDirectory, 'Contents');
        utils_1.ensureDirectoriesExist(dir);
        const file = path.join(dir, 'Info.plist');
        const templateFile = fs.readFileSync(path.join(this.owner.theme.basePath, 'templates', 'Info.plist.hsb'), 'utf-8');
        utils_1.writeFile(file, Handlebars.compile(templateFile)({
            bundle: name.toLowerCase(),
            name,
        }), false);
    }
}
exports.InfoPlistPlugin = InfoPlistPlugin;
