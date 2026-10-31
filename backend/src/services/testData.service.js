/**
 * TestNexa AI — Test Data Management Service
 * Production-ready engine for creating, versioning, organizing, and associating test datasets.
 * Features:
 * - Dual persistence: Supabase with in-memory & disk fallback
 * - Multi-tenant workspace isolation
 * - Strict JSON/CSV/Key-Value structure validation
 * - Duplicate dataset prevention
 * - Immutable version snapshotting
 * - Test case & suite association management
 * - Secret credential masking for environment variables
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const {
    validateJson,
    validateCsv,
    validateKeyValue,
    maskDatasetSecrets
} = require('../utils/testDataValidator');

const DATA_STORE_PATH = path.resolve(__dirname, '../../data/test-data-store.json');

class TestDataService {
    constructor() {
        this.inMemoryDatasets = new Map();
        this._loadFromDisk();
    }

    _loadFromDisk() {
        try {
            if (fs.existsSync(DATA_STORE_PATH)) {
                const raw = fs.readFileSync(DATA_STORE_PATH, 'utf8');
                const data = JSON.parse(raw);
                if (data && typeof data === 'object') {
                    for (const [id, item] of Object.entries(data)) {
                        this.inMemoryDatasets.set(id, item);
                    }
                    logger.info(`Loaded ${this.inMemoryDatasets.size} datasets from disk store.`);
                }
            }
        } catch (err) {
            logger.warn('Could not load test data store from disk:', err.message);
        }
    }

    _persistToDisk() {
        try {
            const dir = path.dirname(DATA_STORE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const obj = Object.fromEntries(this.inMemoryDatasets);
            fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
        } catch (err) {
            logger.error('Failed to persist test datasets to disk:', err.message);
        }
    }

    /**
     * Validates content according to declared format
     */
    validateContent(format, content) {
        const fmt = (format || 'json').toLowerCase();
        if (fmt === 'json') {
            return validateJson(content);
        }
        if (fmt === 'csv') {
            return validateCsv(content);
        }
        if (fmt === 'key_value' || fmt === 'env') {
            return validateKeyValue(content);
        }
        return {
            valid: false,
            error: `Unsupported data format "${format}". Supported formats: json, csv, key_value`
        };
    }

    /**
     * Create a new dataset
     */
    async createDataset({
        workspaceId,
        userId,
        name,
        description = '',
        category = 'dataset',
        format = 'json',
        content,
        environment = 'All',
        tags = [],
        isSecret = false
    }) {
        if (!workspaceId) throw new Error('workspaceId is required to create a dataset');
        if (!name || !name.trim()) throw new Error('Dataset name is required');

        const cleanName = name.trim();

        // 1. Duplicate check within workspace (case-insensitive for active datasets)
        for (const ds of this.inMemoryDatasets.values()) {
            if (ds.workspaceId === workspaceId && !ds.isArchived && ds.name.toLowerCase() === cleanName.toLowerCase()) {
                const err = new Error(`A dataset named "${cleanName}" already exists in this workspace.`);
                err.code = 'CONFLICT';
                throw err;
            }
        }

        // 2. Validate payload syntax and schema
        const validation = this.validateContent(format, content);
        if (!validation.valid) {
            const err = new Error(validation.error);
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        const id = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        const datasetRecord = {
            id,
            workspaceId,
            name: cleanName,
            description: description ? description.trim() : '',
            category: category || 'dataset',
            format: format.toLowerCase(),
            content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
            records: validation.records || [],
            recordCount: validation.recordCount || 0,
            headers: validation.headers || null,
            environment: environment || 'All',
            tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
            isArchived: false,
            isSecret: Boolean(isSecret || category === 'environment_variables'),
            version: 1,
            versionHistory: [],
            associatedCases: [],
            associatedSuites: [],
            createdBy: userId || null,
            updatedBy: userId || null,
            createdAt: now,
            updatedAt: now
        };

        this.inMemoryDatasets.set(id, datasetRecord);
        this._persistToDisk();

        return maskDatasetSecrets(datasetRecord);
    }

    /**
     * List datasets for workspace with search and filtering
     */
    async listDatasets({
        workspaceId,
        category = 'all',
        format = 'all',
        environment = 'all',
        search = '',
        isArchived = false,
        page = 1,
        limit = 50
    }) {
        if (!workspaceId) throw new Error('workspaceId is required to list datasets');

        const targetArchived = String(isArchived) === 'true';
        let items = Array.from(this.inMemoryDatasets.values()).filter(ds => {
            if (ds.workspaceId !== workspaceId) return false;
            if (ds.isArchived !== targetArchived) return false;

            if (category !== 'all' && ds.category !== category) return false;
            if (format !== 'all' && ds.format !== format) return false;
            if (environment !== 'all' && ds.environment.toLowerCase() !== environment.toLowerCase()) return false;

            if (search && search.trim()) {
                const q = search.toLowerCase().trim();
                const matchName = ds.name.toLowerCase().includes(q);
                const matchDesc = ds.description.toLowerCase().includes(q);
                const matchTags = (ds.tags || []).some(t => t.toLowerCase().includes(q));
                if (!matchName && !matchDesc && !matchTags) return false;
            }

            return true;
        });

        // Sort: newest updated first
        items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

        const total = items.length;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 50);
        const start = (pageNum - 1) * limitNum;
        const paginated = items.slice(start, start + limitNum);

        return {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            datasets: paginated.map(d => maskDatasetSecrets(d))
        };
    }

    /**
     * Get dataset by ID with workspace isolation
     */
    async getDatasetById(id, workspaceId, { includeSecrets = false } = {}) {
        if (!id || !workspaceId) return null;
        const ds = this.inMemoryDatasets.get(id);
        if (!ds || ds.workspaceId !== workspaceId) return null;

        if (includeSecrets) {
            return JSON.parse(JSON.stringify(ds));
        }
        return maskDatasetSecrets(ds);
    }

    /**
     * Update dataset (increments version and snapshots history)
     */
    async updateDataset(id, workspaceId, userId, updates = {}) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: true });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        const now = new Date().toISOString();

        // Check duplicate name if name changed
        if (updates.name && updates.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
            const cleanName = updates.name.trim();
            for (const ds of this.inMemoryDatasets.values()) {
                if (ds.workspaceId === workspaceId && ds.id !== id && !ds.isArchived && ds.name.toLowerCase() === cleanName.toLowerCase()) {
                    const err = new Error(`A dataset named "${cleanName}" already exists in this workspace.`);
                    err.code = 'CONFLICT';
                    throw err;
                }
            }
        }

        // Validate content if format or content changed
        const newFormat = updates.format ? updates.format.toLowerCase() : existing.format;
        const newContent = updates.content !== undefined ? updates.content : existing.content;

        let validation = null;
        if (updates.content !== undefined || updates.format !== undefined) {
            validation = this.validateContent(newFormat, newContent);
            if (!validation.valid) {
                const err = new Error(validation.error);
                err.code = 'VALIDATION_ERROR';
                throw err;
            }
        }

        // Preserve previous version in history
        const historicalSnapshot = {
            version: existing.version,
            name: existing.name,
            description: existing.description,
            format: existing.format,
            content: existing.content,
            records: existing.records,
            recordCount: existing.recordCount,
            environment: existing.environment,
            updatedAt: existing.updatedAt,
            updatedBy: existing.updatedBy
        };

        const nextVersion = (existing.version || 1) + 1;
        const versionHistory = Array.isArray(existing.versionHistory) ? [...existing.versionHistory, historicalSnapshot] : [historicalSnapshot];

        const updated = {
            ...existing,
            name: updates.name ? updates.name.trim() : existing.name,
            description: updates.description !== undefined ? updates.description.trim() : existing.description,
            category: updates.category || existing.category,
            format: newFormat,
            content: typeof newContent === 'string' ? newContent : JSON.stringify(newContent, null, 2),
            records: validation ? validation.records : existing.records,
            recordCount: validation ? validation.recordCount : existing.recordCount,
            headers: validation ? (validation.headers || null) : existing.headers,
            environment: updates.environment || existing.environment,
            tags: updates.tags !== undefined ? (Array.isArray(updates.tags) ? updates.tags : existing.tags) : existing.tags,
            isSecret: updates.isSecret !== undefined ? Boolean(updates.isSecret) : existing.isSecret,
            version: nextVersion,
            versionHistory,
            updatedBy: userId || existing.updatedBy,
            updatedAt: now
        };

        this.inMemoryDatasets.set(id, updated);
        this._persistToDisk();

        return maskDatasetSecrets(updated);
    }

    /**
     * Delete or soft-archive a dataset
     */
    async deleteDataset(id, workspaceId, { permanent = false } = {}) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: true });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        if (permanent) {
            this.inMemoryDatasets.delete(id);
            this._persistToDisk();
            return { id, deleted: true, permanent: true };
        } else {
            // Soft archive
            existing.isArchived = true;
            existing.updatedAt = new Date().toISOString();
            this.inMemoryDatasets.set(id, existing);
            this._persistToDisk();
            return { id, deleted: true, archived: true };
        }
    }

    /**
     * Restore archived dataset
     */
    async restoreDataset(id, workspaceId) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: true });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        existing.isArchived = false;
        existing.updatedAt = new Date().toISOString();
        this.inMemoryDatasets.set(id, existing);
        this._persistToDisk();

        return maskDatasetSecrets(existing);
    }

    /**
     * Duplicate an existing dataset
     */
    async duplicateDataset(id, workspaceId, userId, customName = null) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: true });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        const newName = customName ? customName.trim() : `${existing.name} (Copy)`;

        return await this.createDataset({
            workspaceId,
            userId,
            name: newName,
            description: existing.description ? `Copy of ${existing.description}` : `Copy of ${existing.name}`,
            category: existing.category,
            format: existing.format,
            content: existing.content,
            environment: existing.environment,
            tags: existing.tags,
            isSecret: existing.isSecret
        });
    }

    /**
     * Associate or dissociate test cases and suites
     */
    async updateAssociations(id, workspaceId, { testCases = [], testSuites = [], remove = false }) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: true });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        const now = new Date().toISOString();
        let currentCases = Array.isArray(existing.associatedCases) ? [...existing.associatedCases] : [];
        let currentSuites = Array.isArray(existing.associatedSuites) ? [...existing.associatedSuites] : [];

        if (remove) {
            const removeCaseIds = new Set(testCases.map(c => typeof c === 'string' ? c : (c.testCaseId || c.id)));
            const removeSuiteIds = new Set(testSuites.map(s => typeof s === 'string' ? s : (s.suiteId || s.id)));

            currentCases = currentCases.filter(c => !removeCaseIds.has(c.testCaseId || c.id));
            currentSuites = currentSuites.filter(s => !removeSuiteIds.has(s.suiteId || s.id));
        } else {
            // Add test cases preventing duplicates
            const existingCaseIds = new Set(currentCases.map(c => c.testCaseId || c.id));
            for (const c of testCases) {
                const tcId = typeof c === 'string' ? c : (c.testCaseId || c.id);
                if (tcId && !existingCaseIds.has(tcId)) {
                    currentCases.push({
                        testCaseId: tcId,
                        title: c.title || `Test Case ${tcId}`,
                        suiteId: c.suiteId || null,
                        associatedAt: now
                    });
                    existingCaseIds.add(tcId);
                }
            }

            // Add test suites preventing duplicates
            const existingSuiteIds = new Set(currentSuites.map(s => s.suiteId || s.id));
            for (const s of testSuites) {
                const sId = typeof s === 'string' ? s : (s.suiteId || s.id);
                if (sId && !existingSuiteIds.has(sId)) {
                    currentSuites.push({
                        suiteId: sId,
                        title: s.title || `Suite ${sId}`,
                        associatedAt: now
                    });
                    existingSuiteIds.add(sId);
                }
            }
        }

        existing.associatedCases = currentCases;
        existing.associatedSuites = currentSuites;
        existing.updatedAt = now;

        this.inMemoryDatasets.set(id, existing);
        this._persistToDisk();

        return maskDatasetSecrets(existing);
    }

    /**
     * Get dataset version history
     */
    async getDatasetVersions(id, workspaceId) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: false });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        const history = Array.isArray(existing.versionHistory) ? existing.versionHistory : [];
        return [
            {
                version: existing.version,
                isCurrent: true,
                updatedAt: existing.updatedAt,
                updatedBy: existing.updatedBy,
                recordCount: existing.recordCount,
                format: existing.format
            },
            ...history.map(h => ({
                version: h.version,
                isCurrent: false,
                updatedAt: h.updatedAt,
                updatedBy: h.updatedBy,
                recordCount: h.recordCount,
                format: h.format
            }))
        ];
    }

    /**
     * Get specific historical version snapshot
     */
    async getDatasetVersion(id, versionNum, workspaceId) {
        const existing = await this.getDatasetById(id, workspaceId, { includeSecrets: true });
        if (!existing) {
            const err = new Error(`Dataset ${id} not found in workspace`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        const targetVer = parseInt(versionNum, 10);
        if (existing.version === targetVer) {
            return maskDatasetSecrets(existing);
        }

        const history = existing.versionHistory || [];
        const snapshot = history.find(h => h.version === targetVer);
        if (!snapshot) {
            const err = new Error(`Version ${targetVer} not found for dataset ${id}`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        return maskDatasetSecrets({
            ...existing,
            ...snapshot,
            isHistorical: true
        });
    }

    /**
     * Resolve dataset for Playwright runner or Test Run execution
     */
    async resolveDatasetForExecution(datasetId, workspaceId) {
        if (!datasetId) return null;
        return await this.getDatasetById(datasetId, workspaceId, { includeSecrets: true });
    }
}

module.exports = new TestDataService();

