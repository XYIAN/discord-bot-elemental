const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'bootstrap-config.json');

function loadBootstrapConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

module.exports = {
    loadBootstrapConfig,
    CONFIG_PATH,
};
