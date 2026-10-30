const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const ARTIFACT_STORAGE_DIR = path.resolve(__dirname, '../../data/artifacts');

// Ensure base storage directory exists
if (!fs.existsSync(ARTIFACT_STORAGE_DIR)) {
    fs.mkdirSync(ARTIFACT_STORAGE_DIR, { recursive: true });
}

/**
 * Validates and sanitizes artifact storage path to prevent directory traversal
 */
const getSafeArtifactPath = (workspaceId, runId, filename) => {
    const cleanWorkspaceId = (workspaceId || 'common').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanRunId = (runId || 'common_run').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(ARTIFACT_STORAGE_DIR, cleanWorkspaceId, cleanRunId);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const sanitizedFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = path.join(targetDir, sanitizedFilename);

    // Verify it is inside targetDir
    if (!fullPath.startsWith(ARTIFACT_STORAGE_DIR)) {
        throw new Error('Access denied: Invalid artifact destination path');
    }

    return {
        fullPath,
        relativePath: path.relative(ARTIFACT_STORAGE_DIR, fullPath).replace(/\\/g, '/')
    };
};

/**
 * Saves a screenshot or file buffer/base64 securely to local private storage
 */
const saveArtifactBuffer = async ({ workspaceId, runId, name, data, mimeType = 'image/png' }) => {
    let buffer;
    if (Buffer.isBuffer(data)) {
        buffer = data;
    } else if (typeof data === 'string') {
        if (data.startsWith('data:')) {
            // Strip data URL header
            const commaIndex = data.indexOf(',');
            const base64Data = commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            buffer = Buffer.from(data, 'utf8');
        }
    } else {
        throw new Error('Invalid artifact data provided: expected Buffer or Base64 string');
    }

    // Maximum file size limit: 10MB per artifact
    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
        throw new Error('Artifact exceeds maximum allowed file size of 10MB');
    }

    const fileExt = path.extname(name) || (mimeType.includes('png') ? '.png' : mimeType.includes('jpeg') ? '.jpg' : '.bin');
    const uniqueName = `${path.basename(name, fileExt)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${fileExt}`;

    const { fullPath, relativePath } = getSafeArtifactPath(workspaceId, runId, uniqueName);
    fs.writeFileSync(fullPath, buffer);

    return {
        name: uniqueName,
        sizeBytes: buffer.length,
        storagePath: relativePath,
        fullPath,
        mimeType
    };
};

/**
 * Retrieves an artifact file stream or buffer securely
 */
const getArtifactBuffer = (relativePath) => {
    if (!relativePath) return null;
    const sanitized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(ARTIFACT_STORAGE_DIR, sanitized);

    if (!fullPath.startsWith(ARTIFACT_STORAGE_DIR) || !fs.existsSync(fullPath)) {
        return null;
    }

    return {
        fullPath,
        data: fs.readFileSync(fullPath)
    };
};

module.exports = {
    ARTIFACT_STORAGE_DIR,
    saveArtifactBuffer,
    getArtifactBuffer,
    getSafeArtifactPath
};

