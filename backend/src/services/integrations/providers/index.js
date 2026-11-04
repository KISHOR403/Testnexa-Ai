/**
 * TestNexa AI — CI/CD Provider Registry
 */

const githubProvider = require('./githubProvider');
const gitlabProvider = require('./gitlabProvider');
const jenkinsProvider = require('./jenkinsProvider');

const providers = new Map([
    ['github', githubProvider],
    ['gitlab', gitlabProvider],
    ['jenkins', jenkinsProvider]
]);

function getProvider(providerId) {
    if (!providerId) return null;
    return providers.get(providerId.toLowerCase()) || null;
}

function listProviders() {
    return Array.from(providers.values()).map(p => ({
        id: p.id,
        name: p.name,
        isAvailable: p.isAvailable,
        status: p.status,
        description: p.description
    }));
}

module.exports = {
    getProvider,
    listProviders,
    githubProvider,
    gitlabProvider,
    jenkinsProvider
};
